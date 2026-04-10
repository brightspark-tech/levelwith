// Options page:
//   - Provider picker (Claude / OpenAI / Ollama) + per-provider config
//   - About Me profile (synced)
//   - History settings

import {
  CLAUDE_MODELS,
  OPENAI_MODELS,
  DEFAULT_PROVIDER_CONFIG,
  isOllamaCloudModel
} from '../lib/providers.js';

const PROFILE_FIELDS = ['work', 'hobbies', 'techLevel', 'knowsWell', 'analogyStyle'];

export const DEFAULT_SETTINGS = {
  historyEnabled: true,
  maxHistory: 25
};

function populateModelSelect(selectEl, models, currentId) {
  selectEl.innerHTML = '';
  let matched = false;
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.id === currentId) {
      opt.selected = true;
      matched = true;
    }
    selectEl.appendChild(opt);
  }
  if (!matched && currentId) {
    // Unknown model (maybe set via a newer version) — keep it as an option.
    const opt = document.createElement('option');
    opt.value = currentId;
    opt.textContent = `${currentId} (custom)`;
    opt.selected = true;
    selectEl.appendChild(opt);
  }
}

function showProviderPanel(provider) {
  document.getElementById('claudePanel').classList.toggle('hidden', provider !== 'claude');
  document.getElementById('openaiPanel').classList.toggle('hidden', provider !== 'openai');
  document.getElementById('ollamaPanel').classList.toggle('hidden', provider !== 'ollama');
}

async function load() {
  const local = await chrome.storage.local.get([
    'apiKey',
    'claudeKey',
    'openaiKey',
    'ollamaKey',
    'history'
  ]);
  const sync = await chrome.storage.sync.get([
    'profile',
    'settings',
    'providerConfig'
  ]);

  // Provider config with defaults.
  const cfg = {
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

  document.getElementById('provider').value = cfg.provider;
  showProviderPanel(cfg.provider);

  populateModelSelect(
    document.getElementById('claudeModel'),
    CLAUDE_MODELS,
    cfg.claude.model
  );
  populateModelSelect(
    document.getElementById('openaiModel'),
    OPENAI_MODELS,
    cfg.openai.model
  );

  // Keys — claude falls back to legacy "apiKey" field.
  document.getElementById('claudeKey').value = local.claudeKey || local.apiKey || '';
  document.getElementById('openaiKey').value = local.openaiKey || '';

  document.getElementById('ollamaBaseUrl').value = cfg.ollama.baseUrl || '';
  document.getElementById('ollamaModel').value = cfg.ollama.model || '';
  document.getElementById('ollamaKey').value = local.ollamaKey || '';
  // Show/hide the cloud notice based on whatever's in the model field now.
  updateOllamaCloudNotice();

  // Profile
  const profile = sync.profile || {};
  PROFILE_FIELDS.forEach((f) => {
    const el = document.getElementById(f);
    if (el && profile[f] != null) el.value = profile[f];
  });

  // History settings
  const settings = { ...DEFAULT_SETTINGS, ...(sync.settings || {}) };
  document.getElementById('historyEnabled').checked = !!settings.historyEnabled;
  document.getElementById('maxHistory').value = settings.maxHistory;

  const count = Array.isArray(local.history) ? local.history.length : 0;
  updateHistoryStatus(`${count} entr${count === 1 ? 'y' : 'ies'} stored.`);
}

async function save() {
  const provider = document.getElementById('provider').value;
  const providerConfig = {
    provider,
    claude: {
      model: document.getElementById('claudeModel').value || DEFAULT_PROVIDER_CONFIG.claude.model
    },
    openai: {
      model: document.getElementById('openaiModel').value || DEFAULT_PROVIDER_CONFIG.openai.model
    },
    ollama: {
      baseUrl: normalizeUrl(document.getElementById('ollamaBaseUrl').value),
      model: document.getElementById('ollamaModel').value.trim()
    }
  };

  const claudeKey = document.getElementById('claudeKey').value.trim();
  const openaiKey = document.getElementById('openaiKey').value.trim();
  const ollamaKey = document.getElementById('ollamaKey').value.trim();

  const profile = {};
  PROFILE_FIELDS.forEach((f) => {
    profile[f] = document.getElementById(f).value.trim();
  });

  const historyEnabled = document.getElementById('historyEnabled').checked;
  let maxHistory = parseInt(document.getElementById('maxHistory').value, 10);
  if (!Number.isFinite(maxHistory)) maxHistory = DEFAULT_SETTINGS.maxHistory;
  maxHistory = Math.max(5, Math.min(200, maxHistory));
  document.getElementById('maxHistory').value = maxHistory;

  const settings = { historyEnabled, maxHistory };

  await chrome.storage.local.set({
    claudeKey,
    openaiKey,
    ollamaKey,
    // Keep legacy field in sync for backward compat with other code paths.
    apiKey: claudeKey
  });
  await chrome.storage.sync.set({ profile, settings, providerConfig });

  // Trim history if the cap was lowered.
  const { history = [] } = await chrome.storage.local.get('history');
  if (history.length > maxHistory) {
    await chrome.storage.local.set({ history: history.slice(0, maxHistory) });
  }

  const status = document.getElementById('saveStatus');
  status.textContent = 'Saved.';
  status.classList.add('success');
  setTimeout(() => {
    status.textContent = '';
    status.classList.remove('success');
  }, 2000);

  const { history: freshHistory = [] } = await chrome.storage.local.get('history');
  updateHistoryStatus(
    `${freshHistory.length} entr${freshHistory.length === 1 ? 'y' : 'ies'} stored.`
  );
}

function normalizeUrl(raw) {
  let v = (raw || '').trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'http://' + v;
  return v.replace(/\/+$/, '');
}

async function testOllama() {
  const baseUrl = normalizeUrl(document.getElementById('ollamaBaseUrl').value);
  const model = document.getElementById('ollamaModel').value.trim();
  const apiKey = document.getElementById('ollamaKey').value.trim();
  const statusEl = document.getElementById('ollamaStatus');
  if (!baseUrl) {
    statusEl.textContent = 'Enter a base URL first.';
    statusEl.className = 'status';
    return;
  }
  statusEl.textContent = `Pinging ${baseUrl}...`;
  statusEl.className = 'status';

  const res = await new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'testOllama', baseUrl, model, apiKey },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response || { ok: false, error: 'No response' });
        }
      }
    );
  });

  if (!res.ok) {
    statusEl.textContent = `Connection failed: ${res.error}`;
    statusEl.className = 'status error';
    return;
  }

  const models = res.data?.models || [];
  const warnings = res.data?.warnings || [];
  const testingCloudModel = !!res.data?.testingCloudModel;
  const localHostReachable = res.data?.localHostReachable;

  // Any warning means something failed — cloud auth, missing key, wrong
  // model id, unreachable local host (when the user might still need it).
  // Surface them as a single amber status message.
  if (warnings.length) {
    statusEl.textContent = warnings.join(' ');
    statusEl.className = 'status warning';
    return;
  }

  // Build a success message that reflects what was actually verified.
  const parts = [];
  if (testingCloudModel) {
    parts.push(`Ollama Cloud auth for "${model}" verified.`);
  }
  if (localHostReachable === true) {
    if (models.length) {
      parts.push(
        `Local host ${baseUrl} reachable — ${models.length} model${models.length === 1 ? '' : 's'} available${models.length ? ': ' + models.slice(0, 5).join(', ') + (models.length > 5 ? '...' : '') : ''}.`
      );
    } else {
      parts.push(
        `Local host ${baseUrl} reachable but no models installed. Run \`ollama pull llama3.1:8b\` on the host if you want to use local models.`
      );
    }
  }

  if (!parts.length) {
    // This shouldn't really happen — but guard against an empty success.
    statusEl.textContent = 'Test completed with no results.';
    statusEl.className = 'status';
    return;
  }

  statusEl.textContent = parts.join(' ');
  statusEl.className = 'status success';

  // If the current model field is empty, prefill with the first available
  // local model so the user has something to run against the local host.
  const modelField = document.getElementById('ollamaModel');
  if (!modelField.value.trim() && models[0]) {
    modelField.value = models[0];
    updateOllamaCloudNotice();
  }
}

// Show the cloud-model callout whenever the Ollama model field contains
// a `:cloud` (or `-cloud`) tag, so the user understands why the key field
// is there.
function updateOllamaCloudNotice() {
  const modelField = document.getElementById('ollamaModel');
  const notice = document.getElementById('ollamaCloudNotice');
  if (!modelField || !notice) return;
  const isCloud = isOllamaCloudModel(modelField.value.trim());
  notice.classList.toggle('hidden', !isCloud);
}

async function clearHistory() {
  if (!confirm('Delete all saved explanations? This cannot be undone.')) return;
  await chrome.storage.local.set({ history: [] });
  updateHistoryStatus('History cleared.', 'success');
  setTimeout(() => updateHistoryStatus('0 entries stored.'), 1800);
}

function updateHistoryStatus(text, cls) {
  const el = document.getElementById('historyStatus');
  if (!el) return;
  el.textContent = text;
  el.className = 'status' + (cls ? ' ' + cls : '');
}

function toggleKeyVisibility(inputId, btnId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = 'Hide';
  } else {
    input.type = 'password';
    btn.textContent = 'Show';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  load();

  document.getElementById('save').addEventListener('click', save);
  document.getElementById('clearHistory').addEventListener('click', clearHistory);

  document.getElementById('provider').addEventListener('change', (e) => {
    showProviderPanel(e.target.value);
  });

  document
    .getElementById('toggleClaudeKey')
    .addEventListener('click', () => toggleKeyVisibility('claudeKey', 'toggleClaudeKey'));
  document
    .getElementById('toggleOpenaiKey')
    .addEventListener('click', () => toggleKeyVisibility('openaiKey', 'toggleOpenaiKey'));
  document
    .getElementById('toggleOllamaKey')
    .addEventListener('click', () => toggleKeyVisibility('ollamaKey', 'toggleOllamaKey'));
  document.getElementById('testOllama').addEventListener('click', testOllama);

  // Live update of the cloud-model notice as the user types.
  document
    .getElementById('ollamaModel')
    .addEventListener('input', updateOllamaCloudNotice);

  // Cmd/Ctrl+S saves
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      save();
    }
  });
});
