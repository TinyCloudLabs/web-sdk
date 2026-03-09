import { test, expect } from '@playwright/test';

// Errors from SvelteKit's own code-splitting are expected in preview mode
const IGNORED_ERRORS = [
  'Failed to fetch dynamically imported module',
  'error loading dynamically imported module',
];

function isBundlingError(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("can't find variable: exports") ||
    lower.includes('exports is not defined') ||
    lower.includes("can't find variable: module") ||
    lower.includes('module is not defined') ||
    lower.includes("can't find variable: require") ||
    lower.includes('require is not defined')
  );
}

function isRelevantError(msg: string): boolean {
  return !IGNORED_ERRORS.some((ignored) => msg.includes(ignored));
}

test.describe('Secrets App — Smoke Tests', () => {
  test('page loads without CJS/ESM bundling errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (isRelevantError(err.message)) {
        errors.push(err.message);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Specifically assert no CJS-in-browser errors (the TC-1195 bug)
    const bundlingErrors = errors.filter(isBundlingError);
    expect(bundlingErrors).toEqual([]);
  });

  test('page renders the connect UI', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // The disconnected state shows the heading and connect button
    await expect(page.getByText('Secrets & Variables')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect with OpenKey' })).toBeVisible();
  });

  test('no bundling errors after clicking connect', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (isRelevantError(err.message)) {
        errors.push(err.message);
      }
    });

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Click connect — this triggers the web-sdk import path
    // It will fail to actually connect (no real OpenKey) but should not crash with CJS errors
    await page.getByRole('button', { name: 'Connect with OpenKey' }).click();

    // Wait a moment for any async errors to surface
    await page.waitForTimeout(2000);

    const bundlingErrors = errors.filter(isBundlingError);
    expect(bundlingErrors).toEqual([]);
  });
});
