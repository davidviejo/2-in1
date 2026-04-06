from playwright.sync_api import sync_playwright
import time
import os

def verify_layout():
    os.makedirs("/home/jules/verification", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        # Wait for dev server
        print("Navigating to http://localhost:5173...")
        try:
            page.goto("http://localhost:5173/", timeout=60000)
            # Sometimes networkidle is flaky if polling happens, let's wait for specific element
            page.wait_for_selector("text=MediaFlow", timeout=10000)
        except Exception as e:
            print(f"Error navigating: {e}")
            # Try once more with a longer timeout or retry logic
            try:
                 page.goto("http://localhost:5173/", timeout=60000)
                 page.wait_for_selector("text=MediaFlow", timeout=10000)
            except Exception as e2:
                 print(f"Retry failed: {e2}")
                 return

        print("Page loaded.")
        time.sleep(2) # Give it a moment to render fully

        # Verify Estado Tab (Default)
        print("Verifying Estado Tab...")
        page.screenshot(path="/home/jules/verification/tab_estado.png")

        # Click Análisis
        print("Clicking Análisis...")
        # The buttons are lowercase in my code: 'analisis'
        page.get_by_role("button", name="analisis").click()
        time.sleep(1) # Wait for transition
        page.screenshot(path="/home/jules/verification/tab_analisis.png")

        # Click Estrategia
        print("Clicking Estrategia...")
        page.get_by_role("button", name="estrategia").click()
        time.sleep(1)
        page.screenshot(path="/home/jules/verification/tab_estrategia.png")

        # Click Acciones
        print("Clicking Acciones...")
        page.get_by_role("button", name="acciones").click()
        time.sleep(1)
        page.screenshot(path="/home/jules/verification/tab_acciones.png")

        print("Verification complete.")
        browser.close()

if __name__ == "__main__":
    verify_layout()
