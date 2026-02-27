/**
 * IDataVaultService - Interface for the encrypted Data Vault service.
 */

import type { IService, Result } from "../types";
import type { VaultEntry, VaultHeaders, VaultGetOptions, VaultPutOptions, VaultListOptions, VaultGrantOptions } from "./types";

/**
 * Encrypted vault service interface.
 *
 * Provides encrypted key-value storage with client-side encryption.
 * Keys are derived from a user signature (unlock step).
 */
export interface IDataVaultService extends IService {
  unlock(signer: unknown): Promise<Result<void>>;
  put(key: string, value: unknown, options?: VaultPutOptions): Promise<Result<void>>;
  get<T = unknown>(key: string, options?: VaultGetOptions): Promise<Result<VaultEntry<T>>>;
  list(options?: VaultListOptions): Promise<Result<string[]>>;
  delete(key: string): Promise<Result<void>>;
  head(key: string): Promise<Result<VaultHeaders>>;
}
