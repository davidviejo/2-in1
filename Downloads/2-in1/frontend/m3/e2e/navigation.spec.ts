import { test, expect } from '@playwright/test';

test('sidebar navigation works', async ({ page }) => {
  await page.goto('/#/app/');

  // Switch to Estrategia tab to see Roadmap IA
  await page.getByRole('link', { name: 'estrategia', exact: true }).click();

  // Now we should be on Client Roadmap
  await expect(page).toHaveURL(/.*#\/app\/client-roadmap/);

  // The client roadmap might be empty initially, showing a different header
  const header = page.getByRole('heading', { name: 'Roadmap Cliente' });
  const emptyState = page.locator('text=Tu Hoja de Ruta está vacía');
  await expect(header.or(emptyState)).toBeVisible();

  // Navigate to AI Roadmap
  await page.getByRole('link', { name: 'Roadmap IA', exact: false }).click();
  await expect(page).toHaveURL(/.*#\/app\/ai-roadmap/);
  await expect(page.locator('text=Roadmap IA Personalizado')).toBeVisible();

  // Navigate to Settings (inside 'acciones' tab)
  await page.getByRole('link', { name: 'acciones', exact: true }).click();
  await page.getByRole('link', { name: 'Ajustes', exact: false }).click();
  await expect(page).toHaveURL(/.*#\/app\/settings/);
  // Match the actual header in Settings.tsx
  await expect(page.getByRole('heading', { name: 'Ajustes del Sistema' })).toBeVisible();

  // Navigate back to Dashboard
  // There is no explicit "Panel de Control" link in the sidebar, but we can navigate to Analítica.
  await page.getByRole('link', { name: 'Analítica', exact: true }).click();
  await expect(page).toHaveURL(/.*#\/app\//);
  await expect(page.getByText('Visión General de Madurez')).toBeVisible();
});
