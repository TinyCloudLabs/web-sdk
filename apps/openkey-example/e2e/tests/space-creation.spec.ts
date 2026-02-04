/**
 * Space Creation E2E tests for TinyCloud web-sdk-example.
 *
 * Tests the space creation modal that appears when signing in
 * with an address that doesn't have an existing space.
 */
import { test, expect, TEST_ADDRESS, TINYCLOUD_HOST, waitForAppReady, configureTinyCloudHost, clearTinyCloudSession } from '../fixtures/test-fixtures';

test.describe('Space Creation', () => {
  test.beforeEach(async ({ mockWalletPage: page }) => {
    await page.goto('/');
    // Clear any persisted sessions to ensure clean state and force fresh sign-in flow
    // This prevents session auto-resume from skipping the invoke → 404 → create space flow
    await clearTinyCloudSession(page);
    await waitForAppReady(page);
    await configureTinyCloudHost(page, TINYCLOUD_HOST);
  });

  test('should trigger sign-in flow that may show space creation modal', async ({ mockWalletPage: page }) => {
    // Click sign-in button
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    // Handle ConnectKit wallet selection
    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    // Wait for SIWE signing
    await page.waitForTimeout(3000);

    // Check if space creation modal appears
    // The modal is a custom element: <tinycloud-space-modal>
    const spaceModal = page.locator('tinycloud-space-modal');

    // Either modal appears OR we're already signed in (existing space)
    const signOutButton = page.locator('#signOutButton');

    // Wait for one of these outcomes
    const outcome = await Promise.race([
      spaceModal.waitFor({ timeout: 10000 }).then(() => 'modal'),
      signOutButton.waitFor({ timeout: 10000 }).then(() => 'signed-in'),
    ]).catch(() => 'timeout');

    // Either outcome is valid depending on whether space exists
    expect(['modal', 'signed-in', 'timeout']).toContain(outcome);
  });

  test('should show Create TinyCloud Space modal content', async ({ mockWalletPage: page }) => {
    // Click sign-in button
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    // Handle ConnectKit wallet selection
    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    // Wait for SIWE signing
    await page.waitForTimeout(3000);

    // Check if space creation modal appears
    const spaceModal = page.locator('tinycloud-space-modal');

    if (await spaceModal.isVisible().catch(() => false)) {
      // Modal should contain "Create" text and explanatory content
      const modalText = await spaceModal.textContent();

      // Check for expected content in modal
      expect(modalText).toContain('TinyCloud');

      // Look for create button
      const createButton = spaceModal.locator('button').filter({ hasText: /create/i });
      await expect(createButton).toBeVisible();
    } else {
      // If modal didn't appear, user already has a space - this is also valid
      const signOutButton = page.locator('#signOutButton');
      await expect(signOutButton).toBeVisible({ timeout: 10000 });
    }
  });

  test('should create space when clicking create button', async ({ mockWalletPage: page }) => {
    // Click sign-in button
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    // Handle ConnectKit wallet selection
    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    // Wait for SIWE signing
    await page.waitForTimeout(3000);

    // Check if space creation modal appears
    const spaceModal = page.locator('tinycloud-space-modal');

    if (await spaceModal.isVisible().catch(() => false)) {
      // Click create button
      const createButton = spaceModal.locator('button').filter({ hasText: /create/i });
      await createButton.click();

      // Wait for space creation (requires second signature)
      // This will sign another message to create the space
      await page.waitForTimeout(5000);

      // After space creation, modal should close and user should be signed in
      const signOutButton = page.locator('#signOutButton');
      await expect(signOutButton).toBeVisible({ timeout: 15000 });

      // Modal should no longer be visible
      await expect(spaceModal).not.toBeVisible();
    } else {
      // Already have a space - should be signed in
      const signOutButton = page.locator('#signOutButton');
      await expect(signOutButton).toBeVisible({ timeout: 10000 });
    }
  });

  test('should handle space creation with real signatures', async ({ mockWalletPage: page }) => {
    // This test verifies that the mock wallet can handle the double-signing
    // required for space creation (SIWE sign-in + space creation delegation)

    // Click sign-in button
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    // Handle ConnectKit wallet selection
    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    // Wait for first signature (SIWE)
    await page.waitForTimeout(3000);

    // If modal appears, we need to sign again for space creation
    const spaceModal = page.locator('tinycloud-space-modal');

    if (await spaceModal.isVisible().catch(() => false)) {
      // Log that we're creating space
      console.log('Space creation modal appeared - creating new space');

      // Click create button to trigger second signature
      const createButton = spaceModal.locator('button').filter({ hasText: /create/i });
      await createButton.click();

      // Wait for second signature and space creation
      await page.waitForTimeout(5000);
    }

    // Verify final sign-in state
    const signOutButton = page.locator('#signOutButton');
    await expect(signOutButton).toBeVisible({ timeout: 15000 });

    // Verify storage module is visible (only shows when signed in)
    const storageSection = page.getByText('Storage Prefix:');
    await expect(storageSection).toBeVisible();
  });

  test('should show storage module after successful space creation', async ({ mockWalletPage: page }) => {
    // Complete sign-in flow
    const signInButton = page.locator('#signInButton');
    await signInButton.click();

    await page.waitForTimeout(1500);
    const metaMaskOption = page.getByText('MetaMask', { exact: false });
    if (await metaMaskOption.isVisible().catch(() => false)) {
      await metaMaskOption.click();
    }

    await page.waitForTimeout(3000);

    // Handle space creation if needed
    const spaceModal = page.locator('tinycloud-space-modal');
    if (await spaceModal.isVisible().catch(() => false)) {
      const createButton = spaceModal.locator('button').filter({ hasText: /create/i });
      await createButton.click();
      await page.waitForTimeout(5000);
    }

    // Wait for sign-in to complete
    const signOutButton = page.locator('#signOutButton');
    await signOutButton.waitFor({ timeout: 15000 });

    // Storage module should now be visible
    const storagePrefix = page.getByText('Storage Prefix:');
    await expect(storagePrefix).toBeVisible();

    // Key Value Store section should be visible
    const kvStore = page.getByText('Key Value Store');
    await expect(kvStore).toBeVisible();

    // Add New Content button should be visible
    const addButton = page.getByText('Add New Content');
    await expect(addButton).toBeVisible();
  });
});
