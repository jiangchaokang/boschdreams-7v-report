"""Real-browser regression for the homepage: python tools/check_browser.py (preview running on 8766)."""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

from browser import browser

URL = os.environ.get("REPORT_URL", "http://127.0.0.1:8766")
OUT = Path(__file__).resolve().parents[1] / "checks/final"
OUT.mkdir(parents=True, exist_ok=True)
passed, errors = [], []
click = lambda page, sel: page.evaluate("s => document.querySelector(s).click()", sel)
painted = "c => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 400) n += d[i] > 0; return n; }"


def open_page(b, width, **kw):
    page = b.new_page(viewport={"width": width, "height": 900 if width > 800 else 844}, **kw)
    page.on("pageerror", lambda e: errors.append(f"{width}: JS {e}"))
    page.on("response", lambda r: r.status >= 400 and errors.append(f"{width}: {r.status} {r.url}"))
    page.goto(URL + "/", wait_until="load")
    return page


def go(page, sel):
    page.evaluate("s => document.querySelector(s).scrollIntoView({block: 'center'})", sel)


def desktop(b):
    page = open_page(b, 1440)
    page.wait_for_timeout(1200)
    assert page.eval_on_selector(".bar .brand", "e => +getComputedStyle(e).opacity") == 0
    page.wait_for_function("+getComputedStyle(document.querySelector('.bar .brand')).opacity === 1", timeout=30000)
    page.screenshot(path=OUT / "landed.png")
    passed.append("Title lands in the header")
    for mode in ("seven", "world", "layout", "dream"):
        click(page, f'.modes [data-mode="{mode}"]')
        page.wait_for_timeout(3500)
        assert page.get_attribute(f'.modes [data-mode="{mode}"]', "aria-pressed") == "true"
        assert page.get_attribute(".lens", "data-mode") == mode
        if mode == "world":
            assert "vector world" in page.inner_text(".modes-cap")
        if mode == "seven":
            assert float(page.eval_on_selector('.sat[data-cam="RT"]', "s => getComputedStyle(s).opacity")) > 0.9
    page.screenshot(path=OUT / "hero.png")
    passed.append("Hero lens: World, Layout, Dream, Seven")

    go(page, ".reel")
    page.wait_for_function("document.querySelectorAll('.reel-chips button').length === 9 && !document.querySelector('.reel video').paused")
    click(page, ".reel-chips button:nth-child(3)")
    page.wait_for_function("document.querySelector('.reel-chips button:nth-child(3)').getAttribute('aria-pressed') === 'true'")
    go(page, "#scene-rig")
    for clip in ("crosswalk", "scooters", "night", "highway", "truck", "riders"):
        click(page, f'.scene-pick [data-clip="{clip}"]')
        page.wait_for_function("c => [...document.querySelectorAll('#scene-rig video')].some(v => v.src.endsWith(c + '.mp4') && v.readyState >= 2)", arg=clip)
        if clip == "scooters":
            assert page.eval_on_selector('#data .layout-toggle', "b => b.disabled")
    t_scene0 = page.eval_on_selector("#scene-rig video", "v => v.currentTime")
    page.wait_for_timeout(1200)
    assert page.eval_on_selector("#scene-rig video", "v => !v.paused && v.currentTime > 0") and page.eval_on_selector("#scene-rig video", "v => v.currentTime") != t_scene0, "scene rig autoplays smoothly"
    click(page, "#data .layout-toggle")
    assert page.get_attribute("#scene-rig", "data-view") == "dream"
    click(page, "#data .layout-toggle")
    assert page.get_attribute("#scene-rig", "data-view") == "split"
    page.wait_for_timeout(500)
    assert all(n > 50 for n in page.eval_on_selector_all("#scene-rig canvas", f"cs => cs.map({painted})"))
    page.locator('#scene-rig .tile[data-slot="RT"]').press("Enter")
    assert page.get_attribute('#scene-rig .tile[data-slot="FW"]', "data-cam") == "RT"
    page.screenshot(path=OUT / "data.png")
    passed.append("Data: nine recorded conditions; six autoplaying generated scenes, sweep compare toggle, top-down scene")

    go(page, "#agent .ag")
    for case in range(7):
        click(page, f"#agent .tickets [role=tab]:nth-child({case + 1})")
        page.wait_for_timeout(500)
        for s in range(6):
            click(page, f"#agent .steps li:nth-child({s + 1}) button")
            assert page.eval_on_selector_all("#agent .st", "ps => ps.findIndex((p) => p.classList.contains('on'))") == s
    click(page, "#agent .tickets [role=tab]:nth-child(1)")
    click(page, "#agent .steps li:nth-child(1) button")
    page.wait_for_timeout(2500)
    assert page.eval_on_selector(".read-map", painted) > 50 and page.eval_on_selector(".read-pip", painted) > 50
    click(page, "#agent .steps li:nth-child(2) button")
    page.wait_for_function("document.querySelectorAll('.pool > .on').length === 6", timeout=30000)
    click(page, "#agent .steps li:nth-child(3) button")
    page.wait_for_timeout(1200)
    assert page.locator(".design-phases button").count() == 5 and page.eval_on_selector(".design-map", painted) > 50
    click(page, '.design-phases button[data-ph="3"]')
    page.wait_for_timeout(400)
    page.screenshot(path=OUT / "agent_design.png")
    click(page, "#agent .steps li:nth-child(4) button")
    page.wait_for_function("document.querySelectorAll('.st-verify .checks li.on').length === 4", timeout=15000)
    assert page.eval_on_selector(".verify-map", painted) > 50
    click(page, "#agent .steps li:nth-child(5) button")
    page.wait_for_timeout(2500)
    assert page.eval_on_selector("#agent-rig canvas", painted) > 50 and page.locator("#agent-rig .tile").count() == 7
    click(page, '.gen-pick [data-layer="rec"]')
    assert page.get_attribute('.gen-pick [data-layer="rec"]', "aria-checked") == "true"
    assert page.locator(".gen-world canvas").count() == 1
    page.screenshot(path=OUT / "agent.png")
    click(page, "#agent .steps li:nth-child(6) button")
    click(page, ".ag-play")
    page.wait_for_timeout(1200)
    # Verify autoplay advances sequentially and does NOT skip steps instantaneously
    assert page.get_attribute("#agent .tickets [role=tab]:nth-child(1)", "aria-selected") == "true", "autoplay must not race through steps"
    page.wait_for_function("document.querySelector('#agent .tickets [role=tab]:nth-child(2)').getAttribute('aria-selected') === 'true'", timeout=20000)
    passed.append("Agent: seven tickets × six steps; animated 5-phase Design; sequential non-racing autoplay")

    go(page, "#futures .cf-stage")
    for case, n in (("xwalk", 3), ("lturn", 3), ("hub", 4)):
        click(page, f'.cf-cases [data-case="{case}"]')
        page.wait_for_function("c => [...document.querySelectorAll('#cf-rig video')].some(v => v.src.endsWith(`cf-${c}.mp4`) && v.readyState >= 2)", arg=case)
        assert page.locator(".fut").count() == n and page.locator(".fut canvas").count() == 2 * n
        click(page, ".fut:nth-child(1)")
        assert page.get_attribute(".fut:nth-child(1)", "aria-pressed") == "true" and page.locator(".bar-row").count() >= 3
    page.wait_for_timeout(800)
    assert page.eval_on_selector(".fut canvas", painted) > 50 and page.eval_on_selector(".tree canvas", painted) > 50
    t0 = page.eval_on_selector("#cf-rig video", "v => v.currentTime")
    page.wait_for_timeout(4000)
    assert page.eval_on_selector("#cf-rig video", "v => v.currentTime") != t0, "futures video plays"
    click(page, ".fut:nth-child(1)")
    page.wait_for_timeout(600)
    assert page.get_attribute(".cf-stage", "data-mode") == "seven" and page.eval_on_selector("#cf-rig canvas", painted) > 50
    click(page, ".cf-back")
    page.screenshot(path=OUT / "futures.png")
    passed.append("Futures: three scenes, every future in front-wide and tele, seven cameras per future, distance tree, consequences")

    go(page, "#drive")
    page.wait_for_timeout(2500)
    page.fill(".drive-scrub", "300")
    page.dispatch_event(".drive-scrub", "input")
    page.wait_for_timeout(1500)
    assert abs(page.eval_on_selector("#drive-rig video", "v => v.currentTime") - 30) < 0.5
    assert page.locator(".beats button").count() == 7 and page.locator(".marks i").count() == 6 and page.locator("#drive-rig .tile").count() == 7
    click(page, ".beats li:nth-child(4) button")
    page.wait_for_timeout(1200)
    assert "U-turn" in page.inner_text(".beat-card") and page.get_attribute(".beats li:nth-child(4) button", "aria-current") is not None
    t0 = page.eval_on_selector("#drive-rig video", "v => v.currentTime")
    page.wait_for_timeout(3000)
    assert page.eval_on_selector("#drive-rig video", "v => v.currentTime") > t0 + 1, "drive video plays"
    click(page, '.drive-stage [data-z="0.75"]')
    page.screenshot(path=OUT / "drive.png")
    passed.append("Drive: one take, beats jump the video and the 3D world together, zoom")

    go(page, "#static")
    for clip in ("hwy2", "urb1", "urb2", "corner1", "hwy1"):
        click(page, f'.static-pick [data-road="{clip}"]')
        page.wait_for_function("c => [...document.querySelectorAll('#static video')].some(v => v.src.endsWith(`static-${c}.mp4`) && v.readyState >= 2)", arg=clip)
    page.wait_for_timeout(900)
    assert page.locator('.st-row4[data-side="base"] .st-cell').count() == 4
    assert page.locator('.st-row4[data-side="edit"] .st-cell').count() == 4
    assert page.eval_on_selector('.st-row4[data-side="base"] canvas', painted) > 50
    assert page.eval_on_selector('.st-row4[data-side="edit"] canvas', painted) > 50
    assert page.eval_on_selector("#static video", "v => !v.paused")
    assert page.eval_on_selector(".st-bev", painted) > 20 and len(page.inner_text(".st-title").strip()) > 8
    # Interactive progress bar: pause, scrub, resume, replay, overlay toggle
    click(page, ".st-play")
    assert page.eval_on_selector("#static video", "v => v.paused")
    page.fill(".st-scrub", "45")
    page.dispatch_event(".st-scrub", "input")
    page.wait_for_timeout(250)
    assert abs(page.eval_on_selector("#static video", "v => v.currentTime") - 4.5) < 0.4
    click(page, ".st-play")
    click(page, ".static-toggle")
    assert page.get_attribute(".static-toggle", "aria-pressed") == "false"
    click(page, ".static-toggle")
    page.screenshot(path=OUT / "static.png")
    passed.append("Static: five paired pure-noise corner cases (2 Highway, 2 Urban, 1 Complex), 2x4V stacked rows, high-contrast color overlay toggle, interactive progress scrubber, guided motion & top-down diff")

    go(page, "#fix-rig")
    for clip in ("ghosts", "road", "blur", "holes", "seams"):
        click(page, f'.fix-pick [data-clip="{clip}"]')
        page.wait_for_function("c => [...document.querySelectorAll('#fix-rig video')].some(v => v.src.endsWith(`fix-${c}.mp4`) && v.readyState >= 2)", arg=clip)
    page.wait_for_timeout(800)
    assert page.eval_on_selector("#fix-rig canvas", painted) > 50 and "dB" in page.inner_text(".fx-stats")
    click(page, '.fix-mode [data-row="gt"]')
    assert "recording" in page.inner_text(".fix-labels").lower()
    go(page, '#repair [data-chart="fixer"]')
    page.wait_for_function("document.querySelector('[data-chart=fixer]').classList.contains('in')")
    page.screenshot(path=OUT / "repair.png")
    passed.append("Repair: seven views per failure mode, divider between render and repair, report metrics, five-mode chart")

    go(page, "#inside")
    for n in range(1, 7):
        click(page, f'[data-fig="fig{n}"]')
        page.wait_for_function("n => window.BD?.players.at(-1)?.id === `fig${n}` && document.querySelector('.fig .stage > svg')", arg=n)
    passed.append("Inside: six figures, one at a time")

    assert page.evaluate("[...document.querySelectorAll('main > section')].map(s => s.id).join()") == "top,film,data,agent,futures,drive,static,repair,inside,experiments"
    for c in ("models", "runtime", "stages", "cameras"):
        go(page, f'[data-chart="{c}"]')
        page.wait_for_function("c => document.querySelector(`[data-chart=${c}]`).classList.contains('in')", arg=c)
    assert page.locator("#experiments table").count() == 0 and page.locator('[data-chart="models"] circle').count() > 60
    assert "#1/11" in page.inner_text('[data-chart="models"]') and "10.85" in page.inner_text('[data-chart="runtime"]')
    assert page.locator(".take").count() == 2 and page.locator(".exp-kpis").count() == 0
    go(page, "#experiments")
    page.wait_for_timeout(600)
    page.screenshot(path=OUT / "experiments.png")
    go(page, "#team")
    page.wait_for_timeout(400)
    page.screenshot(path=OUT / "footer.png")
    passed.append("Experiments & Footer: four animated charts with their takeaways under them; title, team, cite, scope")

    go(page, "#film")
    page.wait_for_function("document.querySelectorAll('.chapters button').length === 7")
    if page.viewport_size["width"] > 1240:
        h = page.evaluate("[document.querySelector('.screen'), document.querySelector('.chapters')].map(e => Math.round(e.getBoundingClientRect().height))")
        assert abs(h[0] - h[1]) <= 2, f"chapter list {h[1]} px tall next to a {h[0]} px picture"
    page.evaluate("document.querySelector('#film video').muted = true")
    click(page, ".chapters li:nth-child(3) button")
    page.wait_for_function("(v => v.src.endsWith('/2.mp4') && !v.paused && v.currentTime > 0.3)(document.querySelector('#film video'))", timeout=20000)
    page.select_option(".p-rate", "1.5")
    page.hover(".p-mute")
    page.wait_for_timeout(400)
    page.fill(".p-level", "0.3")
    page.dispatch_event(".p-level", "input")
    assert page.evaluate("(v => v.playbackRate === 1.5 && Math.abs(v.volume - 0.3) < 0.01)(document.querySelector('#film video'))")
    page.evaluate("(s => { s.value = s.max - 15; })(document.querySelector('.p-seek'))")
    page.dispatch_event(".p-seek", "input")
    page.wait_for_function("document.querySelector('#film video').src.endsWith('/6.mp4')")
    assert page.get_attribute(".chapters li:nth-child(7) button", "aria-current") is not None
    assert page.evaluate("document.querySelector('#film video').playbackRate") == 1.5
    page.screenshot(path=OUT / "film.png")
    click(page, ".p-play")
    passed.append("Film: seven chapters, jump by chapter or bar, speed and volume carry across chapters")

    click(page, ".copy")
    page.wait_for_function("document.querySelector('.copy').dataset.done")
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    passed.append("Cite, no overflow")
    page.close()


def mobile(b):
    page = open_page(b, 390, is_mobile=True, has_touch=True)
    page.wait_for_timeout(4000)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    page.screenshot(path=OUT / "mobile.png")
    passed.append("Mobile: no overflow")
    page.close()


def still(b):
    page = open_page(b, 1440, reduced_motion="reduce")
    page.wait_for_function(f"({painted})(document.querySelector('.lens-video')) > 50", timeout=20000)
    assert page.get_attribute('.modes [data-mode="dream"]', "aria-pressed") == "true"
    go(page, "#agent .ag")
    page.wait_for_timeout(1000)
    assert page.get_attribute(".ag-play", "aria-label") == "Play"
    passed.append("Reduced motion: still dream, the agent waits for the reader")
    page.close()


def nojs(b):
    page = b.new_page(viewport={"width": 1440, "height": 900}, java_script_enabled=False)
    page.goto(URL + "/", wait_until="load")
    assert page.locator(".hero-title").is_visible() and page.locator("#experiments .chart").count() == 4
    assert page.eval_on_selector(".fig noscript img", "i => i.complete && i.naturalWidth > 0")
    passed.append("No JavaScript: title, experiment headings and dark figure fallback")
    page.close()


with sync_playwright() as p:
    b = browser(p)
    for case in (desktop, mobile, still, nojs):
        case(b)
    b.close()
(OUT / "report.json").write_text(json.dumps({"passed": passed, "errors": errors}, indent=2))
print(json.dumps({"passed": passed, "errors": errors}, indent=2))
assert not errors, errors
