import { test, expect } from '@playwright/test';

test('navigate to module and verify task details', async ({ page }) => {
  await page.goto('/#/app/');

  // Click on the 'estrategia' tab first, since modules are there
  await page.getByRole('link', { name: 'estrategia', exact: true }).click();
  // Click on the first module card (M1)
  // It should be visible in the sidebar as "M1:" or something similar.
  await page.getByRole('link', { name: /Módulo 1|M1:/i }).click();

  await expect(page).toHaveURL(/.*#\/app\/module\/1/);

  // Wait for tasks to render
  await expect(page.locator('h1')).toBeVisible();

  // Click the first task in the list to expand it
  // The tasks are in a list, usually rendered as divs with specific classes.
  // We can target the task title.
  const firstTaskTitle = page.locator('h3').first();
  await firstTaskTitle.click();

  // Verify details section expands
  await expect(page.getByText('Impacto de la Tarea')).toBeVisible();

  // Verify "Configurar IA" link is present (assuming no API keys set)
  // or "Vitaminizar" button if keys were somehow set.
  const configLink = page.getByRole('link', { name: 'Configurar IA' });
  const vitaminButton = page.getByRole('button', { name: 'Vitaminizar' });

  await expect(configLink.or(vitaminButton)).toBeVisible();
});
