import type { StorageQuotaInfo } from "../types";

export interface BillingConfig {
  /** Base URL of the billing sidecar (e.g., "https://billing.tinycloud.xyz") */
  billingUrl: string;
  /** Callback invoked when a storage quota error is handled */
  onUpgradeRequired?: (info: StorageQuotaInfo) => void;
}

export interface CheckoutOptions {
  /** The user's primary DID */
  did: string;
  /** The space ID to upgrade */
  spaceId: string;
  /** URL to redirect to after checkout completes */
  returnUrl: string;
}

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

export class TinyCloudBilling {
  private config: BillingConfig;

  constructor(config: BillingConfig) {
    this.config = config;
  }

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

  async getSubscription(did: string): Promise<SubscriptionStatus> {
    const resp = await fetch(
      `${this.config.billingUrl}/api/subscription/${encodeURIComponent(did)}`
    );
    if (!resp.ok) {
      throw new Error("Failed to fetch subscription status");
    }
    return resp.json() as Promise<SubscriptionStatus>;
  }

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

  handleQuotaError(info: StorageQuotaInfo): void {
    if (this.config.onUpgradeRequired) {
      this.config.onUpgradeRequired(info);
    }
  }
}
