import { test, expect } from '@playwright/test';

test('create and switch client', async ({ page }) => {
  await page.goto('/#/app/');

  // Find the client switcher button in the header (visible on desktop)
  const switcherButton = page.locator('header button.w-full.flex.items-center.justify-between');

  await expect(switcherButton).toBeVisible();
  await switcherButton.click();

  // Click "Nuevo Proyecto" inside the dropdown
  const newProjectBtn = page.getByRole('button', { name: 'Nuevo Proyecto' });
  await newProjectBtn.click();

  // Fill form
  const nameInput = page.getByPlaceholder('Nombre del Cliente/Medio');
  await nameInput.fill('Test Client E2E');

  // Click "Crear Proyecto"
  await page.getByRole('button', { name: 'Crear Proyecto' }).click();

  // Verify new client is active (name appears in the switcher button)
  await expect(switcherButton).toHaveText(/Test Client E2E/);

  // Clean up: delete the client
  await switcherButton.click();

  // Handle the confirmation dialog
  page.on('dialog', (dialog) => dialog.accept());

  // Find the client item in the list
  // The list is inside the dropdown.
  // We look for the text 'Test Client E2E' and find the delete button within that container.
  const clientRow = page.locator('.group', { hasText: 'Test Client E2E' });
  const deleteBtn = clientRow.locator('button[title="Eliminar Proyecto"]');

  await deleteBtn.click();

  // Verify it's gone from the list (or we switched back to another client)
  // After deletion, the app likely switches to another client.
  await expect(switcherButton).not.toHaveText(/Test Client E2E/);
});
