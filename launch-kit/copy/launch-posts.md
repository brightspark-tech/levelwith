# LevelWith — Launch post drafts

_Three posts for the beta recruiting phase. All three are written in the honest, un-hyped voice these communities expect. None of them claim the product is finished, changes the world, or replaces anything. They describe what it does, why you built it, and ask for feedback._

---

## 1. Show HN post

**Guidance:** Post on a Tuesday, Wednesday, or Thursday morning Pacific (roughly 7-9am PT). Respond to every comment for at least 6 hours. Do not upvote your own post or ask friends to upvote — HN detects this and will quietly penalize the submission. Be prepared for blunt feedback and take it well.

### Title

> HN caps titles at 80 chars. Keep "Show HN:" prefix exactly as shown.

**Show HN: LevelWith – A Chrome extension that explains web pages at your level**

### URL

`https://chrome.google.com/webstore/detail/...` _(paste CWS URL when live)_

### Text box (below the URL)

Hi HN,

I built LevelWith because I was tired of reading articles that assumed I already knew what the author was talking about. Medical sites assume you're a clinician. Finance pages assume you know what a convexity adjustment is. Developer docs assume you've been in the ecosystem for five years.

LevelWith is a small Chrome extension that reads the page (or a selection, a screenshot, or a typed question) and sends it to an LLM with a structured prompt asking for a plain-English explanation. What makes it different from "summarize this page" extensions is the personalization layer: there's a lightweight "About Me" profile (work, hobbies, how you like to learn) and it shapes every prompt before it goes out. A dentist and a woodworker reading the same machine-learning paper get different analogies.

A few things that matter to me:

- It's bring-your-own-key. You plug in an Anthropic, OpenAI, or Ollama key and the extension talks directly to that provider from your browser. There is no LevelWith backend. I don't see your data because I physically can't.
- There are four depth settings (ELI5 / Adult / Pro / Expert) and you can re-level in place without re-crawling the page.
- Every explanation comes back structured — TL;DR, what-it-is, a tailored analogy, concrete examples, a jargon decoder, optional "red flags" section, and suggested follow-ups.
- Every jargon term it decodes for you gets added to a personal searchable glossary. I didn't expect to love this feature as much as I do.
- It works with local Ollama if you want it entirely offline.

What I'd love feedback on:

1. Does the profile-led personalization actually land for you, or does it feel gimmicky?
2. Is BYOK a viable model in 2026, or should I be thinking about a hosted tier sooner?
3. Anything that seems off, broken, or missing.

Landing page: https://levelwith.io
Privacy policy: https://levelwith.io/privacy

Source is available and contributions are welcome. Happy to answer anything.

– Eric (eric@brightspark-tech.app)

---

## 2. r/chrome_extensions post

**Guidance:** This sub is friendly to new extensions and technical enough to give useful feedback. Don't cross-post to r/chrome — that sub is for Chrome browser issues, not extensions, and you'll get removed. Read the sub's rules before posting; they change.

### Title

**I built LevelWith — a Chrome extension that explains any web page in plain English, tailored to who you are [BYOK: Claude / OpenAI / Ollama]**

### Body

Hey r/chrome_extensions 👋

Sharing a side project I've been working on and would love honest feedback on.

**The one-line pitch:** LevelWith reads whatever web page you're on and explains it at your level, with analogies drawn from a lightweight "About Me" profile you fill out once.

**Why I built it:** I kept finding myself opening 6 tabs mid-article to Google acronyms and losing track of what I was originally reading. Existing "summarize this page" extensions either oversimplify everything or give you the exact same canned summary no matter who you are.

**What's different:**

- **Profile-led prompts.** You write a short profile (work, hobbies, interests, how you like analogies) and it shapes every explanation. The same ML paper gets analogies from a woodworking shop for a hobbyist and from a dental practice for a dentist.
- **Four depth levels** — ELI5, Adult, Pro, Expert — and you can re-level any result in place.
- **Four input modes** — explain current page, explain selection, drop a screenshot, or just type a question.
- **Structured output** — TL;DR, what-it-is, tailored analogy, examples, jargon decoder, red flags, follow-up questions.
- **Growing personal glossary** built from terms it's explained to you.
- **BYOK.** Your Anthropic / OpenAI / Ollama key goes in the extension. The extension talks directly to the provider. No backend, no proxy, no telemetry. I run nothing.

**Install:** [Chrome Web Store link — paste once live]
**Landing page:** https://levelwith.io
**Privacy policy:** https://levelwith.io/privacy

**What I'd especially love feedback on:**

1. Onboarding — is setting up the API key and profile frictionless enough?
2. The personalization — is it actually noticeably better with a profile filled out vs empty?
3. Bugs, especially on edge-case pages (paywalls, SPAs, docs sites)
4. Anything that feels missing

Happy to answer questions in the comments or over email (eric@brightspark-tech.app). Will be responsive for the next several hours. Thanks for taking a look.

---

## 3. Domain-specific subreddit post (template)

**Guidance:** This template is for whichever domain-specific community matches your own background. Pick ONE. Strong options: r/medicine, r/medicalschool, r/law, r/personalfinance, r/fatFIRE, r/artificial, r/MachineLearning, r/singularity (careful, noisy), r/dataengineering, r/sysadmin, r/DevOps. Read each sub's rules first — many prohibit self-promotion unless you have standing in the community, so pick one you already participate in and be upfront that you made it.

### Title

**I built a Chrome extension that explains dense [DOMAIN] content in plain English — with analogies tailored to your background. Looking for beta testers.**

_(Replace [DOMAIN] with e.g. "medical", "legal", "financial", "ML research")_

### Body

Hi everyone,

I've been lurking here for a while and wanted to share something I built that I think some of you might find useful. I'd also really like your feedback because this community is exactly who I had in mind when I started.

**The problem I was trying to solve:** Reading [DOMAIN] content above my level meant constantly tabbing out to look up terms, losing my place, and sometimes just giving up. "Summarize this" tools exist but they either dumb things down to uselessness or give everyone the exact same generic summary.

**What I built:** A Chrome extension called LevelWith that reads whatever you're looking at and explains it in plain English — but _tailored to you_. You fill out a short profile (your work, your interests, how you like to learn), and the extension uses that to shape every explanation. The analogies, the examples, the depth — all adjusted to who you actually are.

**Some specifics that might matter to people here:**

- Four depth levels. "ELI5" through "Expert." You can change the depth on any explanation without re-running it from scratch.
- Structured output: TL;DR, plain definition, analogy grounded in your life, concrete examples, jargon decoder, and a "red flags" section that calls out sketchy claims.
- A growing personal glossary of every term it's ever explained to you, searchable from the popup.
- **BYOK (bring your own key).** You plug in an API key from Anthropic, OpenAI, or your own Ollama server. The extension talks directly to the model. **I don't run a server. I have no way to see what you're reading.** For this community in particular I thought that mattered.
- Works on any page including articles, paywalled abstracts (the selection mode), PDFs opened in Chrome, and dropped screenshots of slides or figures.

**What I need from you:**

1. Please break it. I'd rather find bugs now than at 1,000 users.
2. Tell me if the profile personalization actually helps or feels like marketing fluff.
3. What's missing that would make you actually use this weekly?

I'll be in the comments for the next few hours. Links below. Happy to answer anything — including "why should I trust your extension with my browsing content," which is a fair question I have honest answers to.

- **Install:** [Chrome Web Store link — paste once live]
- **How it works:** https://levelwith.io
- **Privacy policy:** https://levelwith.io/privacy
- **Source code:** [GitHub link]

Thanks for reading. Mods, if this violates the self-promotion rules please remove and accept my apology — happy to repost in a more appropriate format if there is one.

— Eric (eric@brightspark-tech.app)

---

## Launch day checklist

- [ ] Chrome Web Store listing is live and the install link works
- [ ] Landing page at https://levelwith.io loads on mobile and desktop
- [ ] Privacy policy at https://levelwith.io/privacy resolves and matches the CWS disclosure verbatim
- [ ] Your eric@brightspark-tech.app inbox (and/or support@levelwith.io forwarder) is being actively monitored
- [ ] You have a plain-text answer ready for "how do I get an API key" (link to Anthropic console signup + OpenAI platform signup)
- [ ] You have a plain-text answer ready for "how much will this cost me in API credits" (honest answer: roughly $0.002-$0.01 per explanation with Claude Sonnet or GPT-4-class models)
- [ ] GitHub repo README is readable and up-to-date
- [ ] You've installed the published version from the Chrome Web Store on a clean Chrome profile and walked through onboarding yourself
- [ ] You've picked your posting window and blocked 4-6 hours to respond to comments
- [ ] You've written down your kill/proceed criteria in a text file you cannot delete on a whim

Good luck. Don't argue with critics — thank them, ask clarifying questions, ship fixes.
