from playwright.sync_api import sync_playwright
import time
import os

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        print("Navigating to http://localhost:5173/...")
        try:
            page.goto("http://localhost:5173/", timeout=60000)
            page.wait_for_selector("text=agenciaSEO.eu", timeout=30000)
        except Exception as e:
            print(f"Error navigating to landing page: {e}")
            return

        print("Landing page loaded. Clicking 'Acceder' on a local project...")
        try:
            page.wait_for_selector("text=Acceder", timeout=10000)
            page.locator("button:has-text('Acceder')").first.click()
            print("Waiting for App Layout (MediaFlow)...")
            page.wait_for_selector("text=MediaFlow", timeout=30000)
        except Exception as e:
            print(f"Error accessing app: {e}")
            return

        time.sleep(2)

        # Capture initial state (Estado)
        page.screenshot(path="verification_estado.png")
        print("Captured state: Estado")

        # Click Análisis Tab
        try:
            page.get_by_role("button", name="analisis").click()
            time.sleep(1)
            page.screenshot(path="verification_analisis.png")
            print("Captured state: Análisis")

            # Verify Sidebar Link
            print("Testing Sidebar Link navigation...")
            # Click "Checklist SEO" link in sidebar
            # Note: The text might be split or have sublabel.
            # NavItem renders: <span>Checklist SEO</span>
            page.locator("a:has-text('Checklist SEO')").click()
            time.sleep(1)

            # Check if we are still on a valid page (not redirected to landing)
            if page.locator("text=MediaFlow").is_visible():
                print("Sidebar navigation confirmed: Still in App.")
            else:
                print("Sidebar navigation FAILED: Appears to have exited App.")

        except Exception as e:
            print(f"Error testing Análisis/Sidebar: {e}")

        # Click Estrategia
        try:
            page.get_by_role("button", name="estrategia").click()
            time.sleep(1)
            page.screenshot(path="verification_estrategia.png")
            print("Captured state: Estrategia")
        except Exception as e:
            print(f"Error clicking Estrategia: {e}")

        # Click Acciones
        try:
            page.get_by_role("button", name="acciones").click()
            time.sleep(1)
            page.screenshot(path="verification_acciones.png")
            print("Captured state: Acciones")
        except Exception as e:
            print(f"Error clicking Acciones: {e}")

        browser.close()

if __name__ == "__main__":
    run_test()
