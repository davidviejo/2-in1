import time
from playwright.sync_api import Page, expect, sync_playwright

def test_kanban_features(page: Page):
    print("Navigating to local dev server...")
    page.goto("http://localhost:5173/#/app/kanban")

    # Wait for the board to load
    page.wait_for_selector("text=Tablero Kanban")
    time.sleep(2) # Wait for animations/renders

    print("Clicking Add Task in Pending column...")
    # Find the "Añadir tarjeta" button in the Pending column (usually first column)
    add_buttons = page.locator("button:has-text('Añadir tarjeta')")
    add_buttons.first.click()

    print("Typing new task name...")
    # Find the input and type
    input_field = page.locator("input[placeholder='Título de la tarea...']")
    input_field.fill("My new Kanban task")

    print("Taking screenshot of add task input...")
    page.screenshot(path="/home/jules/verification/kanban_add_input.png")

    print("Submitting new task by pressing Enter...")
    input_field.press("Enter")
    time.sleep(2)

    print("Clicking the first task in the kanban board...")
    # The KanbanBoard uses a div with class custom-scrollbar inside the droppable.
    task_cards = page.locator(".custom-scrollbar > div")

    print(f"Number of task cards found: {task_cards.count()}")

    print("Taking screenshot of new task...")
    page.screenshot(path="/home/jules/verification/kanban_new_task.png")

    page.goto("http://localhost:5173/#/app/module/1")
    time.sleep(2)

    # We will just click the edit button of a task in the module page
    edit_buttons = page.locator("button[title='Editar detalles']")
    if edit_buttons.count() > 0:
        edit_buttons.first.click()
        time.sleep(1)
        page.screenshot(path="/home/jules/verification/kanban_task_modal.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Set viewport to something reasonable
        page = browser.new_page(viewport={"width": 1280, "height": 800})
        try:
            test_kanban_features(page)
        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="/home/jules/verification/kanban_error.png")
        finally:
            browser.close()
