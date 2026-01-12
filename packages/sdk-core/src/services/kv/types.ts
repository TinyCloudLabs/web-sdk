/**
 * Response headers interface - compatible with standard Headers.
 *
 * @deprecated Use `KVResponseHeaders` from `@tinycloudlabs/sdk-services` instead.
 */
export interface KVResponseHeaders {
  get(name: string): string | null;
}

/**
 * KV operation response - unified across platforms.
 *
 * @deprecated Use `KVResponse` from `@tinycloudlabs/sdk-services` instead.
 */
export interface KVResponse<T = unknown> {
  /** Whether the request was successful (2xx status) */
  ok: boolean;
  /** HTTP status code */
  status: number;
  /** HTTP status text */
  statusText: string;
  /** Response headers */
  headers: KVResponseHeaders;
  /** Parsed response data (undefined for non-2xx or void operations) */
  data?: T;
}

/**
 * Options for KV get operations.
 *
 * @deprecated Use `KVGetOptions` from `@tinycloudlabs/sdk-services` instead.
 */
export interface KVGetOptions {
  /** Return raw response instead of parsed JSON */
  raw?: boolean;
}

/**
 * Options for KV put operations.
 *
 * @deprecated Use `KVPutOptions` from `@tinycloudlabs/sdk-services` instead.
 */
export interface KVPutOptions {
  /** Content type override */
  contentType?: string;
  /** Custom metadata headers */
  metadata?: Record<string, string>;
}

/**
 * Options for KV list operations.
 *
 * @deprecated Use `KVListOptions` from `@tinycloudlabs/sdk-services` instead.
 */
export interface KVListOptions {
  /** Return raw response instead of parsed JSON */
  raw?: boolean;
}
