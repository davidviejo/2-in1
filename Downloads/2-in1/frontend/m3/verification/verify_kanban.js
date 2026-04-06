const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Navigate to the app (assuming it's running on port 5173, standard for Vite)
    await page.goto('http://localhost:5173/app/kanban');

    // Wait for the Kanban board to load
    await page.waitForSelector('text=Tablero Kanban');

    // Check if the "Back del cliente" column exists
    const columnExists = await page.isVisible('text=Back del cliente');
    console.log('Column "Back del cliente" exists:', columnExists);

    // Wait for a completed task (Done column) to appear, if there are any
    // To do this, we need to create one first or assume it exists. Let's just take a screenshot of the board.

    await page.screenshot({ path: 'frontend/m3/verification/verification_kanban.png' });
    console.log('Screenshot saved to frontend/m3/verification/verification_kanban.png');

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }
})();
