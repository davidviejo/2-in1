import time
from playwright.sync_api import sync_playwright

def verify_landing_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            # Navigate to the landing page
            page.goto("http://localhost:5173")

            # Wait for the page to load
            page.wait_for_load_state("networkidle")
            time.sleep(2) # Extra wait for any animations

            # Verify Title
            title = page.locator("h1")
            print(f"Title text: {title.inner_text()}")

            # Verify About Section
            about_section = page.locator("#about")
            print(f"About section visible: {about_section.is_visible()}")

            # Verify Experience Section
            experience_section = page.locator("#experience")
            print(f"Experience section visible: {experience_section.is_visible()}")

            # Take a screenshot of the entire page
            page.screenshot(path="verification_landing_page.png", full_page=True)
            print("Screenshot saved to verification_landing_page.png")

        except Exception as e:
            print(f"Error during verification: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_landing_page()
