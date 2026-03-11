import type { StorageQuotaInfo } from "../types";

export interface QuotaConfig {
  /** Called when a storage quota error is detected (402/413) */
  onUpgradeRequired?: (info: StorageQuotaInfo) => void;
}

export interface QuotaStatus {
  /** Storage limit in bytes for this space */
  limitBytes: number;
  /** Storage used in bytes for this space */
  usedBytes?: number;
  /** Remaining storage in bytes */
  remainingBytes?: number;
}

export class TinyCloudQuota {
  private config: QuotaConfig;
  private quotaUrl: string | null = null;

  constructor(config: QuotaConfig = {}) {
    this.config = config;
  }

  /** Set the quota URL discovered from the /version endpoint */
  setQuotaUrl(url: string | null): void {
    this.quotaUrl = url;
  }

  /** Whether a quota service is available */
  get available(): boolean {
    return this.quotaUrl !== null;
  }

  /** Query quota status for a space from the quota URL */
  async getQuota(spaceId: string): Promise<QuotaStatus | null> {
    if (!this.quotaUrl) return null;

    const resp = await fetch(
      `${this.quotaUrl}/api/quota/${encodeURIComponent(spaceId)}`
    );
    if (!resp.ok) return null;

    const data = (await resp.json()) as { storage_limit_bytes?: number };
    return {
      limitBytes: data.storage_limit_bytes ?? 0,
    };
  }

  /** Trigger the upgrade callback when a quota error is encountered */
  handleQuotaError(info: StorageQuotaInfo): void {
    this.config.onUpgradeRequired?.(info);
  }
}
