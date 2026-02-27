/**
 * IDataVaultService - Interface for the encrypted Data Vault service.
 */

import type { IService, Result } from "../types";
import type { KVResponse, KVListResponse } from "../kv";
import type { VaultGetOptions, VaultPutOptions, VaultListOptions, VaultGrantOptions } from "./types";

/**
 * Encrypted vault service interface.
 *
 * Provides encrypted key-value storage with client-side encryption.
 * Keys are derived from a user signature (unlock step).
 */
export interface IDataVaultService extends IService {
  unlock(signer: unknown): Promise<Result<void>>;
  put(key: string, value: unknown, options?: VaultPutOptions): Promise<Result<KVResponse<void>>>;
  get<T = unknown>(key: string, options?: VaultGetOptions): Promise<Result<KVResponse<T>>>;
  list(options?: VaultListOptions): Promise<Result<KVListResponse>>;
  delete(key: string): Promise<Result<void>>;
  head(key: string): Promise<Result<KVResponse<void>>>;
}
