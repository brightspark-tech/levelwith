// Unified LLM provider layer.
//
// Supports: Anthropic Claude, OpenAI, and Ollama (local or LAN).
// Called from the background service worker. All providers accept the
// same internal message shape (Claude-style content blocks) and return
// a normalized { text, usage, raw } object.
//
// Internal message shape:
//   { role: 'user' | 'assistant',
//     content: [ { type: 'text', text } |
//                { type: 'image', source: { type: 'base64', media_type, data } } ] }

export const PROVIDERS = ['claude', 'openai', 'ollama'];

// Curated model lists. Users pick from these in the options page.
// When Anthropic/OpenAI ship new models we just update this list.
export const CLAUDE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Claude Opus 4.6 (most capable)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (balanced — default)' },
  { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fast)' }
];

export const OPENAI_MODELS = [
  { id: 'gpt-4o', label: 'GPT-4o (balanced, vision)' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini (fast, cheap, vision)' },
  { id: 'gpt-4.1', label: 'GPT-4.1 (most capable)' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 mini (cheap)' },
  { id: 'o4-mini', label: 'o4-mini (reasoning)' }
];

export const PROVIDER_LABELS = {
  claude: 'Anthropic Claude',
  openai: 'OpenAI',
  ollama: 'Ollama (local / LAN)'
};

export const DEFAULT_PROVIDER_CONFIG = {
  provider: 'claude',
  claude: { model: 'claude-sonnet-4-6' },
  openai: { model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://localhost:11434', model: 'llama3.1:8b' }
};

// True when an Ollama model id uses a hosted tag (e.g. "glm-5:cloud"
// or "gpt-oss:120b-cloud"). These models don't run on the user's
// Ollama host at all — they run on Ollama's hosted cloud service,
// which requires an Ollama account API key.
//
// IMPORTANT: Despite what the naming suggests, a cloud model does NOT
// require the local Ollama host to exist or be reachable. LevelWith
// routes cloud-model requests directly to https://ollama.com/api/chat
// so the user's configured base URL is irrelevant for these models.
export function isOllamaCloudModel(model) {
  if (!model) return false;
  const m = String(model).toLowerCase();
  // Typical tag forms: "something:cloud" or "something-cloud".
  // We match on ":cloud" (the common convention) plus any tag that
  // literally ends in "-cloud" to be safe.
  return /:cloud\b/.test(m) || /-cloud$/.test(m);
}

// Hosted endpoint for Ollama Cloud models. Accepts the same /api/chat
// request shape as a local Ollama host, plus `Authorization: Bearer`.
export const OLLAMA_CLOUD_BASE = 'https://ollama.com';

// Main dispatcher. `providerConfig` is the full provider-settings blob
// from chrome.storage.sync; `secrets` is the object of API keys from
// chrome.storage.local (keys: claudeKey, openaiKey, ollamaKey).
export async function callLLM({
  providerConfig,
  secrets,
  system,
  messages,
  maxTokens = 2048
}) {
  const cfg = { ...DEFAULT_PROVIDER_CONFIG, ...(providerConfig || {}) };
  const provider = cfg.provider || 'claude';

  switch (provider) {
    case 'claude':
      return callClaude({
        apiKey: secrets?.claudeKey || secrets?.apiKey, // apiKey for backward compat
        model: cfg.claude?.model || DEFAULT_PROVIDER_CONFIG.claude.model,
        system,
        messages,
        maxTokens
      });
    case 'openai':
      return callOpenAI({
        apiKey: secrets?.openaiKey,
        model: cfg.openai?.model || DEFAULT_PROVIDER_CONFIG.openai.model,
        system,
        messages,
        maxTokens
      });
    case 'ollama':
      return callOllama({
        baseUrl: cfg.ollama?.baseUrl || DEFAULT_PROVIDER_CONFIG.ollama.baseUrl,
        model: cfg.ollama?.model || DEFAULT_PROVIDER_CONFIG.ollama.model,
        // Optional — only required for Ollama Cloud (`:cloud`) models.
        apiKey: secrets?.ollamaKey || '',
        system,
        messages,
        maxTokens
      });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

// --- Claude -----------------------------------------------------------------

const CLAUDE_URL = 'https://api.anthropic.com/v1/messages';

async function callClaude({ apiKey, system, messages, model, maxTokens }) {
  if (!apiKey) {
    throw new Error(
      'No Anthropic API key set. Open LevelWith settings and add one.'
    );
  }

  const response = await fetch(CLAUDE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages // Claude already uses our native shape
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error (${response.status}): ${await errBody(response)}`);
  }

  const data = await response.json();
  const text =
    data?.content?.find((b) => b.type === 'text')?.text || '';
  return { text, usage: data.usage || null, raw: data };
}

// --- OpenAI -----------------------------------------------------------------

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

async function callOpenAI({ apiKey, system, messages, model, maxTokens }) {
  if (!apiKey) {
    throw new Error('No OpenAI API key set. Open LevelWith settings and add one.');
  }

  const oaMessages = [
    { role: 'system', content: system },
    ...messages.map(toOpenAIMessage)
  ];

  // o-series models use max_completion_tokens and don't accept temperature.
  const isOSeries = /^o\d/i.test(model);
  const body = {
    model,
    messages: oaMessages,
    response_format: { type: 'json_object' }
  };
  if (isOSeries) {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
    body.temperature = 0.6;
  }

  const response = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error (${response.status}): ${await errBody(response)}`);
  }

  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content || '';
  return { text, usage: data.usage || null, raw: data };
}

function toOpenAIMessage(m) {
  if (typeof m.content === 'string') return { role: m.role, content: m.content };

  const parts = [];
  for (const block of m.content) {
    if (block.type === 'text') {
      parts.push({ type: 'text', text: block.text });
    } else if (block.type === 'image') {
      parts.push({
        type: 'image_url',
        image_url: {
          url: `data:${block.source?.media_type || 'image/png'};base64,${block.source?.data || ''}`
        }
      });
    }
  }

  // If the message is text-only, flatten to a plain string (OpenAI prefers this).
  if (parts.length === 1 && parts[0].type === 'text') {
    return { role: m.role, content: parts[0].text };
  }
  return { role: m.role, content: parts };
}

// --- Ollama -----------------------------------------------------------------

async function callOllama({ baseUrl, system, messages, model, maxTokens, apiKey }) {
  if (!model) {
    throw new Error('No Ollama model set. Open LevelWith settings.');
  }

  const isCloud = isOllamaCloudModel(model);

  // Cloud models go directly to Ollama's hosted service — the user's
  // local/LAN Ollama host is bypassed entirely because it has no way to
  // authenticate forwarded requests using a client-supplied bearer token.
  // Local models still use the configured base URL (no auth).
  let endpoint;
  if (isCloud) {
    if (!apiKey) {
      throw new Error(
        `The model "${model}" is an Ollama Cloud model and requires an Ollama API key. Open LevelWith settings and paste your key in the Ollama panel (generate one at https://ollama.com/settings/keys).`
      );
    }
    endpoint = OLLAMA_CLOUD_BASE + '/api/chat';
  } else {
    if (!baseUrl) {
      throw new Error('No Ollama base URL set. Open LevelWith settings.');
    }
    endpoint = baseUrl.replace(/\/+$/, '') + '/api/chat';
  }

  const olMessages = [
    { role: 'system', content: system },
    ...messages.map(toOllamaMessage)
  ];

  const headers = { 'Content-Type': 'application/json' };
  // Cloud models require the bearer token. Local hosts ignore it so it's
  // harmless to include if the user happened to set one.
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: olMessages,
        stream: false,
        format: 'json',
        options: { num_predict: maxTokens }
      })
    });
  } catch (err) {
    if (isCloud) {
      throw new Error(
        `Couldn't reach Ollama Cloud at ${OLLAMA_CLOUD_BASE}. Check your internet connection. Details: ${err.message || err}`
      );
    }
    throw new Error(
      `Couldn't reach Ollama at ${baseUrl}. Check the base URL, that Ollama is running, and that the host allows remote connections (set OLLAMA_HOST=0.0.0.0). Details: ${err.message || err}`
    );
  }

  if (!response.ok) {
    const bodyText = await errBody(response);
    // Friendlier 401/403 message specifically for cloud-model auth issues.
    if ((response.status === 401 || response.status === 403) && isCloud) {
      throw new Error(
        `Ollama Cloud rejected the request (${response.status}). This usually means the API key is missing, wrong, or doesn't have access to "${model}". Generate a key at https://ollama.com/settings/keys and paste it into LevelWith settings. Details: ${bodyText}`
      );
    }
    throw new Error(`Ollama error (${response.status}): ${bodyText}`);
  }

  const data = await response.json();
  const text = data?.message?.content || '';
  return {
    text,
    usage: {
      prompt_tokens: data.prompt_eval_count,
      completion_tokens: data.eval_count
    },
    raw: data
  };
}

function toOllamaMessage(m) {
  if (typeof m.content === 'string') return { role: m.role, content: m.content };

  const textParts = [];
  const images = [];
  for (const block of m.content) {
    if (block.type === 'text') {
      textParts.push(block.text);
    } else if (block.type === 'image') {
      if (block.source?.data) images.push(block.source.data);
    }
  }
  const msg = { role: m.role, content: textParts.join('\n\n') };
  if (images.length) msg.images = images;
  return msg;
}

// --- Shared helpers ---------------------------------------------------------

async function errBody(response) {
  try {
    const j = await response.json();
    return j?.error?.message || JSON.stringify(j);
  } catch {
    try {
      return await response.text();
    } catch {
      return response.statusText;
    }
  }
}

// Parse the model's text as the LevelWith JSON schema. Falls back to a
// "what_it_is" block containing the raw text so the UI still renders.
// Function name kept (parseEli5Json) for import stability in background.js.
export function parseEli5Json(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const first = unfenced.indexOf('{');
    const last = unfenced.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      try {
        return JSON.parse(unfenced.slice(first, last + 1));
      } catch {
        /* fall through */
      }
    }
    return {
      tldr: '',
      what_it_is: text,
      analogy: '',
      examples: [],
      jargon: [],
      red_flags: ''
    };
  }
}
