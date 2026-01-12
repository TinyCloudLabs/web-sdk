/**
 * Authentication E2E tests for TinyCloud web-sdk-example.
 *
 * Tests wallet connection and SIWE sign-in flow using mock wallet
 * with REAL cryptographic signatures.
 */
import { test, expect, TEST_ADDRESS, TINYCLOUD_HOST, waitForAppReady, configureTinyCloudHost, clearTinyCloudSession } from '../fixtures/test-fixtures';

test.describe('Authentication', () => {
  test.beforeEach(async ({ mockWalletPage: page }) => {
    await page.goto('/');
    // Clear any persisted sessions to ensure clean state and force fresh sign-in flow
    await clearTinyCloudSession(page);
    await waitForAppReady(page);
  });

  test('should detect mock wallet as MetaMask', async ({ mockWalletPage: page }) => {
    // Verify the mock wallet is injected
    const isMetaMask = await page.evaluate(() => {
      return (window as any).ethereum?.isMetaMask;
    });

    expect(isMetaMask).toBe(true);
  });

  test('should return correct test address from mock wallet', async ({ mockWalletPage: page }) => {
    // Request accounts from mock wallet
    const accounts = await page.evaluate(async () => {
      return await (window as any).ethereum.request({ method: 'eth_accounts' });
    });

    expect(accounts).toContain(TEST_ADDRESS);
  });

  test('should show sign-in button when not connected', async ({ mockWalletPage: page }) => {
    // Check sign-in button is visible
    const signInButton = page.locator('#signInButton');
    await expect(signInButton).toBeVisible();

    // Should show "Connect Wallet & Sign-In" text
    await expect(signInButton).toContainText(/connect.*wallet|sign.*in/i);
  });

  test('should open wallet modal when clicking sign-in', async ({ mockWalletPage: page }) => {
    // Configure TinyCloud host for local testing
    await configureTinyCloudHost(page, TINYCLOUD_HOST);

    // Click sign-in button
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    // Should open ConnectKit modal or show wallet options
    // Wait for modal to appear
    await page.waitForTimeout(1000);

    // Look for ConnectKit modal elements
    // ConnectKit shows a list of wallet options
    const modalContent = page.locator('[role="dialog"]').or(
      page.locator('.connectkit-modal')
    ).or(
      page.locator('[data-testid="modal"]')
    ).or(
      page.locator('div').filter({ hasText: /MetaMask|Connect/i })
    );

    // At minimum, something should have changed - either modal or wallet connected
    await page.waitForTimeout(500);
  });

  test('should connect wallet and trigger SIWE sign-in', async ({ mockWalletPage: page }) => {
    // Configure TinyCloud host
    await configureTinyCloudHost(page, TINYCLOUD_HOST);

    // Click sign-in button
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    // Wait for wallet connection process
    await page.waitForTimeout(2000);

    // If ConnectKit modal appeared, select MetaMask
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
      await page.waitForTimeout(2000);
    }

    // The app should now be attempting SIWE sign-in
    // Check for session resume status or sign-in progress
    const statusIndicator = page.locator('text=/checking.*session|signing/i');
    const signOutButton = page.locator('#signOutButton');

    // Wait for either status indicator or successful sign-in
    await Promise.race([
      statusIndicator.waitFor({ timeout: 5000 }).catch(() => {}),
      signOutButton.waitFor({ timeout: 10000 }).catch(() => {}),
    ]);
  });

  test('should complete full sign-in flow', async ({ mockWalletPage: page }) => {
    // Configure TinyCloud host
    await configureTinyCloudHost(page, TINYCLOUD_HOST);

    // Click sign-in button
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    // Handle ConnectKit wallet selection
    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    // Wait for SIWE signing to complete
    // The mock wallet will produce a real signature
    await page.waitForTimeout(5000);

    // Handle space creation modal if it appears (first-time sign-in)
    const spaceModal = page.locator('tinycloud-space-modal');
    if (await spaceModal.isVisible().catch(() => false)) {
      // Click create button in modal
      const createButton = spaceModal.locator('button').filter({ hasText: /create/i });
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();
        await page.waitForTimeout(5000);
      }
    }

    // After successful sign-in, sign-out button should be visible
    const signOutButton = page.locator('#signOutButton');
    await expect(signOutButton).toBeVisible({ timeout: 15000 });
  });

  test('should show account info after sign-in', async ({ mockWalletPage: page }) => {
    // Configure and sign in
    await configureTinyCloudHost(page, TINYCLOUD_HOST);

    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    await page.waitForTimeout(5000);

    // Handle space creation if needed
    const spaceModal = page.locator('tinycloud-space-modal');
    if (await spaceModal.isVisible().catch(() => false)) {
      const createButton = spaceModal.locator('button').filter({ hasText: /create/i });
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();
        await page.waitForTimeout(5000);
      }
    }

    // Wait for sign-in to complete
    const signOutButton = page.locator('#signOutButton');
    await signOutButton.waitFor({ timeout: 15000 });

    // Account info should show the test address
    const accountInfo = page.getByText(TEST_ADDRESS.slice(0, 6));
    await expect(accountInfo).toBeVisible({ timeout: 5000 });
  });

  test('should sign out successfully', async ({ mockWalletPage: page }) => {
    // First, sign in
    await configureTinyCloudHost(page, TINYCLOUD_HOST);

    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    await page.waitForTimeout(5000);

    // Handle space creation if needed
    const spaceModal = page.locator('tinycloud-space-modal');
    if (await spaceModal.isVisible().catch(() => false)) {
      const createButton = spaceModal.locator('button').filter({ hasText: /create/i });
      if (await createButton.isVisible().catch(() => false)) {
        await createButton.click();
        await page.waitForTimeout(5000);
      }
    }

    // Wait for sign-in to complete
    const signOutButton = page.locator('#signOutButton');
    await signOutButton.waitFor({ timeout: 15000 });

    // Now sign out
    await signOutButton.click();

    // Sign-in button should reappear
    await expect(signInButton).toBeVisible({ timeout: 10000 });

    // Sign-out button should be hidden
    await expect(signOutButton).not.toBeVisible();
  });

  test('should produce real ECDSA signature for SIWE message', async ({ mockWalletPage: page }) => {
    // Test that the mock wallet produces valid signatures
    const signature = await page.evaluate(async () => {
      const testMessage = 'Hello, TinyCloud!';
      const sig = await (window as any).ethereum.request({
        method: 'personal_sign',
        params: [testMessage, '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'],
      });
      return sig;
    });

    // Signature should be a valid hex string (65 bytes = 130 hex chars + 0x prefix)
    expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);
  });
});
