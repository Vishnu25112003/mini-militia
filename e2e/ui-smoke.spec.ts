import { test, expect } from '@playwright/test';

test('home screen renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toBeVisible();
  await page.screenshot({ path: 'e2e/.results/home.png', fullPage: true });
});
