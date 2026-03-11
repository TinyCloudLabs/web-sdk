/**
 * TinyCloudBilling - Standalone helper for interacting with the billing sidecar.
 *
 * This is NOT part of the core SDK service architecture. It is a lightweight
 * client for the billing API that apps can use to create checkout sessions,
 * manage subscriptions, and handle storage quota upgrade flows.
 */

import type { StorageQuotaInfo } from "../types";

/**
 * Configuration for the billing helper.
 */
export interface BillingConfig {
  /** Base URL of the billing sidecar (e.g., "https://billing.tinycloud.xyz") */
  billingUrl: string;
  /** Callback invoked when a storage quota error is handled */
  onUpgradeRequired?: (info: StorageQuotaInfo) => void;
}

/**
 * Options for creating a Stripe checkout session.
 */
export interface CheckoutOptions {
  /** The user's primary DID */
  did: string;
  /** The space ID to upgrade */
  spaceId: string;
  /** URL to redirect to after checkout completes */
  returnUrl: string;
}

/**
 * Subscription status returned by the billing API.
 */
export interface SubscriptionStatus {
  /** Subscription status (e.g., "active", "canceled", "past_due") */
  status: string;
  /** Storage limit in bytes for the current plan */
  storage_limit_bytes: number;
  /** ISO 8601 timestamp of current billing period end */
  current_period_end?: string;
  /** Whether the subscription is set to cancel at period end */
  cancel_at_period_end?: boolean;
}

/**
 * Billing helper for TinyCloud storage upgrades.
 *
 * @example
 * ```typescript
 * const billing = new TinyCloudBilling({
 *   billingUrl: 'https://billing.tinycloud.xyz',
 *   onUpgradeRequired: (info) => {
 *     // Show upgrade modal to the user
 *     showUpgradeModal(info);
 *   },
 * });
 *
 * // Create a checkout session
 * const { url } = await billing.createCheckout({
 *   did: tc.did,
 *   spaceId: tc.spaceId,
 *   returnUrl: window.location.href,
 * });
 * window.location.href = url;
 * ```
 */
export class TinyCloudBilling {
  private config: BillingConfig;

  constructor(config: BillingConfig) {
    this.config = config;
  }

  /**
   * Create a Stripe checkout session for upgrading storage.
   *
   * @param options - Checkout options including DID, spaceId, and return URL
   * @returns Object containing the checkout URL to redirect the user to
   */
  async createCheckout(
    options: CheckoutOptions
  ): Promise<{ url: string }> {
    const resp = await fetch(`${this.config.billingUrl}/api/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        did: options.did,
        space_id: options.spaceId,
        return_url: options.returnUrl,
      }),
    });
    if (!resp.ok) {
      const error = await resp.json().catch(() => ({}));
      throw new Error(
        (error as { error?: string }).error ||
          "Failed to create checkout session"
      );
    }
    return resp.json() as Promise<{ url: string }>;
  }

  /**
   * Get the current subscription status for a user.
   *
   * @param did - The user's primary DID
   * @returns The subscription status
   */
  async getSubscription(did: string): Promise<SubscriptionStatus> {
    const resp = await fetch(
      `${this.config.billingUrl}/api/subscription/${encodeURIComponent(did)}`
    );
    if (!resp.ok) {
      throw new Error("Failed to fetch subscription status");
    }
    return resp.json() as Promise<SubscriptionStatus>;
  }

  /**
   * Create a Stripe customer portal session for managing the subscription.
   *
   * @param did - The user's primary DID
   * @param returnUrl - URL to redirect to after portal session
   * @returns Object containing the portal URL to redirect the user to
   */
  async createPortalSession(
    did: string,
    returnUrl: string
  ): Promise<{ url: string }> {
    const resp = await fetch(`${this.config.billingUrl}/api/portal`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ did, return_url: returnUrl }),
    });
    if (!resp.ok) {
      throw new Error("Failed to create portal session");
    }
    return resp.json() as Promise<{ url: string }>;
  }

  /**
   * Handle a storage quota error by invoking the onUpgradeRequired callback.
   * Call this from a service error handler when a quota error is detected.
   *
   * @param info - Storage quota information from the error
   */
  handleQuotaError(info: StorageQuotaInfo): void {
    if (this.config.onUpgradeRequired) {
      this.config.onUpgradeRequired(info);
    }
  }
}
