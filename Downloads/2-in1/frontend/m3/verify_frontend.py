from playwright.sync_api import sync_playwright

def verify_frontend():
    with sync_playwright() as p:
        # Launch browser
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 1. Landing Page
        print("Visiting Landing Page...")
        page.goto("http://localhost:5173/")
        page.wait_for_selector("text=David Viejo")
        page.screenshot(path="verification_landing.png")
        print("Landing page screenshot saved.")

        # 2. Clients Login
        print("Visiting Clients Login...")
        page.goto("http://localhost:5173/clientes")
        page.wait_for_selector("text=Área de Clientes")
        page.screenshot(path="verification_login.png")
        print("Clients login screenshot saved.")

        # 3. Project Login
        print("Visiting Project Login...")
        page.goto("http://localhost:5173/p/demo-project")
        page.wait_for_selector("text=Acceso a Proyecto")
        page.screenshot(path="verification_project_login.png")
        print("Project login screenshot saved.")

        # 4. Operator Page
        print("Visiting Operator Page...")
        page.goto("http://localhost:5173/operator")
        page.wait_for_selector("text=Operator Access")
        page.screenshot(path="verification_operator.png")
        print("Operator page screenshot saved.")

        browser.close()

if __name__ == "__main__":
    verify_frontend()
