/**
 * IKVService - Interface for KV (Key-Value) service.
 *
 * Platform-agnostic interface for key-value storage operations.
 * Implementations use dependency injection via IServiceContext.
 */

import { IService, Result } from "../types";
import {
  KVServiceConfig,
  KVGetOptions,
  KVPutOptions,
  KVListOptions,
  KVDeleteOptions,
  KVHeadOptions,
  KVResponse,
  KVListResponse,
} from "./types";

/**
 * KV service interface.
 *
 * Provides key-value storage operations with:
 * - Result type pattern (no throwing)
 * - Optional prefix namespacing
 * - Configurable timeouts
 * - Abort signal support
 *
 * @example
 * ```typescript
 * const result = await kv.get('user/settings');
 * if (result.ok) {
 *   console.log('Settings:', result.data.data);
 * } else {
 *   console.error('Error:', result.error.code);
 * }
 * ```
 */
export interface IKVService extends IService {
  /**
   * Get a value by key.
   *
   * @param key - The key to retrieve
   * @param options - Optional get configuration
   * @returns Result with the stored value and headers
   *
   * @example
   * ```typescript
   * const result = await kv.get<UserSettings>('settings');
   * if (result.ok) {
   *   const settings = result.data.data;
   *   const etag = result.data.headers.etag;
   * }
   * ```
   */
  get<T = unknown>(
    key: string,
    options?: KVGetOptions
  ): Promise<Result<KVResponse<T>>>;

  /**
   * Store a value at a key.
   *
   * Objects are automatically JSON stringified.
   * Strings are stored as-is.
   *
   * @param key - The key to store under
   * @param value - The value to store
   * @param options - Optional put configuration
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * // Store an object (auto-stringified)
   * const result = await kv.put('settings', { theme: 'dark' });
   *
   * // Store a string
   * const result = await kv.put('name', 'Alice');
   * ```
   */
  put(
    key: string,
    value: unknown,
    options?: KVPutOptions
  ): Promise<Result<KVResponse<void>>>;

  /**
   * List keys with optional prefix filtering.
   *
   * @param options - Optional list configuration
   * @returns Result with array of matching keys
   *
   * @example
   * ```typescript
   * // List all keys
   * const result = await kv.list();
   *
   * // List keys with a specific prefix
   * const result = await kv.list({ prefix: 'users/' });
   * ```
   */
  list(options?: KVListOptions): Promise<Result<KVListResponse>>;

  /**
   * Delete a key.
   *
   * @param key - The key to delete
   * @param options - Optional delete configuration
   * @returns Result indicating success/failure
   *
   * @example
   * ```typescript
   * const result = await kv.delete('old-key');
   * if (!result.ok && result.error.code === 'KV_NOT_FOUND') {
   *   console.log('Key already deleted');
   * }
   * ```
   */
  delete(key: string, options?: KVDeleteOptions): Promise<Result<void>>;

  /**
   * Get metadata for a key without retrieving the value.
   *
   * Useful for checking if a key exists or getting headers
   * without downloading the full value.
   *
   * @param key - The key to check
   * @param options - Optional head configuration
   * @returns Result with headers only
   *
   * @example
   * ```typescript
   * const result = await kv.head('large-file');
   * if (result.ok) {
   *   console.log('Size:', result.data.headers.contentLength);
   * }
   * ```
   */
  head(key: string, options?: KVHeadOptions): Promise<Result<KVResponse<void>>>;

  /**
   * Service configuration.
   */
  readonly config: KVServiceConfig;
}
