# LevelWith — Chrome Web Store Listing

_Positioning: generalist, profile-led. The hook is personalization — LevelWith tailors every explanation to who you actually are._

---

## Store listing quick-reference (for the CWS dashboard "Additional fields")

- **Official URL:** `https://levelwith.io`
- **Privacy policy URL:** `https://levelwith.io/privacy` _(or the GitHub Pages URL if hosting there first)_
- **Support email:** `eric@brightspark-tech.app` _(or `support@levelwith.io` once the Cloudflare Email Routing forwarder is set up)_

---

## Name (as shown in the store)

**LevelWith — personalized plain-English explainer**

> Internal name (manifest `name`): `LevelWith — plain-English explainer`
> Short name (manifest `short_name`): `LevelWith`

---

## Short description (132 char max)

> Use this as the `description` field in the store listing. Under the 132-char cap.

**Primary pick (128 chars):**
Plain-English explanations of any web page, article, or jargon — tailored to your work, hobbies, and how you actually think.

**Alternate A (130 chars):**
Tailored plain-English explanations for any web page or selection. Analogies and examples shaped around who you actually are.

**Alternate B (127 chars):**
Explains any page, article, or bit of jargon in plain English — with analogies tuned to your work, hobbies, and interests.

---

## Long description (store "detailed description" field)

> Use the below verbatim. Markdown-style bullets are fine in the store — the CWS renderer preserves line breaks.

**Let me level with you.**

The web is full of writing pitched at someone else. Medical sites assume you're a clinician. Financial pages assume you already know what a convexity adjustment is. Developer docs assume you've been in the ecosystem for five years. LevelWith reads whatever you're looking at and explains it the way a smart, patient friend would — in plain English, at the depth you ask for, and tailored to who you actually are.

**What makes LevelWith different**

LevelWith has a lightweight "About Me" profile — your work, your hobbies, how you prefer to learn — and it uses that profile to shape every explanation. If you're a dentist reading a paper about AI, the analogies come from the operatory. If you're a woodworker reading about machine learning, the examples come from the shop. If you're a parent trying to understand a mortgage document, the scenarios are grounded in your life, not a generic "a business might…" template.

You can still use LevelWith without filling in a profile — it just gets noticeably sharper when you do.

**Four ways to ask**

- **Explain this page** — one click on any article, docs page, or blog post
- **Explain this selection** — highlight any paragraph, right-click, and get a plain-English read
- **Explain this screenshot** — drop in an image of a chart, slide, or document (vision-capable models)
- **Just ask a question** — type anything directly, like "what is a SAFE note, and when would I actually care?"

**Pick your depth**

Every explanation comes with four depth settings: **ELI5** (explain it to a curious kid), **Adult** (smart generalist, no jargon), **Pro** (working professional in the field), and **Expert** (you already know the basics and want the nuance). Switch depths on any result and LevelWith re-explains at the new level in place.

**What you get back**

Every explanation is structured — not a wall of text. You'll see a TL;DR, what the thing actually is, an analogy drawn from your profile, concrete ways you might use it, a jargon decoder for any terms that tripped you up, and (when the source warrants it) a "red flags" section calling out claims to be skeptical of. Plus suggested follow-up questions and a chat box for anything else.

**Your glossary grows with you**

Every time LevelWith decodes a jargon term for you, it adds it to a personal glossary you can search later. Your own custom dictionary of everything you've learned, searchable from the popup.

**Bring your own API key — you stay in control**

LevelWith works with Anthropic (Claude), OpenAI (GPT), and Ollama (local or Ollama Cloud). You supply the API key; LevelWith talks directly to the model provider from your browser. We don't operate a server. We don't proxy your prompts. We don't see what you're reading. Your data goes from your machine to your chosen model provider and nowhere else.

**Privacy-first by design**

- No LevelWith backend, no telemetry by default, no analytics SDKs
- Your profile and glossary live in your browser's local storage
- All network traffic goes directly to the LLM provider you chose
- Full source code available for review

**Who it's for**

- Learners reading above their pay grade who want context without dumbing things down
- Professionals crossing into a new domain (doctors reading finance, engineers reading legal, PMs reading research papers)
- Anyone who's tired of Googling acronyms mid-article
- Researchers and analysts who want a second pair of eyes on dense sources

**Getting started**

1. Install LevelWith
2. Open the popup and paste an API key from Anthropic, OpenAI, or your Ollama instance
3. Spend 30 seconds filling in "About Me" — work, hobbies, how you prefer analogies
4. Click the extension on any page and hit Explain

Learn more: **https://levelwith.io**
Questions, feedback, or bug reports: **eric@brightspark-tech.app**

---

## Category

**Primary:** Productivity
**Secondary (if prompted):** Workflow & Planning

---

## Language

English (United States)

---

## Keyword list (for internal reference)

> CWS doesn't have a dedicated keyword field — it ranks on the long description text. These are the phrases to work into the copy and listing naturally, which the above already does.

- plain english explainer
- explain this page
- personalized explanations
- jargon decoder
- ELI5 extension
- tailored analogies
- claude chrome extension
- openai chrome extension
- ollama chrome extension
- bring your own api key
- reading assistant
- BYOK extension
- privacy-first ai extension
- glossary builder

---

## Promo tile taglines (for the 440×280 image)

**Primary:**
> **LevelWith**
> Let me level with you.
> Plain-English explanations, tailored to you.

**Alternate A:**
> **LevelWith**
> The jargon stops here.
> Explanations shaped around who you are.

**Alternate B:**
> **LevelWith**
> Read above your pay grade.
> Without getting lost.

---

## Single-sentence elevator pitch

> For social profiles, the landing page meta description, and "what is this?" situations.

**LevelWith is a Chrome extension that reads whatever you're looking at and explains it in plain English — tailored to your work, your hobbies, and how you actually learn.**

---

## Data handling disclosure (CWS form answers)

When CWS asks you to declare data usage in the submission form, answer as follows. This must match the hosted privacy policy exactly.

- **Personally identifiable information:** Not collected
- **Health information:** Not collected
- **Financial & payment info:** Not collected
- **Authentication information:** Collected (API keys) — used for single-purpose (calling the chosen LLM provider), stored locally, never sold, never transferred to third parties beyond the chosen provider
- **Personal communications:** Not collected
- **Location:** Not collected
- **Web history:** Not collected (LevelWith reads a page only when the user explicitly invokes it)
- **User activity:** Not collected
- **Website content:** Collected on explicit user action — the text or selection the user chooses to explain. Sent directly from the user's browser to their chosen LLM provider. Not stored by LevelWith and not transmitted to any LevelWith-operated server.

**Single purpose statement:**
LevelWith helps users understand web content by sending user-selected text, pages, or images to an LLM provider of the user's choice (Anthropic, OpenAI, or Ollama) and displaying a plain-English explanation.

**Permission justifications:**
- `storage` — persist the user's profile, API keys, explanation depth preference, and glossary in the browser
- `activeTab` — read the current page when the user clicks "Explain this page"
- `scripting` — inject a content script to extract readable text from the active tab on user action
- `contextMenus` — provide the right-click "Explain selection" and "Explain screenshot" entries
- `sidePanel` — allow pinning LevelWith as a side panel for ongoing reading
- `host_permissions` — talk directly to api.anthropic.com, api.openai.com, and the user's configured Ollama host
