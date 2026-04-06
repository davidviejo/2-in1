
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Mock API responses
        await page.route("**/api/capabilities", lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='{"serpProviders": {"serpapi": true}, "costModel": {}, "limits": {}}'
        ))

        try:
            # Navigate to the checklist page directly
            # Note: The app uses HashRouter, so we need to include the hash
            await page.goto("http://localhost:5173/#/checklist", timeout=60000)

            # Wait for content to settle
            await page.wait_for_timeout(5000)

            # Take a screenshot
            await page.screenshot(path="checklist.png")
            print("Checklist screenshot saved to checklist.png")

        except Exception as e:
            print(f"Error: {e}")
            await page.screenshot(path="checklist_error.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
