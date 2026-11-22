"""Export the six report figures, end state on black, as the no-JavaScript fallbacks. The preview must be running."""
import io
import os
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

from browser import browser

OUT = Path(__file__).resolve().parents[1] / "assets/static"

with sync_playwright() as p:
    OUT.mkdir(parents=True, exist_ok=True)
    b = browser(p)
    page = b.new_page(viewport={"width": 1600, "height": 1200})
    page.goto(os.environ.get("REPORT_URL", "http://127.0.0.1:8766") + "/?still", wait_until="load")
    page.evaluate("document.querySelector('#inside').scrollIntoView()")
    for n in range(1, 7):
        page.click(f'[data-fig="fig{n}"]')
        page.wait_for_function("n => BD.players.at(-1)?.id === `fig${n}`", arg=n)
        page.evaluate("() => { const p = BD.players.at(-1); p.visible = true; p.isStatic = true; p.t = p.total - 0.001; p.draw(1); }")
        page.wait_for_timeout(600)
        png = page.locator(".fig .stage > svg").screenshot()
        Image.open(io.BytesIO(png)).convert("RGB").save(OUT / f"fig{n}-dark.webp", quality=90, method=6)
    b.close()
print(f"Figures exported to {OUT}")
