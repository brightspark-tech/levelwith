# LevelWith Launch Kit

Everything needed to ship LevelWith to the Chrome Web Store and recruit
the first beta cohort. Written for one person working alone on a weekend.

---

## What's in here

```
launch-kit/
├── README.md                        ← you are here
├── copy/
│   ├── chrome-store-listing.md      ← names, descriptions, taglines, CWS form answers
│   ├── landing-page.md              ← full copy for levelwith.io
│   └── launch-posts.md              ← Show HN + 2 subreddit post drafts
├── legal/
│   └── privacy-policy.md            ← honest BYOK privacy policy, ready to host
├── images/
│   ├── store-icon-128.png           ← Chrome Web Store icon (128×128, already in the extension)
│   ├── cws-promo-tile-440x280.png   ← Chrome Web Store small promo tile
│   └── _build_promo_tile.py         ← source script for the promo tile
└── screenshots/
    ├── 01-tailored-analogy.png      ← hero: personalized analogy
    ├── 02-four-ways-to-ask.png      ← four input modes (page / text / image / question)
    ├── 03-depth-control.png         ← ELI5 → Expert re-levelling
    ├── 04-growing-glossary.png      ← personal jargon dictionary
    ├── 05-privacy-byok.png          ← bring-your-own-key, no backend
    ├── _template.css                ← shared styling for screenshot HTML
    ├── _render.py                   ← Playwright rendering script (rebuilds PNGs from HTML)
    └── 0*.html                      ← source HTML for each screenshot
```

---

## Chrome Web Store submission checklist

Work through these in order. The whole submission should take 60-90
minutes once the assets below are ready (they are).

### Before you open the CWS developer dashboard

- [ ] Pay the one-time $5 Chrome Web Store developer registration fee
- [ ] Decide which Google account will own the listing (this is forever)
- [x] Register the product domain — **`levelwith.io`** (done, via Cloudflare Registrar)
- [ ] Set up Cloudflare DNS for `levelwith.io` (nameservers should already be in place if you registered via Cloudflare Registrar — verify in the Cloudflare dashboard)
- [ ] Set up Cloudflare Email Routing: create a forwarder from `support@levelwith.io` → your real inbox (free, 5 minutes). Optionally also `hello@levelwith.io` and `eric@levelwith.io`.
- [ ] Decide whether to keep `eric@brightspark-tech.app` or switch to `support@levelwith.io` as the public support address. Either is fine — just pick one and use it consistently in the CWS listing, privacy policy, and launch posts.
- [ ] Host `legal/privacy-policy.md` at `https://levelwith.io/privacy`. Easiest path: Cloudflare Pages connected to the extension repo, with `/privacy` as a static markdown-rendered page, or a one-page static site with `index.html` + `privacy.html`. Capture the final URL.
- [ ] Build and test the extension bundle. From the extension root: `zip -r -X levelwith-0.2.0.zip . -x "launch-kit/*" -x "node_modules/*" -x ".git/*" -x "*.DS_Store"`
- [ ] Install the zipped build as an unpacked extension in a clean Chrome profile and walk through onboarding end-to-end. If anything trips, fix it before submitting.

### Inside the CWS developer dashboard

- [ ] Upload the `levelwith-0.2.0.zip` bundle
- [ ] Store listing → Product details
  - [ ] Name: `LevelWith — personalized plain-English explainer`
  - [ ] Short description: paste the 128-char primary pick from `copy/chrome-store-listing.md`
  - [ ] Detailed description: paste the long description verbatim
  - [ ] Category: Productivity
  - [ ] Language: English (United States)
- [ ] Store listing → Graphic assets
  - [ ] Store icon: `images/store-icon-128.png` (128×128)
  - [ ] Small promo tile: `images/cws-promo-tile-440x280.png` (440×280)
  - [ ] Screenshots: all five files from `screenshots/` (1280×800). Upload in numerical order — CWS shows them in upload order and the first one is the hero everyone sees.
- [ ] Store listing → Additional fields
  - [ ] Support email: `eric@brightspark-tech.app` (or `support@levelwith.io` once the forwarder is live)
  - [ ] Official URL: `https://levelwith.io`
  - [ ] Privacy policy URL: `https://levelwith.io/privacy`
- [ ] Privacy practices
  - [ ] Single purpose: paste the "Single purpose statement" from `copy/chrome-store-listing.md`
  - [ ] Permission justifications: paste from same doc
  - [ ] Data usage: answer per the "Data handling disclosure" section — **these answers must match the hosted privacy policy exactly**
  - [ ] Certify the disclosures
- [ ] Distribution
  - [ ] Visibility: Public
  - [ ] Regions: All
  - [ ] Pricing: Free
- [ ] Submit for review

Typical review time is 1-3 business days for a new extension from a new developer account. Expect the first review to bounce at least once for something small — they're extremely literal about the data-usage disclosure matching the privacy policy. Fix, resubmit.

---

## Landing page quick-start

You own `levelwith.io` via Cloudflare Registrar, so Cloudflare Pages is the natural host — free, fast, and the DNS is already in the same dashboard. The landing page copy in `copy/landing-page.md` is drop-in ready for:

- **Cloudflare Pages** (recommended given your setup) — free, integrates directly with the `levelwith.io` zone, automatic HTTPS, global CDN. Connect a GitHub repo containing an `index.html` + `privacy.html`, or drag-and-drop a `dist/` folder. No build step needed for a static site.
- **Carrd** — one-page builder, $19/year for a custom domain. Paste each section into a blank Carrd template. Use the "Pro" tier if you want analytics or a contact form. Faster to design, but you'll pay Carrd and host your privacy policy somewhere else.
- **Framer** — free tier is generous, better design control, steeper learning curve.

Whatever you pick:

1. Point `levelwith.io` (and `www.levelwith.io` as a CNAME) at the host. On Cloudflare Pages this is a one-click custom-domain setup; on Carrd/Framer you'll add an A/CNAME record in the Cloudflare DNS panel.
2. Drop in the screenshots from `screenshots/` as marketing visuals.
3. Install-button link goes to the Chrome Web Store URL (fill in once the listing is live).
4. Privacy policy lives at `https://levelwith.io/privacy` and must be the exact text from `legal/privacy-policy.md`.
5. Enable Cloudflare's "Always Use HTTPS" and "Automatic HTTPS Rewrites" under SSL/TLS → Edge Certificates.

---

## Launch day runbook

Rough plan for "push button, recruit beta users":

1. **T-minus 24 hours**
   - CWS listing is approved and public — confirm by opening the URL in a private window
   - Landing page is live and tested on mobile + desktop
   - Privacy policy link resolves from the store listing and the landing page
   - You've installed the live extension from the CWS on a clean Chrome profile

2. **Launch day morning (Tuesday-Thursday, 7-9am PT)**
   - Post Show HN first — paste from `copy/launch-posts.md`
   - Post in r/chrome_extensions within 30 minutes
   - Post in your chosen domain-specific subreddit within an hour
   - Clear your calendar for the next 4-6 hours

3. **First 6 hours**
   - Respond to every HN comment within 15 minutes
   - Respond to every subreddit comment within 30 minutes
   - Don't argue with critics. Thank them, ask questions, ship fixes.
   - Keep a running list of bugs and feature requests in a text file

4. **Day 2-7**
   - Ship fixes for anything in the bug list that's breaking onboarding
   - Email every new signup a short thank-you and ask for feedback
   - Book 20-minute calls with 5 real users who seem willing

---

## What to track (quietly)

For a privacy-first BYOK product, heavy analytics would undercut the brand. The minimum viable metrics:

- **Install count** — free from the CWS dashboard, no code needed
- **Uninstall count** — also free from the CWS dashboard; watch the ratio
- **Weekly active users** — free from the CWS dashboard
- **Explain completions** — optional, via a single anonymous ping to a Cloudflare Worker counter. Disclose in the privacy policy and let users disable.

The three viability questions these numbers should answer:

1. Does install → first-explain conversion clear 50%? (If not, onboarding is broken.)
2. Do active users do 3+ explains per week? (If not, it's not habitual.)
3. Does week-1 retention clear 20%? (If not, the core loop isn't good enough yet.)

---

## Kill/proceed criteria

Write these down in a text file BEFORE launch and commit to them:

> If, after 6 weeks from the CWS listing going live, LevelWith has fewer
> than 100 weekly active users OR fewer than 25% of installs come back
> in week 2, I will sunset the project, pivot the positioning, or
> publicly document why I'm continuing despite these numbers.

Pre-committing protects future-you from sunk-cost emotion.

---

## Regenerating the assets

If brand copy changes, edit the source files:

- **Promo tile:** edit `images/_build_promo_tile.py` and run `python3 launch-kit/images/_build_promo_tile.py`
- **Screenshots:** edit the matching `screenshots/0*.html` file and run `python3 launch-kit/screenshots/_render.py`

Playwright + chromium must be installed:

```bash
pip install playwright --break-system-packages
python3 -m playwright install chromium
```

---

## Contact

Website: https://levelwith.io
eric@brightspark-tech.app
