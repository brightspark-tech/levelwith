# ELI5 Bot — Build Plan

A personal Chrome extension that turns confusing tech/marketing jargon into plain-English explanations tailored to you, powered by the Claude API.

## The product in one sentence

Click the extension (or right-click any selection) and get a TL;DR, a plain-English breakdown, a personalized analogy, and real-world examples — with a follow-up chat for anything still unclear.

## Form factor

Chrome extension (Manifest V3). Works in Chrome, Edge, Brave, Arc. No server to host, no deploy pipeline — you load it unpacked in `chrome://extensions` and it lives in your browser.

## What it accepts as input

1. **Current page** — click the toolbar icon, it reads the active tab, extracts the readable content, and explains it. This is the primary flow for things like `tavus.io/pals`.
2. **Highlighted text** — right-click a selection → "Explain like I'm 5" in the context menu.
3. **Pasted text or free-form question** — open the popup, paste anything, or just type "what is a vector database?"
4. **Screenshot / image** — drag an image into the popup, Claude reads it with vision.
5. **Follow-up chat** — after the first answer, keep asking clarifying questions in the same thread ("wait, what does 'inference' mean here?").

## Output format (what each explanation looks like)

- **TL;DR** — one sentence, no jargon.
- **What it actually is** — 2–3 plain-English sentences.
- **Analogy for you** — one tailored comparison using your profile (e.g. if you like cooking: "it's like a recipe box that…").
- **How you'd use it** — 2–3 concrete examples grounded in things you already do.
- **Jargon decoder** — any acronyms or buzzwords on the page, each with a one-line definition.
- **Red flags / what's missing** — if the source is vague marketing copy, call it out honestly.

## Personalization — the "About Me" profile

A one-time setup screen (the extension's Options page) where you fill in:

- What you do for work / day-to-day
- Hobbies and interests (for analogies)
- Tech comfort level (beginner / intermediate / power user)
- Topics you already understand well (so we don't over-explain those)
- Analogy style preference (cooking? sports? everyday objects? keep it varied?)

Stored locally in `chrome.storage.sync`. Editable anytime. The profile gets injected into the system prompt on every request so every answer is shaped around you.

## Architecture

```
┌─────────────────────┐   ┌──────────────────────┐   ┌──────────────┐
│  Popup (React)      │   │ Background worker    │   │ Claude API   │
│  - input forms      │──▶│ - fetch URL content  │──▶│ (Anthropic)  │
│  - chat UI          │   │ - readability parse  │   │              │
│  - renders answer   │◀──│ - call Claude SDK    │◀──│              │
└─────────────────────┘   │ - manage history     │   └──────────────┘
         ▲                │ - context menu       │
         │                └──────────────────────┘
┌─────────────────────┐            ▲
│  Options page       │            │
│  - API key          │────────────┘
│  - About Me profile │
└─────────────────────┘
```

**Tech stack:**
- Manifest V3 Chrome extension
- Vanilla JS + small HTML/CSS for the MVP (no build step needed). We can upgrade to React later if it gets complex.
- `@anthropic-ai/sdk` called directly from the background service worker
- `Readability.js` (Mozilla, same library Firefox Reader Mode uses) to strip page chrome before sending to Claude
- `chrome.storage.local` for API key, `chrome.storage.sync` for profile and chat history

**No backend server.** The API key lives in your browser's extension storage. Since it's a personal tool only you use, we skip the proxy layer. (If you ever want to share it, we'd add a tiny Vercel function to hide the key — easy addition later.)

## Build phases

**Phase 1 — Scaffold (the skeleton)**
- `manifest.json` with permissions for `activeTab`, `storage`, `contextMenus`, `scripting`
- Options page: API key field + About Me profile form
- Popup shell with a textarea and "Explain" button
- Background worker wired up to call Claude with a hardcoded prompt
- Success criteria: paste text → get a plain-English response back

**Phase 2 — Make it smart**
- Real system prompt that uses the profile and requests the structured output format
- Nice popup UI with sections (TL;DR, Analogy, Examples, Jargon)
- Loading states and error handling (bad key, rate limit, network)

**Phase 3 — The "explain this page" flow**
- Toolbar icon click reads the active tab's URL
- Background worker fetches the page, pipes HTML through Readability
- Sends cleaned text to Claude
- Shows the answer in the popup

**Phase 4 — More inputs**
- Context menu: "Explain like I'm 5" on text selection
- Drag-and-drop image support (Claude vision)
- Free-form question mode

**Phase 5 — Follow-up chat**
- Keep the last N turns of conversation in popup state
- Simple chat UI below the first answer
- "Clear and start over" button

**Phase 6 — Polish**
- Light/dark theme
- Keyboard shortcut (e.g. `Cmd+Shift+E`)
- Save favorite explanations to a local history page
- Export an explanation as markdown

## What's in the folder when we're done

```
eli5-bot/
├── PLAN.md                  (this file)
├── manifest.json
├── background.js            (service worker: API calls, context menu, URL fetch)
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── lib/
│   ├── anthropic.js         (thin wrapper around the Claude SDK)
│   ├── readability.js       (Mozilla Readability, vendored)
│   └── prompts.js           (the ELI5 system prompt)
├── icons/
│   └── icon-16/48/128.png
└── README.md                (install + usage instructions)
```

## Open questions before I start building

1. **API key** — do you already have an Anthropic API key, or should I include instructions in the README for getting one?
2. **Model** — default to `claude-sonnet-4-6` (good balance of quality and cost) or `claude-opus-4-6` (best quality, pricier)?
3. **MVP scope** — want me to build Phase 1–3 first and get you something usable today, then iterate on the richer inputs (images, chat) in a follow-up session? That gets you to "explain this page" the fastest.
