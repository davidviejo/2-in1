
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:5173/#/module/1")
        page.wait_for_selector("h1") # Wait for module title
        page.wait_for_selector("h3") # Wait for task titles

        # Find the first task title and click it
        task_title = page.locator("h3").first
        print(f"Clicking task: {task_title.text_content()}")
        task_title.click()

        # Wait for expanded content
        # "Impacto de la Tarea" is a label inside expanded view
        page.wait_for_selector("text=Impacto de la Tarea", timeout=5000)

        page.screenshot(path="verification/module_detail_expanded.png")
        print("Expanded screenshot taken")

    except Exception as e:
        print(f"Error: {e}")
        page.screenshot(path="verification/error.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
