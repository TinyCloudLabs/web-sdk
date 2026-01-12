import { KVResponse, KVGetOptions, KVPutOptions, KVListOptions } from "./types";

/**
 * Platform-agnostic KV service interface.
 *
 * Implementations use dependency injection for the invoke function,
 * allowing the same service to work with different WASM bindings.
 *
 * @deprecated Use `IKVService` from `@tinycloudlabs/sdk-services` instead.
 * This interface will be removed in a future major version.
 *
 * Migration:
 * ```typescript
 * import { IKVService, KVService } from "@tinycloudlabs/sdk-services";
 * const kv = tinycloud.getService(KVService);
 * ```
 */
export interface IKVService {
  /**
   * Get a value by key.
   * @param key - The key to retrieve
   * @param options - Optional get configuration
   * @returns Response with parsed data
   */
  get<T = unknown>(key: string, options?: KVGetOptions): Promise<KVResponse<T>>;

  /**
   * Store a value at a key.
   * @param key - The key to store under
   * @param value - The value to store (will be JSON stringified if object)
   * @param options - Optional put configuration
   */
  put(
    key: string,
    value: unknown,
    options?: KVPutOptions
  ): Promise<KVResponse<void>>;

  /**
   * List keys with optional prefix.
   * @param prefix - Optional prefix to filter keys
   * @param options - Optional list configuration
   * @returns Response with array of keys
   */
  list(prefix?: string, options?: KVListOptions): Promise<KVResponse<string[]>>;

  /**
   * Delete a key.
   * @param key - The key to delete
   */
  delete(key: string): Promise<KVResponse<void>>;

  /**
   * Get metadata for a key (head operation).
   * @param key - The key to check
   * @returns Response with headers only
   */
  head(key: string): Promise<KVResponse<void>>;
}
