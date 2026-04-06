import { test, expect } from '@playwright/test';

test('dashboard loads correctly', async ({ page }) => {
  await page.goto('/#/app/');
  await expect(page).toHaveTitle(/MediaFlow SEO/);

  // Verify key dashboard elements
  await expect(page.getByText('Visión General de Madurez')).toBeVisible();

  // Verify modules are present
  await expect(page.getByText('Nivel 0-20')).toBeVisible();

  // Verify global score exists
  await expect(page.getByText('/ 100')).toBeVisible();
});
