
from playwright.sync_api import sync_playwright
import time

def verify_landing_page():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        try:
            # Navigate to the landing page
            # Assuming Vite defaults to port 5173, but we should check the log if possible or try common ports
            page.goto("http://localhost:5173/")

            # Wait for key elements to ensure the new design is loaded
            # 1. "agenciaSEO.eu" logo/text
            page.wait_for_selector("text=agenciaSEO.eu", state="visible", timeout=10000)

            # 2. "David Viejo" heading
            page.wait_for_selector("h1:has-text('David Viejo')", state="visible")

            # 3. "Consultor SEO — agenciaSEO.eu" subtitle
            page.wait_for_selector("text=Consultor SEO — agenciaSEO.eu", state="visible")

            # 4. Clients Area section
            page.wait_for_selector("text=Proyectos Activos — Área de Clientes", state="visible")

            # 5. Project cards
            projects = page.locator("text=Proyecto 1")
            if projects.count() == 0:
                print("Warning: Project cards not found immediately, waiting...")
                page.wait_for_selector("text=Proyecto 1", state="visible")

            # Take a full page screenshot to capture the entire redesign
            page.screenshot(path="/tmp/landing_page_verification.png", full_page=True)
            print("Screenshot saved to /tmp/landing_page_verification.png")

        except Exception as e:
            print(f"Verification failed: {e}")
            # Take a screenshot even on failure to see what's wrong
            page.screenshot(path="/tmp/landing_page_failure.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_landing_page()
