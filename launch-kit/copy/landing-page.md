# LevelWith — Landing Page Copy

_For a single-page site: Carrd, Framer, Webflow, or a static index.html. All copy below is drop-in ready. Suggested section order is top-to-bottom as written._

---

## Meta tags

**Canonical URL:** `https://levelwith.io/`

**Title tag:**
LevelWith — Plain-English explanations, tailored to you

**Meta description (155 chars):**
A Chrome extension that explains any web page, article, or bit of jargon in plain English — with analogies tuned to your work, hobbies, and interests.

**Open Graph title:**
LevelWith — Let me level with you.

**Open Graph description:**
The jargon stops here. LevelWith reads what you're looking at and explains it the way a smart, patient friend would — shaped around who you actually are.

**Open Graph URL:** `https://levelwith.io/`
**Open Graph site name:** `LevelWith`
**Twitter card:** `summary_large_image`

**Favicon / social card image:** `icons/icon-128.png` (until a 1200×630 OG image is made)

**Raw `<head>` block (drop into static HTML / Framer / Carrd custom head):**

```html
<link rel="canonical" href="https://levelwith.io/" />
<meta property="og:title" content="LevelWith — Let me level with you." />
<meta property="og:description" content="The jargon stops here. LevelWith reads what you're looking at and explains it the way a smart, patient friend would — shaped around who you actually are." />
<meta property="og:url" content="https://levelwith.io/" />
<meta property="og:site_name" content="LevelWith" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="LevelWith — Let me level with you." />
<meta name="twitter:description" content="The jargon stops here. LevelWith reads what you're looking at and explains it the way a smart, patient friend would — shaped around who you actually are." />
```

---

## HERO SECTION

### Eyebrow (small, all caps, muted)

A CHROME EXTENSION FROM BRIGHTSPARK TECHNOLOGIES

### Headline (H1)

**The web is written for someone else. LevelWith explains it to _you_.**

### Sub-headline

Medical sites assume you're a clinician. Finance pages assume you know what convexity means. LevelWith reads whatever you're looking at and explains it in plain English — at the depth you ask for, with analogies drawn from _your_ work, _your_ hobbies, and how _you_ actually learn.

### Primary CTA button

**Add to Chrome — it's free**
_(links to CWS listing)_

### Secondary CTA (text link below button)

See how it works ↓

### Trust microcopy (under the buttons)

Bring your own API key · No LevelWith backend · No telemetry · Your data never touches our servers

---

## "WHAT IT DOES" SECTION

### Section header

### One click, four ways to ask.

### Three or four feature cards

**📄 Explain this page**
One click on any article, docs page, or blog post. LevelWith extracts the readable content, builds a tailored prompt, and comes back with a structured explanation.

**🔍 Explain this selection**
Highlight any paragraph. Right-click. Get a plain-English read of just the part you're stuck on — without leaving the page.

**🖼 Explain this screenshot**
Drop in an image of a chart, a slide, a diagram, or a dense document. Vision-capable models do the reading for you.

**💬 Just ask**
Type any question directly into the popup. No page required — it works as a pocket explainer for whatever you're curious about.

---

## "WHY IT'S DIFFERENT" SECTION

### Section header

### Most AI tools talk _at_ you. LevelWith talks _with_ you.

### Body copy (prose, not bullets)

The trick isn't bigger models. It's context. LevelWith has a lightweight "About Me" profile — your work, your hobbies, the way you prefer to learn — and it uses that profile to shape every explanation before you see it.

If you're a dentist reading an AI paper, the analogies come from the operatory. If you're a woodworker reading about machine learning, the examples come from the shop. If you're a parent trying to make sense of a mortgage document, the scenarios are grounded in your actual life — not a generic "a business might…" template.

You can absolutely use LevelWith without a profile and it still works. It just gets noticeably sharper when you take 30 seconds to tell it who you are. And your profile lives in your browser, not on a server — we couldn't read it if we wanted to.

---

## "DEPTH CONTROL" SECTION

### Section header

### Four depths. Switch any time.

### Body

Every explanation has a depth slider with four settings:

**ELI5** — explain it to a curious kid
**Adult** — smart generalist, no jargon
**Pro** — working professional in the field
**Expert** — you already know the basics, give me the nuance

Read something at one depth, realize you need more? Click a different level and LevelWith re-explains in place. No back button, no new tab.

---

## "WHAT YOU GET BACK" SECTION

### Section header

### Not a wall of text. A real explanation.

### Body

Every LevelWith response is structured into sections you can skim or dig into:

**TL;DR** — a two-sentence summary if you're short on time
**What it actually is** — the plain-English definition, minus the marketing fluff
**An analogy for you** — drawn from your profile
**How you might use it** — concrete scenarios grounded in your life
**Jargon decoder** — every term that might have tripped you up, defined inline
**Red flags** — if the source makes shaky claims, LevelWith will tell you

Plus suggested follow-up questions and a chat box if you want to keep digging.

---

## "GROWING GLOSSARY" SECTION

### Section header

### Your own personal dictionary of everything you've learned.

### Body

Every jargon term LevelWith decodes for you is quietly added to a personal glossary. Searchable from the popup. It's the dictionary you didn't know you were building as you read — and because it's scoped to things you actually encountered, it's a kind of record of what you've been learning about.

---

## "PRIVACY" SECTION

### Section header

### Privacy isn't a marketing slide. It's the architecture.

### Body copy

LevelWith is "bring your own key." You supply an API key from Anthropic (Claude), OpenAI (GPT), or your own Ollama instance, and LevelWith talks directly to that provider from your browser. There is no LevelWith server, because there is no LevelWith server to have.

- No backend, no proxy, no "LevelWith Cloud"
- No analytics, no telemetry, no third-party trackers
- Your profile and glossary live in your browser's local storage
- All traffic goes directly to the LLM provider you chose
- Full source code available for review

Your data goes from your machine to your chosen model provider and nowhere else. That's not a promise — it's the architecture.

[**Read the full privacy policy →**](/privacy)

---

## "WHO IT'S FOR" SECTION

### Section header

### Built for people who read above their pay grade.

### Body copy (prose, no bullets)

Learners reading technical material and wanting context without being talked down to. Professionals crossing into a new domain — doctors reading finance, engineers reading legal, PMs reading research papers. Anyone who's tired of Googling acronyms mid-article, opening six tabs, and losing the thread of what they were reading in the first place.

If you've ever thought _"I wish someone would just explain this to me like a person,"_ LevelWith is for you.

---

## "HOW TO START" SECTION

### Section header

### Set up in under two minutes.

### Steps (numbered, with small screenshots next to each)

**1. Install LevelWith from the Chrome Web Store**
Click the install button above. Takes about 5 seconds.

**2. Paste an API key**
Open the popup → settings → paste a key from Anthropic, OpenAI, or point it at your Ollama instance.

**3. Fill in "About Me" (optional but recommended)**
Tell LevelWith what you do, what you're into, and how you like to learn. 30 seconds of effort for a noticeable quality jump.

**4. Click Explain on any page**
You're done. Go explain something.

---

## FINAL CTA SECTION

### Section header

### Ready to level with something?

### Subhead

LevelWith is free, private, and works everywhere on the web.

### Primary button

**Add to Chrome**
_(links to CWS listing)_

### Secondary text link

Star us on GitHub

---

## FOOTER

**LevelWith** is a product of **BrightSpark Technologies, LLC**.
Website: [levelwith.io](https://levelwith.io)

Contact: [eric@brightspark-tech.app](mailto:eric@brightspark-tech.app) · [Privacy policy](/privacy) · [GitHub](#)

© 2026 BrightSpark Technologies, LLC
