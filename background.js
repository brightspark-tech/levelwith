// Background service worker: handles LLM calls, context menu,
// page extraction, deep-dive crawling, and message passing from the popup.

import {
  callLLM,
  parseEli5Json,
  DEFAULT_PROVIDER_CONFIG,
  isOllamaCloudModel,
  OLLAMA_CLOUD_BASE
} from './lib/providers.js';
import {
  buildSystemPrompt,
  buildInitialUserMessage,
  DEFAULT_LEVEL,
  LEVELS
} from './lib/prompts.js';

const MAX_TOKENS = 2048;

// Cap on how many terms we keep in the local glossary. Oldest-drops-first
// is fine — the glossary is a convenience, not a database.
const MAX_GLOSSARY_TERMS = 500;

const DEFAULT_SETTINGS = {
  historyEnabled: true,
  maxHistory: 25,
  level: DEFAULT_LEVEL
};

function normalizeLevel(level) {
  return LEVELS.includes(level) ? level : DEFAULT_LEVEL;
}

// Deep dive tuning — "Standard" profile: up to ~10 same-origin pages.
const DEEP_DIVE_MAX_PAGES = 10;
const DEEP_DIVE_PAGE_CHARS = 4000;
const DEEP_DIVE_ROOT_CHARS = 6000;

// --- Lifecycle -------------------------------------------------------------

chrome.runtime.onInstalled.addListener(() => {
  // contextMenus.create fails if an ID already exists (e.g. after an
  // update from the old ELI5 IDs), so clear first then (re)create.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'levelwith-selection',
      title: 'LevelWith: explain this selection',
      contexts: ['selection']
    });
    chrome.contextMenus.create({
      id: 'levelwith-page',
      title: 'LevelWith: explain this page',
      contexts: ['page']
    });
  });
});

// --- Context menu ----------------------------------------------------------

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === 'levelwith-selection' && info.selectionText) {
      await chrome.storage.local.set({
        pendingInput: {
          type: 'text',
          text: info.selectionText,
          source: tab?.url || ''
        }
      });
    } else if (info.menuItemId === 'levelwith-page' && tab?.id) {
      const pageData = await extractFromTab(tab.id, tab.url);
      await chrome.storage.local.set({
        pendingInput: {
          type: 'page',
          url: tab.url,
          title: tab.title,
          text: pageData.text,
          restricted: pageData.restricted,
          reason: pageData.reason
        }
      });
    }
    // MV3 can't open the popup programmatically in most cases, so
    // flag that there's something waiting and the user clicks the icon.
    chrome.action.setBadgeText({ text: '1' });
    chrome.action.setBadgeBackgroundColor({ color: '#ea580c' });
  } catch (err) {
    console.error('[LevelWith] context menu error', err);
  }
});

// --- Message handler -------------------------------------------------------

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case 'extractCurrentPage': {
          // The popup/sidepanel now resolves the target tab itself and hands
          // us a tabId, because only the popup knows whether it's running in
          // the normal action popup, the Chrome side panel, or the Arc
          // detached floating window — and each resolves "the active page
          // tab" differently. If no tabId is provided, fall back to the
          // background-side heuristic for backward compatibility.
          let tab = null;
          if (msg.tabId != null) {
            try {
              tab = await chrome.tabs.get(msg.tabId);
            } catch (err) {
              sendResponse({
                ok: false,
                error:
                  "That tab isn't available anymore. Click back on the browser window to refresh."
              });
              break;
            }
          } else {
            tab = await getActiveTab();
          }
          if (!tab?.id) {
            sendResponse({
              ok: false,
              error:
                "Couldn't find an active web tab. Open a regular web page and try again."
            });
            break;
          }
          const data = await extractFromTab(tab.id, tab.url);
          sendResponse({
            ok: true,
            data: {
              url: tab.url,
              title: tab.title,
              text: data.text,
              restricted: !!data.restricted,
              reason: data.reason || ''
            }
          });
          break;
        }

        case 'getPending': {
          const { pendingInput } = await chrome.storage.local.get('pendingInput');
          sendResponse({ ok: true, data: pendingInput || null });
          break;
        }

        case 'clearPending': {
          await chrome.storage.local.remove('pendingInput');
          chrome.action.setBadgeText({ text: '' });
          sendResponse({ ok: true });
          break;
        }

        case 'deepDiveCrawl': {
          // { rootUrl } — crawl same-origin pages and return a list of
          // { url, title, text } objects for the popup to bundle into the
          // explain request.
          const pages = await deepDiveCrawl(msg.rootUrl);
          sendResponse({ ok: true, data: { pages } });
          break;
        }

        case 'explainInitial': {
          const { providerConfig, secrets, profile, settings } = await getSettings();
          // Level can come from the popup per-request, or fall back to the
          // user's saved preference, or finally the built-in default.
          const level = normalizeLevel(msg.level || settings.level);
          const system = buildSystemPrompt(profile, level);
          const userContent = buildInitialUserMessage(msg.input);
          const result = await callLLM({
            providerConfig,
            secrets,
            system,
            messages: [{ role: 'user', content: userContent }],
            maxTokens: MAX_TOKENS
          });
          const parsed = parseEli5Json(result.text);

          if (settings.historyEnabled !== false) {
            try {
              await addHistoryEntry({
                input: msg.input,
                userContent,
                assistantText: result.text,
                parsed,
                level,
                maxHistory: settings.maxHistory || DEFAULT_SETTINGS.maxHistory
              });
            } catch (e) {
              console.warn('[LevelWith] failed to save history', e);
            }
          }

          // Merge any jargon terms into the cross-explanation glossary.
          try {
            await addGlossaryEntries(parsed?.jargon, {
              title: deriveHistoryTitle(msg.input),
              url: msg.input?.url || ''
            });
          } catch (e) {
            console.warn('[LevelWith] failed to update glossary', e);
          }

          // Remember the level the user last used so the popup can restore it.
          try {
            const nextSettings = { ...settings, level };
            await chrome.storage.sync.set({ settings: nextSettings });
          } catch (e) {
            console.warn('[LevelWith] failed to persist level setting', e);
          }

          sendResponse({
            ok: true,
            data: {
              assistantText: result.text,
              parsed,
              level,
              usage: result.usage || null
            }
          });
          break;
        }

        case 'explainFollowup': {
          const { providerConfig, secrets, profile, settings } = await getSettings();
          const level = normalizeLevel(msg.level || settings.level);
          const system = buildSystemPrompt(profile, level);
          const result = await callLLM({
            providerConfig,
            secrets,
            system,
            messages: msg.messages,
            maxTokens: MAX_TOKENS
          });
          const parsed = parseEli5Json(result.text);

          // Follow-ups also contribute to the glossary — if the model
          // decoded a new term mid-conversation, capture it.
          try {
            await addGlossaryEntries(parsed?.jargon, {
              title: 'Follow-up',
              url: ''
            });
          } catch (e) {
            console.warn('[LevelWith] failed to update glossary (followup)', e);
          }

          sendResponse({
            ok: true,
            data: {
              assistantText: result.text,
              parsed,
              level,
              usage: result.usage || null
            }
          });
          break;
        }

        case 'getGlossary': {
          const { jargonGlossary = [] } = await chrome.storage.local.get(
            'jargonGlossary'
          );
          sendResponse({ ok: true, data: jargonGlossary });
          break;
        }

        case 'clearGlossary': {
          await chrome.storage.local.remove('jargonGlossary');
          sendResponse({ ok: true });
          break;
        }

        case 'testOllama': {
          // The options page's Test button. This has to cover two very
          // different deployments:
          //
          //   A. Local / LAN Ollama host with local models
          //      — ping GET {baseUrl}/api/tags to prove the host is
          //        reachable and list installed models.
          //
          //   B. Ollama Cloud model (model id contains ":cloud")
          //      — LevelWith bypasses the user's host entirely and talks
          //        to https://ollama.com/api/chat directly. So the test
          //        should verify auth against THAT endpoint, not against
          //        the local host (the local host plays no role at all
          //        for cloud models).
          //
          // When both apply (user has a local host AND wants to test a
          // cloud model), we still ping /api/tags so the user knows their
          // host is up — but the pass/fail of the cloud auth check is
          // what actually matters for the explain to work.
          const base = (msg.baseUrl || '').replace(/\/+$/, '');
          const apiKey = (msg.apiKey || '').trim();
          const modelToTest = (msg.model || '').trim();
          const testingCloudModel =
            !!modelToTest && isOllamaCloudModel(modelToTest);

          const warnings = [];
          let models = [];
          let localHostReachable = null; // null = not tested, true/false otherwise

          // --- Step 1: ping the local host if a base URL was provided ---
          if (base) {
            try {
              const r = await fetch(base + '/api/tags');
              if (!r.ok) throw new Error('HTTP ' + r.status);
              const data = await r.json();
              models = (data?.models || []).map((m) => m.name).slice(0, 50);
              localHostReachable = true;
            } catch (err) {
              localHostReachable = false;
              // A dead local host is only a hard failure for LOCAL model
              // usage. For cloud-model tests, downgrade it to a warning.
              if (!testingCloudModel) {
                sendResponse({
                  ok: false,
                  error: err.message || String(err)
                });
                break;
              }
              warnings.push(
                `Local host ${base} unreachable (${err.message || err}) — not required for cloud models, but you'll need it for local models.`
              );
            }
          } else if (!testingCloudModel) {
            sendResponse({ ok: false, error: 'Enter a base URL first.' });
            break;
          }

          // --- Step 2: if testing a cloud model, verify auth ---
          if (testingCloudModel) {
            if (!apiKey) {
              warnings.push(
                `"${modelToTest}" is an Ollama Cloud model — paste an Ollama API key below to use it.`
              );
            } else {
              try {
                const chatRes = await fetch(
                  OLLAMA_CLOUD_BASE + '/api/chat',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      Authorization: `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                      model: modelToTest,
                      messages: [{ role: 'user', content: 'ping' }],
                      stream: false,
                      options: { num_predict: 1 }
                    })
                  }
                );
                if (!chatRes.ok) {
                  const body = await chatRes.text().catch(() => '');
                  if (chatRes.status === 401 || chatRes.status === 403) {
                    warnings.push(
                      `Ollama Cloud auth failed (${chatRes.status}). The API key is missing, wrong, or doesn't have access to "${modelToTest}". Regenerate at https://ollama.com/settings/keys.`
                    );
                  } else if (chatRes.status === 404) {
                    warnings.push(
                      `Ollama Cloud doesn't recognize the model "${modelToTest}" (404). Double-check the model id.`
                    );
                  } else {
                    warnings.push(
                      `Cloud chat test failed (${chatRes.status}): ${body.slice(0, 200)}`
                    );
                  }
                }
              } catch (e) {
                warnings.push(
                  `Cloud chat test errored: ${e.message || String(e)}`
                );
              }
            }
          }

          sendResponse({
            ok: true,
            data: { models, warnings, localHostReachable, testingCloudModel }
          });
          break;
        }

        default:
          sendResponse({ ok: false, error: `Unknown message type: ${msg?.type}` });
      }
    } catch (err) {
      console.error('[LevelWith] background error', err);
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true; // keep the message channel open for async sendResponse
});

// --- Helpers ---------------------------------------------------------------

async function getActiveTab() {
  // First try the active tab in the current window. This is correct when
  // the request comes from the normal popup or Chrome's side panel — both
  // share the host browser window, so currentWindow returns a real web tab.
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && !tab.url.startsWith('chrome-extension://')) {
    return tab;
  }

  // Fallback for the Arc-style detached sidebar window: the "current
  // window" is the detached popup itself, and its only tab is our
  // extension page. Find a normal browser window and return its active
  // tab instead.
  const normalWindows = await chrome.windows.getAll({
    populate: true,
    windowTypes: ['normal']
  });
  const focused = normalWindows.find((w) => w.focused) || normalWindows[0];
  if (!focused?.tabs) return tab || null;
  const active = focused.tabs.find((t) => t.active);
  return active || tab || null;
}

// Clean up the stored detached-sidebar id when that window is closed.
chrome.windows.onRemoved.addListener(async (windowId) => {
  try {
    const { detachedSidebarId } = await chrome.storage.local.get('detachedSidebarId');
    if (detachedSidebarId === windowId) {
      await chrome.storage.local.remove('detachedSidebarId');
    }
  } catch (err) {
    console.warn('[LevelWith] onRemoved cleanup failed', err);
  }
});

async function getSettings() {
  const local = await chrome.storage.local.get([
    'apiKey',
    'claudeKey',
    'openaiKey',
    'ollamaKey'
  ]);
  const sync = await chrome.storage.sync.get([
    'profile',
    'settings',
    'providerConfig'
  ]);

  // Backward compat: apiKey was the Anthropic key in v0.1.x.
  const secrets = {
    claudeKey: local.claudeKey || local.apiKey || '',
    openaiKey: local.openaiKey || '',
    // Optional — only needed for Ollama Cloud (`:cloud`) models.
    ollamaKey: local.ollamaKey || ''
  };

  const providerConfig = {
    ...DEFAULT_PROVIDER_CONFIG,
    ...(sync.providerConfig || {}),
    claude: {
      ...DEFAULT_PROVIDER_CONFIG.claude,
      ...(sync.providerConfig?.claude || {})
    },
    openai: {
      ...DEFAULT_PROVIDER_CONFIG.openai,
      ...(sync.providerConfig?.openai || {})
    },
    ollama: {
      ...DEFAULT_PROVIDER_CONFIG.ollama,
      ...(sync.providerConfig?.ollama || {})
    }
  };

  // Per-provider credential check with a friendly error.
  if (providerConfig.provider === 'claude' && !secrets.claudeKey) {
    throw new Error(
      'No Anthropic API key set. Open LevelWith settings (gear icon in the popup) to add one.'
    );
  }
  if (providerConfig.provider === 'openai' && !secrets.openaiKey) {
    throw new Error(
      'No OpenAI API key set. Open LevelWith settings (gear icon in the popup) to add one.'
    );
  }
  if (providerConfig.provider === 'ollama' && !providerConfig.ollama.baseUrl) {
    throw new Error(
      'No Ollama base URL set. Open LevelWith settings to configure Ollama.'
    );
  }
  if (
    providerConfig.provider === 'ollama' &&
    isOllamaCloudModel(providerConfig.ollama.model) &&
    !secrets.ollamaKey
  ) {
    throw new Error(
      `The model "${providerConfig.ollama.model}" is an Ollama Cloud model and requires an Ollama API key. Open LevelWith settings and paste your key in the Ollama panel (generate one at https://ollama.com/settings/keys).`
    );
  }

  const settings = { ...DEFAULT_SETTINGS, ...(sync.settings || {}) };
  return { providerConfig, secrets, profile: sync.profile || {}, settings };
}

// --- History persistence ---------------------------------------------------

async function addHistoryEntry({
  input,
  userContent,
  assistantText,
  parsed,
  level,
  maxHistory
}) {
  const { history = [] } = await chrome.storage.local.get('history');

  // Strip image payloads from stored messages so history stays small.
  const lightUserContent = userContent.map((block) => {
    if (block.type === 'image') {
      return { type: 'text', text: '[Image attached — not stored in history]' };
    }
    return block;
  });

  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    mode: input.type,
    level: normalizeLevel(level),
    title: deriveHistoryTitle(input),
    snippet: deriveHistorySnippet(parsed),
    parsed,
    assistantText,
    initialMessages: [
      { role: 'user', content: lightUserContent },
      { role: 'assistant', content: [{ type: 'text', text: assistantText }] }
    ]
  };

  const next = [entry, ...history].slice(0, Math.max(5, Math.min(200, maxHistory)));
  await chrome.storage.local.set({ history: next });
}

// --- Jargon glossary persistence -------------------------------------------
//
// Every explanation that has a `jargon` array contributes to a cross-
// explanation glossary the user can browse in the Glossary tab. We dedupe
// by lowercased term and keep the most recent definition (models often
// rephrase the same term differently and the latest phrasing is usually
// best tuned to the user's current depth level).

async function addGlossaryEntries(jargonArr, source = {}) {
  if (!Array.isArray(jargonArr) || !jargonArr.length) return;

  const { jargonGlossary = [] } = await chrome.storage.local.get('jargonGlossary');
  const byKey = new Map();
  for (const entry of jargonGlossary) {
    if (entry?.term) byKey.set(entry.term.toLowerCase(), entry);
  }

  const now = Date.now();
  for (const item of jargonArr) {
    const term = String(item?.term || '').trim();
    const definition = String(item?.definition || '').trim();
    if (!term || !definition) continue;
    const key = term.toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      existing.definition = definition; // latest wins
      existing.lastSeen = now;
      existing.count = (existing.count || 1) + 1;
      // Keep a small rolling list of sources for context.
      existing.sources = existing.sources || [];
      if (source?.title || source?.url) {
        existing.sources.unshift({
          title: source.title || '',
          url: source.url || '',
          timestamp: now
        });
        existing.sources = existing.sources.slice(0, 5);
      }
    } else {
      byKey.set(key, {
        term, // preserve original casing on first sighting
        definition,
        firstSeen: now,
        lastSeen: now,
        count: 1,
        sources: source?.title || source?.url ? [{
          title: source.title || '',
          url: source.url || '',
          timestamp: now
        }] : []
      });
    }
  }

  // Newest-first ordering, capped. Simplest is to sort by lastSeen desc.
  const next = [...byKey.values()]
    .sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0))
    .slice(0, MAX_GLOSSARY_TERMS);

  await chrome.storage.local.set({ jargonGlossary: next });
}

function deriveHistoryTitle(input) {
  switch (input.type) {
    case 'page':
      return input.title?.trim() || hostnameFromUrl(input.url) || 'Untitled page';
    case 'text': {
      const t = (input.text || '').trim().replace(/\s+/g, ' ');
      return t.length > 60 ? t.slice(0, 60) + '…' : t || 'Pasted text';
    }
    case 'question': {
      const t = (input.text || '').trim().replace(/\s+/g, ' ');
      return t.length > 60 ? t.slice(0, 60) + '…' : t || 'Question';
    }
    case 'image':
      return 'Image explanation';
    default:
      return 'Explanation';
  }
}

function deriveHistorySnippet(parsed) {
  if (!parsed) return '';
  if (parsed.tldr) return parsed.tldr;
  if (parsed.what_it_is) {
    const t = parsed.what_it_is.trim().replace(/\s+/g, ' ');
    return t.length > 120 ? t.slice(0, 120) + '…' : t;
  }
  return '';
}

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// --- Page extraction -------------------------------------------------------

const RESTRICTED_URL_RE = /^(chrome|chrome-extension|edge|about|brave|arc|view-source|devtools|chrome-search|chrome-untrusted):/i;

function isRestrictedUrl(url) {
  if (!url) return true;
  if (RESTRICTED_URL_RE.test(url)) return true;
  if (/^https:\/\/chromewebstore\.google\.com\//i.test(url)) return true;
  if (/^https:\/\/chrome\.google\.com\/webstore\//i.test(url)) return true;
  return false;
}

async function extractFromTab(tabId, tabUrl) {
  if (isRestrictedUrl(tabUrl)) {
    return {
      text: '',
      restricted: true,
      reason:
        "This is a browser internal page (like chrome://, the Web Store, or a devtools page), so I can't read its contents. Switch to a regular web page, or paste the text into the Paste tab."
    };
  }

  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: extractPageText
    });
    const result = results?.[0]?.result;
    return result || { text: '' };
  } catch (err) {
    const msg = String(err?.message || err);
    if (/chrome:\/\/|Cannot access|No tab with id|Frame with ID/i.test(msg)) {
      return {
        text: '',
        restricted: true,
        reason:
          "I couldn't read this page — it's either a protected browser page or the tab isn't scriptable. Try the Paste or Ask tab instead."
      };
    }
    throw err;
  }
}

// Runs in the page context. Keep this self-contained — no closures.
function extractPageText() {
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.article',
    '.post',
    '.content',
    '#content'
  ];
  let root = null;
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && el.innerText && el.innerText.trim().length > 100) {
      root = el;
      break;
    }
  }
  if (!root) root = document.body;

  const clone = root.cloneNode(true);
  const strip = [
    'script',
    'style',
    'nav',
    'header',
    'footer',
    'aside',
    'noscript',
    'iframe',
    'svg',
    'form',
    'button'
  ];
  strip.forEach((tag) => clone.querySelectorAll(tag).forEach((el) => el.remove()));

  const text = (clone.innerText || clone.textContent || '')
    .replace(/\s+/g, ' ')
    .trim();

  return { text: text.slice(0, 12000) };
}

// --- Deep dive crawl -------------------------------------------------------
//
// Given a root URL, fetch the root page from the service worker (has
// <all_urls> host permission, so no CORS issues) and discover same-origin
// links from nav-like anchors. Prioritize pages that typically describe
// the product (about, pricing, features, docs), fetch a handful of them,
// and return { url, title, text } for each.

async function deepDiveCrawl(rootUrl) {
  let origin;
  try {
    origin = new URL(rootUrl).origin;
  } catch {
    throw new Error('Invalid root URL for deep dive.');
  }

  const visited = new Set();
  const pages = [];

  const rootHtml = await fetchHtml(rootUrl);
  visited.add(canonical(rootUrl));
  pages.push({
    url: rootUrl,
    title: extractTitle(rootHtml),
    text: htmlToText(rootHtml).slice(0, DEEP_DIVE_ROOT_CHARS)
  });

  const links = discoverLinks(rootHtml, rootUrl, origin);
  const prioritized = prioritizeLinks(links);

  for (const link of prioritized) {
    if (pages.length >= DEEP_DIVE_MAX_PAGES) break;
    const key = canonical(link);
    if (visited.has(key)) continue;
    visited.add(key);

    try {
      const html = await fetchHtml(link);
      const text = htmlToText(html).slice(0, DEEP_DIVE_PAGE_CHARS);
      if (text.length < 120) continue; // probably an asset redirect or empty
      pages.push({ url: link, title: extractTitle(html), text });
    } catch {
      // Skip failed fetches quietly — one dead link shouldn't kill the crawl.
    }
  }

  return pages;
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'omit',
    redirect: 'follow',
    headers: { Accept: 'text/html,application/xhtml+xml' }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const ct = res.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml/i.test(ct) && ct) {
    throw new Error('Not HTML');
  }
  return res.text();
}

function canonical(url) {
  try {
    const u = new URL(url);
    u.hash = '';
    // Collapse trailing slash mismatches for dedupe.
    u.pathname = u.pathname.replace(/\/+$/, '') || '/';
    return u.toString();
  } catch {
    return url;
  }
}

function extractTitle(html) {
  const m = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).trim().slice(0, 200) : '';
}

function discoverLinks(html, rootUrl, origin) {
  const out = new Set();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1];
    if (!raw) continue;
    if (/^(#|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    let abs;
    try {
      abs = new URL(raw, rootUrl).toString();
    } catch {
      continue;
    }
    if (new URL(abs).origin !== origin) continue;
    // Skip common asset extensions.
    if (/\.(pdf|png|jpe?g|gif|svg|webp|ico|mp4|mp3|zip|tar|gz|css|js)(\?|#|$)/i.test(abs)) {
      continue;
    }
    out.add(abs);
  }
  return [...out];
}

// Score links by how likely they are to describe the product. Lower = better.
const PRIORITY_PATTERNS = [
  /\/about/i,
  /\/product/i,
  /\/features?/i,
  /\/how(?:-it-)?works?/i,
  /\/use-?cases?/i,
  /\/solution/i,
  /\/pricing/i,
  /\/platform/i,
  /\/docs?/i,
  /\/documentation/i,
  /\/guide/i,
  /\/faq/i,
  /\/overview/i,
  /\/why/i
];

// Strong negative score for pages that rarely help (auth, legal, blogs).
const PENALTY_PATTERNS = [
  /\/(login|signin|signup|register|logout|account|profile|settings|cart|checkout)/i,
  /\/(privacy|terms|legal|cookies?)/i,
  /\/(careers|jobs|press|investor)/i,
  /\/blog\//i, // blog index is fine, individual posts less so
  /\/tag\//i,
  /\/author\//i
];

function prioritizeLinks(links) {
  const scored = links.map((url) => {
    let score = 50;
    const lower = url.toLowerCase();

    // Shorter paths (closer to homepage) are more likely to be navigational.
    const depth = new URL(url).pathname.split('/').filter(Boolean).length;
    score += depth * 3;

    for (let i = 0; i < PRIORITY_PATTERNS.length; i++) {
      if (PRIORITY_PATTERNS[i].test(lower)) {
        score -= 30 - i; // earlier patterns get bigger boost
        break;
      }
    }
    for (const p of PENALTY_PATTERNS) {
      if (p.test(lower)) {
        score += 100;
        break;
      }
    }
    return { url, score };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.url);
}

function htmlToText(html) {
  if (!html) return '';
  // Drop script/style/noscript/nav/header/footer bodies entirely.
  let cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ' ')
    // Keep block-level boundaries so text doesn't glue together.
    .replace(/<\/(p|div|li|h[1-6]|section|article|br)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip any remaining tags.
    .replace(/<[^>]+>/g, ' ');

  cleaned = decodeEntities(cleaned)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      try {
        return String.fromCodePoint(parseInt(n, 10));
      } catch {
        return '';
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      try {
        return String.fromCodePoint(parseInt(h, 16));
      } catch {
        return '';
      }
    });
}
