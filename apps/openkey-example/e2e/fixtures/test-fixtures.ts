/**
 * Playwright test fixtures with mock wallet injection.
 *
 * Provides:
 * - page: A page with mock ethereum wallet injected before scripts run
 * - TEST_ADDRESS: The test wallet address for assertions
 * - TINYCLOUD_HOST: The TinyCloud host URL from environment
 */
import { test as base, expect, Page } from '@playwright/test';
import { getMockWalletScript, TEST_ADDRESS } from './mock-wallet';

// Get TinyCloud host from environment or use default
const TINYCLOUD_HOST = process.env.TINYCLOUD_HOST || 'http://localhost:8000';

// Extend the base test with our fixtures
export const test = base.extend<{
  // The page with mock wallet injected
  mockWalletPage: Page;
}>({
  // Override the default page to inject mock wallet
  mockWalletPage: async ({ page }, use) => {
    // Inject mock ethereum BEFORE any page scripts run
    await page.addInitScript(getMockWalletScript());

    // Use the page with mock wallet
    await use(page);
  },
});

// Re-export expect and test address for convenience
export { expect, TEST_ADDRESS, TINYCLOUD_HOST };

/**
 * Helper to wait for the app to be ready.
 * The app shows a loading state while React hydrates.
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the main content to appear (not the loading fallback)
  await page.waitForSelector('text=TinyCloud', { timeout: 30000 });
}

/**
 * Helper to clear TinyCloud session data from storage.
 * Call this before each test to ensure clean state and force fresh sign-in flow.
 *
 * This is critical because:
 * 1. Session auto-resume is ON by default
 * 2. Resumed sessions skip the invoke → 404 → create space flow
 * 3. Errors during resumed sessions are silently caught
 */
export async function clearTinyCloudSession(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Clear all TinyCloud session keys from localStorage
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('tinycloud_session')) {
        localStorage.removeItem(key);
      }
    });
    // Also clear from sessionStorage if used
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('tinycloud_session')) {
        sessionStorage.removeItem(key);
      }
    });
  });
}

/**
 * Helper to configure TinyCloud host in Advanced Options.
 */
export async function configureTinyCloudHost(page: Page, host: string = TINYCLOUD_HOST): Promise<void> {
  // Only configure if not using default production host
  if (host && !host.includes('node.tinycloud.xyz')) {
    // Open Advanced Options accordion
    const advancedOptions = page.getByText('Advanced Options');

    // Check if accordion is collapsed (content not visible)
    const accordionContent = page.locator('[data-state="open"]').filter({ hasText: 'TinyCloud Host' });
    if (!(await accordionContent.isVisible().catch(() => false))) {
      await advancedOptions.click();
      // Wait for accordion to open
      await page.waitForTimeout(300);
    }

    // Find and fill the TinyCloud Host input
    const hostInput = page.getByPlaceholder('node.tinycloud.xyz');
    await hostInput.fill(host);

    // Close accordion to clean up UI
    await advancedOptions.click();
    await page.waitForTimeout(300);
  }
}

/**
 * Helper to connect wallet via ConnectKit.
 * ConnectKit uses a modal with "Injected" or "MetaMask" option.
 */
export async function connectWallet(page: Page): Promise<void> {
  // Look for ConnectKit button (usually shows "Connect Wallet" text)
  // ConnectKit uses a custom button component
  const connectButton = page.locator('button').filter({ hasText: /connect.*wallet/i }).first();

  if (await connectButton.isVisible().catch(() => false)) {
    await connectButton.click();

    // Wait for ConnectKit modal
    await page.waitForTimeout(500);

    // Look for MetaMask or Injected option in the modal
    const metaMaskOption = page.getByText('MetaMask', { exact: false }).first();
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    // Wait for connection to complete
    await page.waitForTimeout(1000);
  }
}

/**
 * Helper to sign in to TinyCloud.
 * Assumes wallet is already connected.
 */
export async function signInToTinyCloud(page: Page): Promise<void> {
  const signInButton = page.locator('#signInButton');

  if (await signInButton.isVisible()) {
    await signInButton.click();

    // Wait for sign-in to complete (button should change to sign out)
    // Or space creation modal may appear
    await page.waitForTimeout(3000);
  }
}

/**
 * Helper to handle space creation modal if it appears.
 * The modal is a web component with shadow DOM.
 */
export async function handleSpaceCreationModal(page: Page): Promise<boolean> {
  // The space modal is a custom element: <tinycloud-space-modal>
  const spaceModal = page.locator('tinycloud-space-modal');

  // Check if modal is visible
  const isVisible = await spaceModal.isVisible().catch(() => false);

  if (isVisible) {
    // The modal has shadow DOM, so we need to use evaluate to access it
    // Or use Playwright's shadow DOM piercing: >>

    // Look for create button inside the modal
    // ConnectKit uses shadow DOM, so we may need to wait and click
    const createButton = spaceModal.locator('button').filter({ hasText: /create/i }).first();

    if (await createButton.isVisible().catch(() => false)) {
      await createButton.click();

      // Wait for space creation (requires signing)
      await page.waitForTimeout(5000);
      return true;
    }
  }

  return false;
}

/**
 * Helper to perform full sign-in flow including space creation.
 */
export async function fullSignIn(page: Page, host?: string): Promise<void> {
  await waitForAppReady(page);

  // Configure TinyCloud host if needed
  if (host) {
    await configureTinyCloudHost(page, host);
  }

  // Click sign in button (will open ConnectKit if not connected)
  const signInButton = page.locator('#signInButton');
  await signInButton.click();

  // Wait for ConnectKit modal or for wallet to connect
  await page.waitForTimeout(1000);

  // Handle ConnectKit wallet selection if modal appeared
  await connectWallet(page);

  // Wait for SIWE signing and potential space creation
  await page.waitForTimeout(3000);

  // Handle space creation modal if it appears
  await handleSpaceCreationModal(page);

  // Wait for sign-in to complete
  await page.waitForSelector('#signOutButton', { timeout: 15000 });
}

/**
 * Helper to sign out of TinyCloud.
 */
export async function signOut(page: Page): Promise<void> {
  const signOutButton = page.locator('#signOutButton');

  if (await signOutButton.isVisible()) {
    await signOutButton.click();

    // Wait for sign-out to complete
    await page.waitForSelector('#signInButton', { timeout: 10000 });
  }
}

/**
 * Helper to check if user is signed in.
 */
export async function isSignedIn(page: Page): Promise<boolean> {
  const signOutButton = page.locator('#signOutButton');
  return signOutButton.isVisible();
}
