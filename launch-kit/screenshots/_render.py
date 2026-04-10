#!/usr/bin/env python3
"""Render every screenshot HTML file to a 1280x800 PNG using Playwright."""

import os
from pathlib import Path
from playwright.sync_api import sync_playwright

HERE = Path(__file__).parent
TARGETS = sorted(HERE.glob("[0-9][0-9]-*.html"))


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for html in TARGETS:
            out = html.with_suffix(".png")
            context = browser.new_context(
                viewport={"width": 1280, "height": 800},
                device_scale_factor=2,  # retina-quality output
            )
            page = context.new_page()
            page.goto(f"file://{html.resolve()}")
            page.wait_for_load_state("networkidle")
            page.screenshot(
                path=str(out),
                clip={"x": 0, "y": 0, "width": 1280, "height": 800},
                omit_background=False,
            )
            context.close()
            print(f"wrote {out.name} ({out.stat().st_size} bytes)")
        browser.close()


if __name__ == "__main__":
    main()
