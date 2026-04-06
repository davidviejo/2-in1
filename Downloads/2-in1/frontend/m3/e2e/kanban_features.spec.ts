import { test, expect } from '@playwright/test';

test.describe('Kanban Board Features', () => {
  test('Kanban tasks filtering and customization', async ({ page }) => {
    // 1. Navigate to the app (using hash router)
    await page.goto('/#/app/module/1');
    await page.waitForTimeout(1000); // Wait for load

    const taskName = 'Verificar Indexación (robots.txt & sitemap)';
    const taskCard = page.locator('div').filter({ hasText: taskName }).last();

    // Expand the task card to reveal buttons
    await taskCard.click();
    await page.waitForTimeout(500);

    // 2. Add task to Roadmap if not already added
    // Check if "Añadir al Roadmap Cliente" button is visible
    // The button title toggles between "Añadir..." and "Quitar..."
    const addToRoadmapBtn = page.getByTitle('Añadir al Roadmap Cliente');
    if (await addToRoadmapBtn.isVisible()) {
      await addToRoadmapBtn.click();
      // Wait for toast or state update
      await page.waitForTimeout(500);
    } else {
      // If not visible, check if it's already added (title would be "Quitar...")
      const removeFromRoadmapBtn = page.getByTitle('Quitar del Roadmap Cliente');
      if (!(await removeFromRoadmapBtn.isVisible())) {
        // If neither is visible, maybe expansion failed or filtered out?
        // But let's proceed, if it fails later we know why.
        console.log('Could not find Add/Remove roadmap button');
      }
    }

    // 3. Navigate to Kanban Board
    await page.getByRole('link', { name: 'acciones', exact: true }).click();
    await page.getByRole('link', { name: 'Tablero Kanban', exact: false }).click();
    await page.waitForTimeout(1000);

    // 4. Verify the task is present in "Pendiente" (default)
    await expect(page.getByText(taskName)).toBeVisible();

    // 5. Verify non-roadmap tasks are NOT present
    // Pick another task from module 1 that we didn't add
    const nonRoadmapTaskName = 'Auditoría HTTPS y Seguridad';
    // Ensure we verify it's NOT visible
    await expect(page.getByText(nonRoadmapTaskName)).not.toBeVisible();

    // 6. Add a new column
    await page.getByRole('button', { name: 'Nueva Columna' }).click();
    await page.getByPlaceholder('Nombre de la columna').fill('Review');
    // Click the confirmation button (it has a Plus icon)
    // Finding the button next to the input
    await page.locator('.animate-in button.bg-blue-600').click();

    // Verify column exists
    await expect(page.getByText('Review', { exact: true })).toBeVisible();

    // 7. Edit Task Details
    // Find inputs within the task card in Kanban
    // We need to target the specific task card
    const kanbanCard = page
      .locator('.flex-1.p-3.overflow-y-auto .bg-white')
      .filter({ hasText: taskName })
      .first();

    await expect(kanbanCard).toBeVisible();

    const assigneeInput = kanbanCard.getByPlaceholder('Asignar a...');
    await assigneeInput.fill('John Doe');
    await assigneeInput.blur();
    await page.waitForTimeout(200);

    const linkInput = kanbanCard.getByPlaceholder('Enlace externo...');
    await linkInput.fill('https://example.com');
    await linkInput.blur();
    await page.waitForTimeout(200);

    const notesInput = kanbanCard.getByPlaceholder('Notas adicionales...');
    await notesInput.fill('Important notes');
    await notesInput.blur();
    await page.waitForTimeout(500);

    // 8. Reload and verify persistence
    await page.reload();
    await page.waitForTimeout(1000);

    // Find the card again
    const kanbanCardReloaded = page
      .locator('.flex-1.p-3.overflow-y-auto .bg-white')
      .filter({ hasText: taskName })
      .first();

    await expect(kanbanCardReloaded.getByPlaceholder('Asignar a...')).toHaveValue('John Doe');
    await expect(kanbanCardReloaded.getByPlaceholder('Enlace externo...')).toHaveValue(
      'https://example.com',
    );
    await expect(kanbanCardReloaded.getByPlaceholder('Notas adicionales...')).toHaveValue(
      'Important notes',
    );

    // 9. Delete the new column
    const reviewColumnHeader = page.locator('.group\\/col').filter({ hasText: 'Review' }).first();
    await reviewColumnHeader.hover();

    // Handle window.confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    // Click delete button (trash icon)
    // The button has a Trash2 icon, usually inside the header
    await reviewColumnHeader.locator('button').click();

    // Verify column is gone
    await expect(page.getByText('Review', { exact: true })).not.toBeVisible();
  });
});
