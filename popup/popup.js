// Popup controller. Talks to the background service worker via
// chrome.runtime.sendMessage. Never calls the Claude API directly.

const state = {
  mode: 'page', // page | text | question | image | glossary | history
  pageData: null, // { url, title, text }
  image: null, // { base64, mediaType, name }
  // Full conversation sent to Claude for follow-ups.
  conversation: [],
  // Whether the current result view is restored from history.
  restored: false,
  // Selected explanation depth (eli5 | adult | pro | expert). Persisted.
  level: 'adult',
  // The exact input object used for the most recent explain, so the
  // re-level buttons on the result view can re-run it at a new depth.
  lastInput: null
};

const LEVELS = ['eli5', 'adult', 'pro', 'expert'];
const DEFAULT_LEVEL = 'adult';

// Tiny local copy of lib/providers.js → isOllamaCloudModel — avoids having
// to import the whole provider module into the popup bundle just for the
// no-key banner check. Keep the regex in sync with the source of truth.
function isOllamaCloudModelLocal(model) {
  if (!model) return false;
  const m = String(model).toLowerCase();
  return /:cloud\b/.test(m) || /-cloud$/.test(m);
}

const MIN_W = 340;
const MIN_H = 400;
const MAX_W = 800;
const MAX_H = 600;

// True when this document is being rendered inside the Chrome side panel
// (manifest points the side panel at popup.html#sidepanel) OR inside the
// Arc-style detached floating window (a chrome.windows.create popup).
// This is set during init() via detectIsSidePanel(), because we can only
// reliably identify the detached-window case via an async API call.
let IS_SIDE_PANEL = window.location.hash === '#sidepanel';

async function detectIsSidePanel() {
  // Manifest side panel path: explicit hash.
  if (window.location.hash === '#sidepanel') return true;

  // Arc fallback: we're running inside a chrome.windows.create({type:'popup'})
  // window. The standard extension action popup reports the parent browser
  // window (type 'normal'), so this cleanly distinguishes the two.
  try {
    const win = await chrome.windows.getCurrent();
    if (win && win.type === 'popup') return true;
  } catch {
    /* ignore — fall through */
  }
  return false;
}

// --- DOM helpers -----------------------------------------------------------

const $ = (id) => document.getElementById(id);
const qs = (sel) => document.querySelector(sel);
const qsa = (sel) => Array.from(document.querySelectorAll(sel));

function show(viewId) {
  ['inputView', 'loadingView', 'resultView', 'errorView'].forEach((v) => {
    $(v).classList.toggle('hidden', v !== viewId);
  });
}

function showError(message) {
  $('errorText').textContent = message;
  show('errorView');
}

// --- Message bus -----------------------------------------------------------

function send(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ ok: false, error: chrome.runtime.lastError.message });
      } else {
        resolve(response || { ok: false, error: 'No response from background.' });
      }
    });
  });
}

// --- Init ------------------------------------------------------------------

async function init() {
  // Resolve side-panel / detached-window mode before wiring anything up,
  // so CSS and event handlers behave correctly from the first paint.
  IS_SIDE_PANEL = await detectIsSidePanel();

  if (IS_SIDE_PANEL) {
    document.body.classList.add('sidepanel-mode');
  } else {
    // Apply saved popup size first so there's no flash of default size.
    await applySavedSize();
  }

  // Wire tabs
  qsa('.tab').forEach((tab) => {
    tab.addEventListener('click', () => switchMode(tab.dataset.mode));
  });

  // Load the saved explanation depth level and apply it to the selectors.
  await loadSavedLevel();

  // Wire both level selectors (input view + result view re-level strip).
  setupLevelSelectors();

  // Wire main explain button
  $('explainBtn').addEventListener('click', runExplain);

  // Pin to sidebar
  $('pinSidebar').addEventListener('click', pinToSidebar);

  // New / back buttons
  $('newBtn').addEventListener('click', resetToInput);
  $('errorBack').addEventListener('click', resetToInput);

  // Options links
  $('openOptions').addEventListener('click', openOptions);
  $('openOptionsLink').addEventListener('click', (e) => {
    e.preventDefault();
    openOptions();
  });

  // History "Manage" button -> options page history section
  $('historyManage').addEventListener('click', openOptions);

  // Glossary tab: search + clear
  $('glossarySearch').addEventListener('input', () => renderGlossaryList());
  $('glossaryClear').addEventListener('click', async () => {
    if (!confirm('Clear the whole glossary? This cannot be undone.')) return;
    await send('clearGlossary');
    renderGlossaryList();
  });

  // Chat input
  $('chatSend').addEventListener('click', sendFollowup);
  $('chatInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendFollowup();
    }
  });

  // Image drop + file picker
  setupImageDrop();

  // Resize handle (popup-only — the side panel manages its own size)
  if (!IS_SIDE_PANEL) {
    setupResize();
  }

  // In the side panel (or Arc detached window), this document is long-lived
  // and has to follow the user as they navigate around the browser. Wire up
  // tab-change listeners so the page preview auto-refreshes — without this
  // the preview freezes on whatever tab was active when the panel was opened.
  if (IS_SIDE_PANEL) {
    setupTabChangeListeners();
  }

  // Check credentials for the currently selected provider.
  await updateNoKeyBanner();

  // Wire the profile-empty tip banner + its dismiss button and the
  // in-tip / in-result "add a quick profile" links. Then check the
  // current profile state and show/hide accordingly.
  const dismissBtn = $('dismissProfileTip');
  if (dismissBtn) {
    dismissBtn.addEventListener('click', (e) => {
      e.preventDefault();
      dismissProfileTip();
    });
  }
  const openFromTip = $('openOptionsFromTip');
  if (openFromTip) {
    openFromTip.addEventListener('click', (e) => {
      e.preventDefault();
      openOptions();
    });
  }
  const openFromResultNudge = $('openOptionsFromResultNudge');
  if (openFromResultNudge) {
    openFromResultNudge.addEventListener('click', (e) => {
      e.preventDefault();
      openOptions();
    });
  }

  // If the user fills in their profile from the options page while the
  // popup/sidebar is open, auto-hide the banner + nudge without needing
  // a reload. Same hook keeps things in sync if the dismissal flag is
  // toggled from another surface.
  if (chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync') return;
      if ('profile' in changes || 'profileTipDismissed' in changes) {
        updateProfileNudge();
      }
    });
  }

  await updateProfileNudge();

  // Check for pending input from context menu
  const pending = await send('getPending');
  if (pending.ok && pending.data) {
    await send('clearPending');
    await hydrateFromPending(pending.data);
    return;
  }

  // Default: preload current page preview
  await loadPagePreview();
}

// --- Level (depth) handling ------------------------------------------------

// Load the user's previously-saved explanation depth from chrome.storage.sync
// (where the options page also writes it). Falls back to DEFAULT_LEVEL if
// nothing is saved or the stored value is unrecognized.
async function loadSavedLevel() {
  try {
    const { settings = {} } = await chrome.storage.sync.get('settings');
    const saved = settings?.level;
    state.level = LEVELS.includes(saved) ? saved : DEFAULT_LEVEL;
  } catch {
    state.level = DEFAULT_LEVEL;
  }
  applyLevelToSelectors(state.level);
}

// Wire click handlers for both level selectors — the input-view selector
// (just updates state + persists) and the result-view "Re-level" strip
// (re-runs the explain at the new depth without re-crawling).
function setupLevelSelectors() {
  // Input view: clicking changes the pending level for the NEXT explain.
  const inputSelector = $('levelSelector');
  if (inputSelector) {
    inputSelector.querySelectorAll('.level-option').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const level = btn.dataset.level;
        if (!LEVELS.includes(level)) return;
        state.level = level;
        applyLevelToSelectors(level);
        await persistLevel(level);
      });
    });
  }

  // Result view: clicking re-runs the explain at the new depth, reusing
  // the original input (including crawled deep-dive pages if any).
  const resultStrip = $('resultLevelStrip');
  if (resultStrip) {
    resultStrip.querySelectorAll('.level-option').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const level = btn.dataset.level;
        if (!LEVELS.includes(level)) return;
        if (level === state.level) return; // no-op if same
        if (!state.lastInput) return; // nothing to re-level
        state.level = level;
        applyLevelToSelectors(level);
        await persistLevel(level);
        await runExplainWithInput(state.lastInput);
      });
    });
  }
}

// Mark the matching .level-option button as .active in both selectors.
function applyLevelToSelectors(level) {
  qsa('.level-option').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.level === level);
  });
}

// Persist the level choice into chrome.storage.sync.settings so it
// survives popup/browser restarts and syncs across devices.
async function persistLevel(level) {
  try {
    const { settings = {} } = await chrome.storage.sync.get('settings');
    await chrome.storage.sync.set({
      settings: { ...settings, level }
    });
  } catch (err) {
    console.warn('[LevelWith] failed to persist level', err);
  }
}

// Resolve which browser tab the popup should act on. This is surprisingly
// subtle because the popup document runs in three different contexts:
//
//   1. Action popup (default) — `currentWindow: true` points at the host
//      browser window, so the active web tab is what we want.
//   2. Chrome side panel — the side panel is hosted *inside* the browser
//      window, so `currentWindow: true` likewise returns the active web tab.
//   3. Arc-style detached floating window — the popup is its own
//      `type: 'popup'` window, so `currentWindow: true` returns the detached
//      window itself (whose only tab is our extension page). In that case
//      we use `lastFocusedWindow: true` to find the user's real browser tab.
//
// We also filter out chrome-extension:// tabs so we never return our own
// popup/side-panel page as the "target" tab.
async function resolveTargetTab() {
  // First try: the active tab in whatever counts as "the current window".
  // For the action popup and the in-browser side panel, this is the host
  // window and gives us the right answer directly.
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });
    if (tab && tab.url && !tab.url.startsWith('chrome-extension://')) {
      return tab;
    }
  } catch {
    /* ignore — fall through */
  }

  // Fallback for the Arc detached window: look across all normal browser
  // windows and pick the active tab of the most recently focused one.
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    });
    if (tab && tab.url && !tab.url.startsWith('chrome-extension://')) {
      return tab;
    }
  } catch {
    /* ignore */
  }

  // Last-resort sweep: scan all normal windows manually.
  try {
    const windows = await chrome.windows.getAll({
      populate: true,
      windowTypes: ['normal']
    });
    const focused = windows.find((w) => w.focused) || windows[0];
    const tabs = focused?.tabs || [];
    return (
      tabs.find(
        (t) => t.active && t.url && !t.url.startsWith('chrome-extension://')
      ) || null
    );
  } catch {
    return null;
  }
}

async function loadPagePreview() {
  const preview = $('pagePreview');
  preview.innerHTML = '<em>Reading current tab...</em>';

  const targetTab = await resolveTargetTab();
  if (!targetTab?.id) {
    state.pageData = null;
    preview.innerHTML = `<em style="color:var(--muted)">Couldn't find an active web tab. Open a regular web page in your browser, then come back.</em>`;
    return;
  }

  const res = await send('extractCurrentPage', { tabId: targetTab.id });
  if (!res.ok) {
    preview.innerHTML = `<em style="color:var(--danger)">Couldn't read this tab: ${escapeHtml(res.error)}</em>`;
    state.pageData = null;
    return;
  }

  // Restricted page (chrome://, web store, etc.) — show a friendly notice
  // instead of a cryptic background error.
  if (res.data.restricted) {
    state.pageData = null;
    preview.innerHTML = `<em style="color:var(--muted)">${escapeHtml(res.data.reason || "This page can't be read.")}</em>`;
    return;
  }

  state.pageData = res.data;
  const title = res.data.title || 'Untitled';
  const url = res.data.url || '';
  const wordCount = (res.data.text || '').split(/\s+/).filter(Boolean).length;
  preview.innerHTML = `
    <div><strong>${escapeHtml(title)}</strong></div>
    <div style="margin-top:4px;font-size:11px;word-break:break-all;">${escapeHtml(url)}</div>
    <div style="margin-top:6px;font-size:11px;">${wordCount} words extracted</div>
  `;
}

// Refresh the page preview when the user navigates, switches tabs, or
// focuses a different browser window. Only active in side-panel / detached
// mode — the action popup closes on any such change anyway.
//
// We debounce because `chrome.tabs.onUpdated` in particular can fire many
// times during a single page load (loading, title update, favicon, etc.)
// and we only want the final committed state.
function setupTabChangeListeners() {
  let refreshTimer = null;
  const scheduleRefresh = () => {
    // Only matters if the user is currently on the Page tab. Other tabs
    // (Paste / Ask / Image / History) don't depend on the active browser tab.
    if (state.mode !== 'page') {
      // But clear cached page data so the next visit to Page tab re-reads.
      state.pageData = null;
      return;
    }
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      // Don't trample a result the user is currently reading — just
      // invalidate the cache so the next return to the input view picks up
      // the new page.
      const inputVisible =
        $('inputView') && !$('inputView').classList.contains('hidden');
      state.pageData = null;
      if (inputVisible) loadPagePreview();
    }, 180);
  };

  // User clicked a different tab in the same window.
  chrome.tabs.onActivated.addListener(scheduleRefresh);

  // Tab finished loading or changed URL. Filter aggressively — we don't
  // want to re-read on every favicon update.
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!tab?.active) return;
    if (changeInfo.status === 'complete' || changeInfo.url) {
      scheduleRefresh();
    }
  });

  // User focused a different browser window (e.g. in Arc they switched from
  // the detached sidebar to a normal browser window, or vice versa).
  chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) return;
    scheduleRefresh();
  });
}

async function hydrateFromPending(pending) {
  if (pending.type === 'text') {
    switchMode('text');
    $('textInput').value = pending.text;
  } else if (pending.type === 'page') {
    switchMode('page');
    state.pageData = pending;
    const preview = $('pagePreview');
    preview.innerHTML = `<div><strong>${escapeHtml(pending.title || 'Untitled')}</strong></div>
      <div style="margin-top:4px;font-size:11px;word-break:break-all;">${escapeHtml(pending.url || '')}</div>`;
  }
}

function switchMode(mode) {
  state.mode = mode;
  qsa('.tab').forEach((t) => t.classList.toggle('active', t.dataset.mode === mode));
  qsa('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== mode));

  // The Explain button and the level selector are meaningless on tabs
  // that don't produce explanations (History and Glossary).
  const isBrowseTab = mode === 'history' || mode === 'glossary';
  $('explainBtn').classList.toggle('hidden', isBrowseTab);
  const levelSelector = $('levelSelector');
  if (levelSelector) levelSelector.classList.toggle('hidden', isBrowseTab);

  if (mode === 'page') {
    // In the long-lived sidebar, always re-read when the user lands on
    // the Page tab — the active browser tab may have changed since last
    // time. In the transient popup, only load if we don't have data yet.
    if (IS_SIDE_PANEL || !state.pageData) {
      state.pageData = null;
      loadPagePreview();
    }
  }
  if (mode === 'history') {
    renderHistoryList();
  }
  if (mode === 'glossary') {
    renderGlossaryList();
  }
}

// --- Image handling --------------------------------------------------------

function setupImageDrop() {
  const zone = $('imageDrop');
  const fileInput = $('imageFile');

  zone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  });

  ['dragenter', 'dragover'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.add('dragover');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    zone.addEventListener(evt, (e) => {
      e.preventDefault();
      zone.classList.remove('dragover');
    })
  );
  zone.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) handleImageFile(file);
  });
}

function handleImageFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const [meta, base64] = String(dataUrl).split(',');
    const mediaMatch = /data:(.*?);base64/.exec(meta || '');
    const mediaType = mediaMatch?.[1] || 'image/png';

    state.image = { base64, mediaType, name: file.name };

    const preview = $('imagePreview');
    const dropText = $('imageDropText');
    preview.src = dataUrl;
    preview.classList.remove('hidden');
    dropText.classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

// --- Run explain -----------------------------------------------------------

async function runExplain() {
  let input;
  try {
    input = await buildInputFromUi();
  } catch (e) {
    showError(e.message);
    return;
  }
  if (!input) return;

  await runExplainWithInput(input);
}

// Execute an explain request for a given prepared input object. Factored
// out so the re-level buttons on the result view can reuse the same code
// path without re-reading the UI.
async function runExplainWithInput(input) {
  show('loadingView');
  setLoadingText(loadingMessageForLevel(state.level));

  // Deep dive: fetch more same-origin pages from the background before
  // sending the explain request. Only applies to page mode, and only the
  // FIRST time — if we're re-leveling, we already have the crawled pages
  // embedded in state.lastInput.
  if (
    input.type === 'page' &&
    !Array.isArray(input.pages) &&
    $('deepDiveToggle')?.checked &&
    input.url
  ) {
    setLoadingText('Deep diving the site...');
    const crawl = await send('deepDiveCrawl', { rootUrl: input.url });
    if (crawl.ok && Array.isArray(crawl.data?.pages) && crawl.data.pages.length) {
      input.pages = crawl.data.pages;
      setLoadingText(
        `${loadingMessageForLevel(state.level)} (${crawl.data.pages.length} page${crawl.data.pages.length === 1 ? '' : 's'})`
      );
    } else {
      // Crawl failed — fall back to the single-page explain.
      console.warn('[LevelWith] deep dive failed, falling back to single page', crawl?.error);
      setLoadingText(loadingMessageForLevel(state.level));
    }
  }

  // Remember this input so the re-level buttons can re-run it.
  state.lastInput = input;

  // Store the initial conversation so follow-ups have context.
  const { buildInitialUserMessage } = await import('../lib/prompts.js');
  const userContent = buildInitialUserMessage(input);
  state.conversation = [{ role: 'user', content: userContent }];
  state.restored = false;

  const res = await send('explainInitial', { input, level: state.level });
  if (!res.ok) {
    showError(res.error || 'Unknown error');
    return;
  }

  // Append assistant turn to conversation for follow-ups.
  state.conversation.push({
    role: 'assistant',
    content: [{ type: 'text', text: res.data.assistantText }]
  });

  // If the background normalized or clamped the level, trust that value.
  if (res.data.level) {
    state.level = res.data.level;
    applyLevelToSelectors(state.level);
  }

  renderResult(res.data.parsed);
  show('resultView');
}

// Loading-screen microcopy varies by level so the user sees the depth
// they asked for reflected back immediately.
function loadingMessageForLevel(level) {
  switch (level) {
    case 'eli5':
      return "Leveling with you like you're five...";
    case 'pro':
      return 'Leveling with you (pro mode)...';
    case 'expert':
      return 'Leveling with you at expert depth...';
    default:
      return 'Leveling with you...';
  }
}

function setLoadingText(text) {
  const el = document.querySelector('#loadingView .loading-text');
  if (el) el.textContent = text;
}

async function buildInputFromUi() {
  switch (state.mode) {
    case 'page': {
      if (!state.pageData || !state.pageData.text) {
        await loadPagePreview();
      }
      if (!state.pageData || !state.pageData.text) {
        throw new Error("Couldn't read the current tab. Try pasting the text instead.");
      }
      return { type: 'page', ...state.pageData };
    }
    case 'text': {
      const text = $('textInput').value.trim();
      if (!text) throw new Error('Paste something to explain.');
      return { type: 'text', text };
    }
    case 'question': {
      const text = $('questionInput').value.trim();
      if (!text) throw new Error('Type a question first.');
      return { type: 'question', text };
    }
    case 'image': {
      if (!state.image) throw new Error('Drop an image first.');
      const context = $('imageContext').value.trim();
      return {
        type: 'image',
        base64: state.image.base64,
        mediaType: state.image.mediaType,
        text: context
      };
    }
  }
}

// --- Render result ---------------------------------------------------------

function renderResult(parsed) {
  const container = $('resultContent');
  container.innerHTML = '';

  $('restoredBadge').classList.toggle('hidden', !state.restored);

  if (!parsed) {
    container.innerHTML = '<div class="section"><p>No response.</p></div>';
    return;
  }

  if (parsed.tldr) {
    container.appendChild(
      section('TL;DR', `<p>${escapeHtml(parsed.tldr)}</p>`, 'tldr')
    );
  }

  if (parsed.what_it_is) {
    container.appendChild(
      section('What it actually is', `<p>${escapeHtml(parsed.what_it_is)}</p>`)
    );
  }

  if (parsed.analogy) {
    container.appendChild(
      section('An analogy for you', `<p>${escapeHtml(parsed.analogy)}</p>`)
    );
  }

  if (Array.isArray(parsed.examples) && parsed.examples.length) {
    const items = parsed.examples.map((e) => `<li>${escapeHtml(e)}</li>`).join('');
    container.appendChild(section('How you might use it', `<ul>${items}</ul>`));
  }

  if (Array.isArray(parsed.jargon) && parsed.jargon.length) {
    const items = parsed.jargon
      .map(
        (j) =>
          `<div class="jargon-item"><span class="jargon-term">${escapeHtml(
            j.term || ''
          )}</span> — <span class="jargon-def">${escapeHtml(j.definition || '')}</span></div>`
      )
      .join('');
    container.appendChild(
      section('Jargon decoder', `<div class="jargon-list">${items}</div>`)
    );
  }

  if (parsed.red_flags && parsed.red_flags.trim()) {
    container.appendChild(
      section('Red flags', `<p>${escapeHtml(parsed.red_flags)}</p>`, 'red-flags')
    );
  }

  // Render the suggested follow-up questions (if any) as clickable chips
  // above the chat input.
  renderFollowupChips(parsed.followups);

  // Reset chat area for a fresh conversation.
  $('chatHistory').innerHTML = '';
  $('chatInput').value = '';

  // Show the "add a quick profile" nudge at the bottom of the result
  // view if the profile is still empty — this is where the cost of
  // generic examples is most tangible, so the nudge lands where it
  // actually motivates action. Fire-and-forget.
  updateProfileNudge();
}

// Render 2-3 suggested follow-up questions as pill chips. Clicking a chip
// drops the question into the chat input and fires it immediately.
function renderFollowupChips(followups) {
  const container = $('followupChips');
  if (!container) return;
  container.innerHTML = '';

  const items = Array.isArray(followups)
    ? followups
        .map((f) => String(f || '').trim())
        .filter((f) => f.length > 0)
        .slice(0, 3)
    : [];

  if (!items.length) {
    container.classList.add('hidden');
    return;
  }

  items.forEach((q) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'followup-chip';
    chip.textContent = q;
    chip.addEventListener('click', () => {
      $('chatInput').value = q;
      sendFollowup();
    });
    container.appendChild(chip);
  });
  container.classList.remove('hidden');
}

function section(title, innerHtml, extraClass = '') {
  const div = document.createElement('div');
  div.className = 'section ' + extraClass;
  div.innerHTML = `<h4>${title}</h4>${innerHtml}`;
  return div;
}

// --- Follow-up chat --------------------------------------------------------

async function sendFollowup() {
  const input = $('chatInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';

  appendChatBubble('user', text);
  state.conversation.push({
    role: 'user',
    content: [{ type: 'text', text }]
  });

  appendChatBubble('assistant', '…', true);
  const res = await send('explainFollowup', { messages: state.conversation });

  // Remove the placeholder bubble
  const hist = $('chatHistory');
  const placeholder = hist.querySelector('.assistant.placeholder');
  if (placeholder) placeholder.remove();

  if (!res.ok) {
    appendChatBubble('assistant', `Error: ${res.error}`);
    return;
  }

  const assistantText = res.data.assistantText;
  state.conversation.push({
    role: 'assistant',
    content: [{ type: 'text', text: assistantText }]
  });

  // For follow-ups, prefer a readable summary rather than the full JSON.
  const parsed = res.data.parsed;
  const reply = followupPlainText(parsed, assistantText);
  appendChatBubble('assistant', reply);
}

function followupPlainText(parsed, fallback) {
  if (!parsed) return fallback;
  const parts = [];
  if (parsed.tldr) parts.push(parsed.tldr);
  if (parsed.what_it_is) parts.push(parsed.what_it_is);
  if (parsed.analogy) parts.push('Analogy: ' + parsed.analogy);
  if (Array.isArray(parsed.examples) && parsed.examples.length) {
    parts.push('Examples: ' + parsed.examples.join(' | '));
  }
  return parts.join('\n\n') || fallback;
}

function appendChatBubble(role, text, placeholder = false) {
  const hist = $('chatHistory');
  const div = document.createElement('div');
  div.className = 'chat-msg ' + role + (placeholder ? ' placeholder' : '');
  div.textContent = text;
  hist.appendChild(div);
  hist.scrollTop = hist.scrollHeight;
}

// --- History tab -----------------------------------------------------------

const MODE_ICONS = {
  page: '🌐',
  text: '📋',
  question: '❓',
  image: '🖼'
};

async function renderHistoryList() {
  const listEl = $('historyList');
  const emptyEl = $('historyEmpty');
  listEl.innerHTML = '';

  const { history = [] } = await chrome.storage.local.get('history');
  if (!history.length) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  history.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.id = entry.id;
    item.innerHTML = `
      <div class="history-icon">${MODE_ICONS[entry.mode] || '•'}</div>
      <div class="history-body">
        <div class="history-title">${escapeHtml(entry.title || 'Untitled')}</div>
        <div class="history-snippet">${escapeHtml(entry.snippet || '')}</div>
        <div class="history-meta">${formatRelative(entry.timestamp)}</div>
      </div>
    `;
    item.addEventListener('click', () => restoreHistoryEntry(entry));
    listEl.appendChild(item);
  });
}

function restoreHistoryEntry(entry) {
  state.conversation = Array.isArray(entry.initialMessages)
    ? entry.initialMessages.map((m) => ({ ...m }))
    : [];
  state.restored = true;
  // If the saved entry has a depth level, honor it so the re-level
  // strip and the level selector reflect what was used originally.
  if (entry.level && LEVELS.includes(entry.level)) {
    state.level = entry.level;
    applyLevelToSelectors(state.level);
  }
  // Restored entries don't carry the original input object, so the
  // re-level buttons have nothing to act on until the user runs a
  // fresh explain. Clear lastInput so we don't accidentally re-run
  // a stale one from a previous session.
  state.lastInput = null;
  renderResult(entry.parsed);
  show('resultView');
}

// --- Glossary tab ----------------------------------------------------------

// Render the saved jargon glossary. Supports optional substring search via
// the #glossarySearch input — matches against both term and definition.
async function renderGlossaryList() {
  const listEl = $('glossaryList');
  const emptyEl = $('glossaryEmpty');
  if (!listEl || !emptyEl) return;
  listEl.innerHTML = '';

  const res = await send('getGlossary');
  const all = res.ok && Array.isArray(res.data) ? res.data : [];

  const query = ($('glossarySearch')?.value || '').trim().toLowerCase();
  const filtered = query
    ? all.filter((entry) => {
        const term = (entry?.term || '').toLowerCase();
        const def = (entry?.definition || '').toLowerCase();
        return term.includes(query) || def.includes(query);
      })
    : all;

  if (!filtered.length) {
    listEl.classList.add('hidden');
    emptyEl.classList.remove('hidden');
    emptyEl.textContent = all.length
      ? `No terms match "${query}".`
      : "No jargon saved yet. Explain something with buzzwords and LevelWith will start building your glossary.";
    return;
  }
  emptyEl.classList.add('hidden');
  listEl.classList.remove('hidden');

  filtered.forEach((entry) => {
    const item = document.createElement('div');
    item.className = 'glossary-item';

    const count = entry.count || 1;
    const source = Array.isArray(entry.sources) ? entry.sources[0] : null;
    const sourceHtml = source && (source.title || source.url)
      ? `<a class="glossary-source" href="${escapeHtml(source.url || '#')}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(source.url || '')}">${escapeHtml(source.title || source.url || '')}</a>`
      : '';

    item.innerHTML = `
      <div class="glossary-term">
        ${escapeHtml(entry.term || '')}
        ${count > 1 ? `<span class="glossary-count">${count}×</span>` : ''}
      </div>
      <div class="glossary-def">${escapeHtml(entry.definition || '')}</div>
      <div class="glossary-meta">
        <span>${formatRelative(entry.lastSeen || entry.firstSeen)}</span>
        ${sourceHtml ? `<span class="glossary-meta-sep">•</span>${sourceHtml}` : ''}
      </div>
    `;
    listEl.appendChild(item);
  });
}

function formatRelative(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const sec = Math.round(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? '' : 's'} ago`;
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });
  } catch {
    return '';
  }
}

// --- Resize handle ---------------------------------------------------------

async function applySavedSize() {
  try {
    const { popupSize } = await chrome.storage.sync.get('popupSize');
    if (popupSize && popupSize.width && popupSize.height) {
      const w = clamp(popupSize.width, MIN_W, MAX_W);
      const h = clamp(popupSize.height, MIN_H, MAX_H);
      document.body.style.width = w + 'px';
      document.body.style.height = h + 'px';
    }
  } catch (e) {
    console.warn('[LevelWith] failed to load saved popup size', e);
  }
}

function setupResize() {
  const handle = $('resizeHandle');
  if (!handle) return;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let startW = 0;
  let startH = 0;
  let saveTimer = null;

  handle.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    startX = e.clientX;
    startY = e.clientY;
    startW = document.body.offsetWidth;
    startH = document.body.offsetHeight;
    document.body.style.userSelect = 'none';
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const newW = clamp(startW + (e.clientX - startX), MIN_W, MAX_W);
    const newH = clamp(startH + (e.clientY - startY), MIN_H, MAX_H);
    document.body.style.width = newW + 'px';
    document.body.style.height = newH + 'px';
  });

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try {
      handle.releasePointerCapture(e.pointerId);
    } catch {}
    document.body.style.userSelect = '';

    // Debounce the save a touch so rapid resizes don't spam storage.
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const size = {
        width: document.body.offsetWidth,
        height: document.body.offsetHeight
      };
      try {
        await chrome.storage.sync.set({ popupSize: size });
      } catch (err) {
        console.warn('[LevelWith] failed to save popup size', err);
      }
    }, 150);
  };

  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

// --- Misc ------------------------------------------------------------------

function resetToInput() {
  state.conversation = [];
  state.restored = false;
  $('chatHistory').innerHTML = '';
  show('inputView');
  // The result view just went away, so the contextual profile nudge
  // that lives inside it needs to get hidden too. The input-view
  // banner may still be appropriate — updateProfileNudge handles both.
  updateProfileNudge();
  // In the long-lived sidebar/detached window, the user may have navigated
  // the browser since their last explanation — re-read the active tab so
  // they don't see stale preview data.
  if (IS_SIDE_PANEL && state.mode === 'page') {
    state.pageData = null;
    loadPagePreview();
  }
}

// --- Profile-empty nudge ---------------------------------------------------
//
// LevelWith still works without an "About Me" profile, but the whole
// personalization story falls flat without one — analogies and examples
// default to generic "you" scenarios. So when the profile is empty AND
// the user hasn't explicitly dismissed the tip, we show a soft banner on
// the input view and a contextual nudge on the result view (which is
// where the cost of generic examples is most visible).
//
// Dismissal is persisted in chrome.storage.sync under `profileTipDismissed`
// so it survives restarts and syncs across devices — if the user says
// "no thanks" once, they shouldn't see it again.

// A profile counts as "empty" if none of the text fields have any content.
// `techLevel` is a select with a default value, so it doesn't count toward
// "has any info" on its own.
function isProfileEmpty(profile) {
  if (!profile || typeof profile !== 'object') return true;
  const textFields = ['work', 'hobbies', 'knowsWell', 'analogyStyle'];
  return textFields.every((f) => {
    const v = profile[f];
    return typeof v !== 'string' || v.trim().length === 0;
  });
}

// Read the profile + dismissal flag from sync storage and update both
// the input-view banner and the result-view nudge accordingly.
async function updateProfileNudge() {
  try {
    const { profile = {}, profileTipDismissed = false } =
      await chrome.storage.sync.get(['profile', 'profileTipDismissed']);

    const empty = isProfileEmpty(profile);

    // Input-view banner: only visible if empty AND not dismissed.
    const banner = $('profileTip');
    if (banner) {
      const shouldShow = empty && !profileTipDismissed;
      banner.classList.toggle('hidden', !shouldShow);
    }

    // Result-view nudge: only visible when we're actually on the result
    // view AND the profile is empty. We intentionally show this even if
    // the banner was dismissed — the user is looking at generic examples
    // right now, which is a more motivating moment than the input view.
    const nudge = $('resultProfileNudge');
    if (nudge) {
      const resultVisible = !$('resultView').classList.contains('hidden');
      const shouldShow = empty && resultVisible;
      nudge.classList.toggle('hidden', !shouldShow);
    }
  } catch (err) {
    console.warn('[LevelWith] updateProfileNudge failed', err);
  }
}

// Persist the dismissal and hide the banner. The contextual result-view
// nudge is unaffected — that one is tied to whether the user is currently
// looking at generic output, not to the dismissal flag.
async function dismissProfileTip() {
  try {
    await chrome.storage.sync.set({ profileTipDismissed: true });
  } catch (err) {
    console.warn('[LevelWith] failed to persist profile tip dismissal', err);
  }
  const banner = $('profileTip');
  if (banner) banner.classList.add('hidden');
}

async function updateNoKeyBanner() {
  try {
    const sync = await chrome.storage.sync.get('providerConfig');
    const local = await chrome.storage.local.get([
      'apiKey',
      'claudeKey',
      'openaiKey',
      'ollamaKey'
    ]);
    const provider = sync.providerConfig?.provider || 'claude';

    let missing = false;
    let label = '';
    if (provider === 'claude') {
      missing = !(local.claudeKey || local.apiKey);
      label = 'Anthropic API key';
    } else if (provider === 'openai') {
      missing = !local.openaiKey;
      label = 'OpenAI API key';
    } else if (provider === 'ollama') {
      const ollamaCfg = sync.providerConfig?.ollama || {};
      if (!ollamaCfg.baseUrl) {
        missing = true;
        label = 'Ollama base URL';
      } else if (isOllamaCloudModelLocal(ollamaCfg.model) && !local.ollamaKey) {
        // Cloud model selected but no API key — the request will 401 later.
        // Surface it now so the user isn't surprised.
        missing = true;
        label = `Ollama API key (for cloud model "${ollamaCfg.model}")`;
      }
    }

    const banner = $('noKey');
    if (missing) {
      banner.innerHTML = `No ${escapeHtml(label)} set for the current provider. <a href="#" id="openOptionsLink">Open settings</a> to configure it.`;
      banner.classList.remove('hidden');
      // The link was replaced — re-bind.
      const link = $('openOptionsLink');
      if (link) {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          openOptions();
        });
      }
    } else {
      banner.classList.add('hidden');
    }
  } catch (err) {
    console.warn('[LevelWith] updateNoKeyBanner failed', err);
  }
}

function openOptions() {
  // chrome.runtime.openOptionsPage() silently no-ops in some Chromium
  // browsers (Arc, certain Brave builds), so open the options page
  // directly as a new tab — this is always reliable for extension URLs.
  const url = chrome.runtime.getURL('options/options.html');
  try {
    chrome.tabs.create({ url });
  } catch (e) {
    window.open(url, '_blank');
  }
  if (!IS_SIDE_PANEL) window.close();
}

async function pinToSidebar() {
  // Safety guard: if we're already inside the side panel or the detached
  // floating window, this button is a no-op. The CSS should hide it in
  // those cases, but this protects against the button ever leaking through
  // (e.g. if detection raced with a click).
  if (IS_SIDE_PANEL) return;

  // 1. Try the native Chrome Side Panel API first (Chrome, Edge, Brave).
  //    Arc's Chromium build exposes the namespace but doesn't actually
  //    render the panel, so we treat silent-no-op or throw as failure.
  if (chrome.sidePanel && typeof chrome.sidePanel.open === 'function') {
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
      if (tab) {
        await chrome.sidePanel.setOptions({
          tabId: tab.id,
          path: 'popup/popup.html#sidepanel',
          enabled: true
        });
        // This call requires a user gesture — the pin click counts.
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
        return;
      }
    } catch (err) {
      console.warn('[LevelWith] sidePanel.open failed, falling back to detached window', err);
    }
  }

  // 2. Fallback: floating detached window (works in Arc).
  try {
    await openDetachedSidebar();
  } catch (err) {
    console.error('[LevelWith] detached sidebar failed', err);
    showError(
      "Couldn't open the sidebar. Details: " + (err.message || String(err))
    );
  }
}

async function openDetachedSidebar() {
  // If a detached sidebar is already open, focus it instead of spawning
  // another one.
  const { detachedSidebarId } = await chrome.storage.local.get('detachedSidebarId');
  if (detachedSidebarId != null) {
    try {
      await chrome.windows.update(detachedSidebarId, {
        focused: true,
        drawAttention: true
      });
      window.close();
      return;
    } catch {
      // Stored ID is stale — clean up and open a new one.
      await chrome.storage.local.remove('detachedSidebarId');
    }
  }

  // Figure out where to place the sidebar — anchored to the right edge
  // of whatever normal browser window the user is currently in.
  const normalWindows = await chrome.windows.getAll({
    windowTypes: ['normal']
  });
  const main =
    normalWindows.find((w) => w.focused) ||
    normalWindows[0] ||
    (await chrome.windows.getCurrent());

  const width = 420;
  const height = Math.min(780, Math.max(500, (main?.height || 720) - 40));
  const left = Math.max(
    0,
    (main?.left || 0) + (main?.width || 1280) - width - 16
  );
  const top = Math.max(0, (main?.top || 0) + 48);

  const newWin = await chrome.windows.create({
    url: chrome.runtime.getURL('popup/popup.html#sidepanel'),
    type: 'popup',
    width,
    height,
    left,
    top,
    focused: true
  });

  if (newWin?.id != null) {
    await chrome.storage.local.set({ detachedSidebarId: newWin.id });
  }
  window.close();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', init);
