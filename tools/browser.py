import os
from playwright.sync_api import sync_playwright

ARGS = ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--enable-gpu-rasterization"]

def browser(p):
    return p.chromium.launch(executable_path=os.environ["CHROME"], headless=True, args=ARGS)
