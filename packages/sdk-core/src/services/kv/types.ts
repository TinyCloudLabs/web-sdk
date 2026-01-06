/**
 * Response headers interface - compatible with standard Headers.
 */
export interface KVResponseHeaders {
  get(name: string): string | null;
}

/**
 * KV operation response - unified across platforms.
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
 */
export interface KVGetOptions {
  /** Return raw response instead of parsed JSON */
  raw?: boolean;
}

/**
 * Options for KV put operations.
 */
export interface KVPutOptions {
  /** Content type override */
  contentType?: string;
  /** Custom metadata headers */
  metadata?: Record<string, string>;
}

/**
 * Options for KV list operations.
 */
export interface KVListOptions {
  /** Return raw response instead of parsed JSON */
  raw?: boolean;
}
