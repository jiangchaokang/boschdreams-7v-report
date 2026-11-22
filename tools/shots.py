"""Look at the page: python tools/shots.py [width] [#section ...] (preview running). Saves checks/shots/<section>-<width>.png and prints errors."""
import os
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

from browser import browser

URL = os.environ.get("REPORT_URL", "http://127.0.0.1:8766")
OUT = Path(__file__).resolve().parents[1] / "checks/shots"
OUT.mkdir(parents=True, exist_ok=True)
width = int(sys.argv[1]) if len(sys.argv) > 1 else 1440
sections = sys.argv[2:] or ["#top", "#data", "#agent", "#futures", "#drive", "#repair", "#inside", "#experiments", "#team"]
with sync_playwright() as p:
    b = browser(p)
    page = b.new_page(viewport={"width": width, "height": 900 if width > 800 else 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(f"JS {e}"))
    page.on("console", lambda m: m.type == "error" and errors.append(f"console {m.text}"))
    page.on("response", lambda r: r.status >= 400 and errors.append(f"{r.status} {r.url}"))
    page.goto(URL + "/", wait_until="load")
    page.wait_for_timeout(int(os.environ.get("WAIT", 4000)))
    for sel in sections:
        page.evaluate("s => document.querySelector(s).scrollIntoView({block: 'start'})", sel)
        page.wait_for_timeout(int(os.environ.get("HOLD", 3000)))
        page.locator(sel).screenshot(path=OUT / f"{sel[1:]}-{width}.png")
    print("\n".join(errors) or "no errors")
    b.close()
