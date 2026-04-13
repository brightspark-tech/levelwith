# LevelWith

> **Let me level with you.** A Chrome extension that explains web pages, articles, and jargon in plain English — shaped around you, not a generic audience.

**[Install from Chrome Web Store](#)** · **[Website](https://levelwith.io)** · **[Privacy Policy](https://levelwith.io/privacy)**

Built by [BrightSpark Technologies, LLC](https://brightspark-tech.app).

---

Point it at any page (a dense docs section, a vague AI product landing page, a contract clause), highlight some confusing text, paste a tweet, drop in a screenshot, or just ask a free-form question. You get back a TL;DR, a no-fluff "what it actually is", an analogy grounded in **your** work and hobbies, concrete examples of how **you'd** use it, a jargon decoder, and an honest "red flags" callout when the source is hiding behind buzzwords.

Pluggable LLM backend — pick **Claude**, **OpenAI**, or **Ollama** (local or cloud). Defaults to `claude-sonnet-4-6`.

## Why LevelWith is different

Most explainer extensions treat every user the same. LevelWith asks once who you are — your work, your hobbies, your tech comfort level, the things you already know — and uses that on every single explanation. A startup founder gets startup analogies. A teacher gets classroom analogies. A climber gets climbing analogies. Same source, three different (and actually useful) explanations.

Three principles:

1. **Personal by default.** The "About you" profile is injected into every prompt. Analogies are drawn from your world, not generic ones.
2. **Honest about marketing fluff.** When a page is vague, overpromising, or hiding pricing, the `red_flags` section calls it out. That's the whole point of "leveling with you."
3. **Bring your own keys.** No backend. No telemetry. Your API keys stay in your browser. You can run it fully local against Ollama if you want.

## Features

- **Explain this page** — reads the active tab's main content and breaks it down
- **Deep dive** — crawls up to ~10 same-origin pages (pricing, features, about, docs) so explanations cover the whole product, not just the landing page
- **Four depth levels** — ELI5, Adult, Pro, Expert — switch on any result and LevelWith re-explains in place
- **Right-click any selection** — "LevelWith: explain this selection" in the context menu
- **Drop a screenshot** — vision-capable models read the image directly (Claude, GPT-4o, llava, llama3.2-vision)
- **Free-form questions** — "what is a vector database?"
- **Follow-up chat** — keep drilling down after the first answer, with starter question chips
- **Personalized analogies** — a one-time "About you" profile shapes every explanation
- **Growing glossary** — every jargon term LevelWith decodes is saved to a searchable personal dictionary
- **History tab** — browse and reopen past explanations; configurable cap
- **Multiple providers** — Claude, OpenAI, or any Ollama instance (local, LAN, or Ollama Cloud)
- **Pin as sidebar** — persistent side panel in Chrome/Edge/Brave; floating detached window in Arc
- **Keyboard shortcut** — `Cmd+Shift+L` (Mac) / `Ctrl+Shift+L` (Windows/Linux)
- **Honest red flags** — calls out vague marketing copy when it sees it

## Install

### From the Chrome Web Store (recommended)

**[Install LevelWith](#)** — free, takes 5 seconds.

> *The Chrome Web Store link will be updated once the listing is approved.*

### From source (developers)

1. Clone this repo.
2. Open `chrome://extensions` in Chrome (or any Chromium browser).
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select this folder.
5. Pin the extension from the puzzle icon in the toolbar.

### Setup

Click the gear icon in the popup (or right-click the extension icon → **Options**) and:

- **Pick a provider:**
  - *Claude* — paste your Anthropic key from [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
  - *OpenAI* — paste your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  - *Ollama* — set the base URL (e.g. `http://localhost:11434`) and pick a model. Click **Test** to ping it and auto-list installed models.
- **Fill in your "About you" profile** — work, hobbies, tech level, things you already understand well. This gets injected into every prompt.

That's it. Visit any page, click the toolbar icon (or `Cmd+Shift+L`), and hit **Level with me**.

## How it works

```
┌───────────────────┐    ┌────────────────────┐    ┌─────────────────────┐
│ Popup / sidepanel │    │ Background worker  │    │ LLM provider        │
│ - input modes     │───▶│ - LLM dispatch     │───▶│ Claude / OpenAI /   │
│ - chat UI         │    │ - page extraction  │    │ Ollama (local/LAN)  │
│ - renders JSON    │◀───│ - deep dive crawl  │◀───│                     │
└───────────────────┘    │ - context menu     │    └─────────────────────┘
         ▲               └────────────────────┘
         │
┌───────────────────┐
│ Options page      │
│ - API keys (local)│
│ - Profile (sync)  │
└───────────────────┘
```

- The popup collects input and renders results. It never calls a provider API directly.
- The background service worker dispatches all LLM calls through `lib/providers.js`, handles the context menu, and runs page extraction via `chrome.scripting.executeScript`.
- The extractor finds `<article>` / `<main>` / the main content area, strips scripts, nav, footers, etc., and sends clean text to the model.
- The system prompt asks the model to respond with a structured JSON object (`tldr`, `what_it_is`, `analogy`, `examples`, `jargon`, `red_flags`) so the popup can render each section cleanly.
- API keys are stored in `chrome.storage.local` (stays on your device). Your profile is stored in `chrome.storage.sync` (synced across your Chrome profile).

## File structure

```
levelwith/
├── manifest.json          Manifest V3
├── background.js          Service worker
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── lib/
│   ├── providers.js       Unified Claude / OpenAI / Ollama wrapper
│   └── prompts.js         System prompt builder
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── LICENSE                MIT
└── README.md              This file
```

## Privacy

LevelWith is BYOK (bring your own key) and has no backend server.

- API keys are stored locally in your browser using `chrome.storage.local` and only sent to the provider you've chosen.
- Page content is only read when you explicitly click the icon or use the context menu.
- No telemetry. No analytics. No tracking. No third-party SDKs.
- All network traffic goes directly from your browser to your chosen LLM provider and nowhere else.

Read the full privacy policy at [levelwith.io/privacy](https://levelwith.io/privacy).

## Customization

- **Change the provider / model**: gear icon → Options → Provider. Curated model lists live in `lib/providers.js`.
- **Adjust the prompt**: edit `lib/prompts.js` — the JSON schema and tone rules live there.
- **Deep dive tuning**: `DEEP_DIVE_MAX_PAGES`, `DEEP_DIVE_PAGE_CHARS`, and the `PRIORITY_PATTERNS` / `PENALTY_PATTERNS` arrays in `background.js` control the crawl.
- **Change max tokens**: `MAX_TOKENS` in `background.js`.
- **Change the keyboard shortcut**: `chrome://extensions/shortcuts`.

## Remote Ollama (e.g. Proxmox container)

To use an Ollama instance running on another machine on your LAN:

1. On the Ollama host, start the server with `OLLAMA_HOST=0.0.0.0` so it listens on all interfaces (by default it only listens on `127.0.0.1`). Restart the Ollama service after setting this.
2. Make sure the host's firewall allows inbound connections to port `11434` from your machine.
3. In LevelWith options, set the base URL to `http://<host-ip>:11434` (e.g. `http://192.168.1.50:11434`) and click **Test** — it hits `/api/tags` and lists available models.
4. Enter the model name (e.g. `llama3.1:8b`). For image mode, use a vision-capable model like `llava` or `llama3.2-vision`.

Note: No authentication is sent. Only do this on a network you trust.

## Pin to sidebar — browser differences

Clicking the pin button in the popup header opens LevelWith as a persistent sidebar. How that looks depends on the browser:

- **Chrome / Edge / Brave (and most Chromium browsers):** opens in the native Chrome Side Panel on the right side of the browser.
- **Arc:** Arc doesn't implement the Chrome Side Panel API, so LevelWith falls back to a floating detached window anchored to the right edge of your current Arc window. It stays open while you navigate and remembers its position.

The fallback is automatic — the button detects which API is available and picks the right approach.

## Contributing

Found a bug? Have a feature idea? Open an issue or submit a pull request. All contributions are welcome.

If you're modifying the prompt or adding a new provider, please test against a few diverse pages (a marketing landing page, a technical docs page, and a news article) to make sure the structured output still parses cleanly.

## License

MIT. © 2026 BrightSpark Technologies, LLC. See [LICENSE](LICENSE).
