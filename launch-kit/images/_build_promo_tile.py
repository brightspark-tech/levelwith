#!/usr/bin/env python3
"""
Build the 440x280 Chrome Web Store promo tile for LevelWith.

Design:
- Warm Ember-gradient background (amber -> burnt orange), matching the
  extension's brand palette exactly.
- Bold "LevelWith" wordmark in cream.
- "Let me level with you." italic subtitle.
- "Plain-English explanations, tailored to you." value prop.
- Subtle radial vignette for depth.
- Extension icon inset in the lower-right corner.
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

OUT = os.path.join(os.path.dirname(__file__), "cws-promo-tile-440x280.png")
ICON = os.path.join(os.path.dirname(__file__), "store-icon-128.png")

W, H = 440, 280

# Ember palette (matches popup.css exactly)
AMBER = (245, 158, 11)      # #f59e0b
PRIMARY = (234, 88, 12)     # #ea580c
PRIMARY_DEEP = (124, 45, 18)  # #7c2d12 — dark "reading" text tone
CREAM = (255, 247, 237)     # #fff7ed — primary-soft for text

FONT_BOLD = "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"
FONT_ITAL = "/usr/share/fonts/truetype/liberation2/LiberationSans-Italic.ttf"
FONT_REG = "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf"


def gradient_bg(w, h):
    """Diagonal amber -> burnt-orange gradient, upper-left to lower-right."""
    img = Image.new("RGB", (w, h), AMBER)
    px = img.load()
    for y in range(h):
        for x in range(w):
            # Normalize diagonal position to [0, 1]
            t = (x / w + y / h) / 2
            r = int(AMBER[0] * (1 - t) + PRIMARY[0] * t)
            g = int(AMBER[1] * (1 - t) + PRIMARY[1] * t)
            b = int(AMBER[2] * (1 - t) + PRIMARY[2] * t)
            px[x, y] = (r, g, b)
    return img


def add_vignette(img):
    """Subtle dark vignette in the lower-right for depth."""
    w, h = img.size
    overlay = Image.new("L", (w, h), 0)
    od = ImageDraw.Draw(overlay)
    # Radial-ish dark patch biased to lower right
    od.ellipse(
        [w * 0.35, h * 0.2, w * 1.3, h * 1.3],
        fill=70,
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(60))
    dark = Image.new("RGB", (w, h), (0, 0, 0))
    img = Image.composite(dark, img, overlay)
    return img


def main():
    img = gradient_bg(W, H)
    img = add_vignette(img)
    d = ImageDraw.Draw(img)

    # Wordmark — sized to clear the icon on the right
    wordmark_font = ImageFont.truetype(FONT_BOLD, 46)
    d.text((32, 36), "LevelWith", font=wordmark_font, fill=CREAM)

    # Italic tagline underneath wordmark
    tag_font = ImageFont.truetype(FONT_ITAL, 19)
    d.text(
        (34, 94),
        "Let me level with you.",
        font=tag_font,
        fill=(255, 247, 237, 220),
    )

    # Value-prop block
    vp_font = ImageFont.truetype(FONT_REG, 16)
    vp_lines = [
        "Plain-English explanations of",
        "any web page — tailored to",
        "who you actually are.",
    ]
    y = 134
    for line in vp_lines:
        d.text((34, y), line, font=vp_font, fill=CREAM)
        y += 21

    # Badge: "Free · BYOK · Privacy-first"
    badge_font = ImageFont.truetype(FONT_BOLD, 11)
    badge_text = "FREE  ·  BYOK  ·  PRIVACY-FIRST"
    bx, by = 34, 220
    # Translucent pill behind the badge
    bbox = d.textbbox((bx, by), badge_text, font=badge_font)
    pad = 8
    d.rounded_rectangle(
        [bbox[0] - pad, bbox[1] - 4, bbox[2] + pad, bbox[3] + 4],
        radius=12,
        fill=(124, 45, 18, 200),
    )
    d.text((bx, by), badge_text, font=badge_font, fill=CREAM)

    # Inset the extension icon at lower-right, with a soft shadow
    ICON_SIZE = 120
    icon = Image.open(ICON).convert("RGBA")
    icon = icon.resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
    ix = W - ICON_SIZE - 22
    iy = 80

    # Shadow
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [ix + 4, iy + 6, ix + ICON_SIZE + 4, iy + ICON_SIZE + 6],
        radius=26,
        fill=(0, 0, 0, 90),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(10))
    img = Image.alpha_composite(img.convert("RGBA"), shadow)

    img.paste(icon, (ix, iy), icon)

    img = img.convert("RGB")
    img.save(OUT, "PNG", optimize=True)
    print(f"wrote {OUT} ({os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
