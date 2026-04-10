# LevelWith Privacy Policy

**Effective date:** April 10, 2026
**Last updated:** April 10, 2026
**Publisher:** BrightSpark Technologies, LLC
**Product website:** [https://levelwith.io](https://levelwith.io)
**Canonical URL for this policy:** [https://levelwith.io/privacy](https://levelwith.io/privacy)
**Contact:** [eric@brightspark-tech.app](mailto:eric@brightspark-tech.app)

---

## The short version

LevelWith is a browser extension that explains web content in plain English. It is designed to be privacy-respecting by architecture:

- **We do not operate a server.** LevelWith has no backend.
- **We do not collect, log, or transmit your data to any LevelWith-operated service.** There is nothing for us to collect.
- **Your API keys and profile stay on your device** in your browser's local storage.
- **When you ask LevelWith to explain something, the text or image you chose is sent directly from your browser to the LLM provider you configured** (Anthropic, OpenAI, or your Ollama instance). That request is subject to the privacy policy of the provider you chose.
- **No analytics, no telemetry, no third-party trackers, no ads.**

If that answers your question, you don't need to read the rest. But the details below are honest, specific, and short.

---

## What LevelWith is

LevelWith is a Chrome browser extension published by BrightSpark Technologies, LLC ("we," "us"). It reads web pages, text selections, screenshots, or typed questions at your explicit request and asks a large-language-model ("LLM") provider of your choice to explain them in plain English, tailored to an optional "About Me" profile you can fill in.

LevelWith is a "bring your own key" (BYOK) tool. You supply your own API credentials for the LLM provider you want to use. LevelWith talks to that provider directly from your browser. There is no LevelWith account, login, or backend service.

---

## What LevelWith stores on your device

LevelWith uses the browser's built-in `chrome.storage` APIs to persist the following on **your device**:

| What | Where | Why |
| --- | --- | --- |
| Your API keys (Anthropic, OpenAI, Ollama) | `chrome.storage.local` | Needed to call the LLM provider you chose |
| Your "About Me" profile (work, hobbies, interests, tech level, analogy preferences) | `chrome.storage.sync` | Used to personalize the prompt sent to the LLM |
| Your provider configuration (which model, Ollama base URL) | `chrome.storage.sync` | Remembers your preferred setup |
| Your explanation depth preference (ELI5, Adult, Pro, Expert) | `chrome.storage.sync` | Remembers how deep you like your explanations |
| Your explanation history (recent explanations, searchable) | `chrome.storage.local` | Powers the "History" tab in the popup |
| Your personal glossary (jargon terms you've had decoded) | `chrome.storage.local` | Powers the "Glossary" tab so you can look things up again |
| UI preferences (popup size, dismissed tips) | `chrome.storage.sync` | Remembers how you like the interface |

`chrome.storage.local` stays on your device. `chrome.storage.sync` is a Chrome-managed feature that syncs data across devices you're signed into Chrome on — that sync is handled by Google, not by LevelWith. If you want to avoid Chrome Sync, you can disable it in your Chrome settings and LevelWith will fall back to local-only storage.

**LevelWith does not have any ability to read this data from outside your browser.** It lives on your machine.

---

## What gets sent to the LLM provider (and only there)

When you click "Explain" — and only then — LevelWith builds a prompt and sends it directly from your browser to the LLM provider's API endpoint. The request includes:

1. A system prompt written by LevelWith that tells the model how to structure its response
2. Your "About Me" profile (if you filled one in) so the model can tailor analogies and examples
3. The content you asked about: the page text, your selection, the typed question, and/or the image you dropped in
4. Your configured explanation depth (ELI5, Adult, Pro, or Expert)

The provider you configured will process that request under their own privacy policy and data-handling terms, which you should read:

- **Anthropic (Claude):** [https://www.anthropic.com/legal/privacy](https://www.anthropic.com/legal/privacy)
- **OpenAI:** [https://openai.com/policies/privacy-policy](https://openai.com/policies/privacy-policy)
- **Ollama (Cloud):** [https://ollama.com/privacy](https://ollama.com/privacy)
- **Ollama (self-hosted):** data stays on whatever machine you configured; no third party is involved

BrightSpark Technologies, LLC has no involvement in or visibility into those requests. We do not proxy them. We do not log them. We do not receive copies of them. They go directly from your browser to the provider you chose.

---

## What LevelWith does not collect

We want to be specific, not hand-wavy:

- No analytics or telemetry events
- No crash reports
- No usage statistics
- No personally identifiable information
- No browsing history
- No cookies set by LevelWith
- No tracking across sites
- No advertising identifiers
- No IP address logging
- No A/B testing
- No third-party SDKs
- No ad networks

LevelWith's extension bundle contains no analytics libraries and makes no outbound network requests except to the LLM provider endpoint you configured (api.anthropic.com, api.openai.com, ollama.com, or your self-hosted Ollama host).

---

## Permissions LevelWith requests, and why

| Permission | Used for |
| --- | --- |
| `storage` | Save your profile, API keys, history, and glossary on your device |
| `activeTab` | Read the current page's text when you click "Explain this page" |
| `scripting` | Inject a content script to extract readable text from the active tab on your explicit action |
| `contextMenus` | Add the right-click "Explain selection" and "Explain screenshot" menu items |
| `sidePanel` | Let you pin LevelWith as a side panel for ongoing reading |
| Host permissions (`api.anthropic.com`, `api.openai.com`, `<all_urls>`) | Talk directly to your LLM provider and read the current page when you invoke LevelWith on it |

LevelWith never reads or sends page content unless you explicitly trigger an explanation.

---

## Children

LevelWith is not directed at children under 13 and we do not knowingly collect any information from children. Because LevelWith collects nothing at all, this is true by construction.

---

## Security

Your API keys are stored in `chrome.storage.local`, which is sandboxed per-extension by the browser. Other extensions cannot read LevelWith's storage. If your device or Chrome profile is compromised, an attacker with that level of access could read the stored keys — the same is true of any other credential you have saved in your browser. If you suspect compromise, revoke the key from your provider's dashboard and generate a new one.

---

## Your rights

Because LevelWith does not collect data, there is no LevelWith-held data to access, export, correct, or delete. To remove everything LevelWith has stored on your device, open Chrome's extension page (`chrome://extensions`), find LevelWith, and click **Remove**. That deletes your profile, API keys, history, glossary, and all preferences.

If you have Chrome Sync enabled, your preferences may still exist on Google's servers as part of your Chrome profile; those are governed by Google's privacy policy, not by LevelWith. Signing out of Chrome Sync or using Chrome's "Clear browsing data" tools will clear them.

---

## Changes to this policy

If we meaningfully change this policy — for example, if LevelWith ever gains a backend service — we will update the "Last updated" date at the top and the "Effective date" if the change is material. Because LevelWith has no backend, we have no way to notify you in-product; we will post changes at the URL where this policy is hosted, and material changes will be called out in the extension's store listing release notes.

---

## Contact

Questions, concerns, or reports: **[eric@brightspark-tech.app](mailto:eric@brightspark-tech.app)**

Website: [https://levelwith.io](https://levelwith.io)

BrightSpark Technologies, LLC
