/**
 * Data Vault Service Types
 *
 * Type definitions for the Data Vault (encrypted KV) service operations.
 */

import type { IKVService } from "../kv";
import type { Result, ServiceError } from "../types";

/**
 * Cryptographic operations required by the vault.
 * Typically backed by WASM bindings.
 */
export interface VaultCrypto {
  encrypt: (plaintext: Uint8Array, key: Uint8Array) => Uint8Array;
  decrypt: (ciphertext: Uint8Array, key: Uint8Array) => Uint8Array;
  deriveKey: (seed: Uint8Array, info: string) => Uint8Array;
  x25519FromSeed: (seed: Uint8Array) => { publicKey: Uint8Array; secretKey: Uint8Array };
  x25519Dh: (secretKey: Uint8Array, publicKey: Uint8Array) => Uint8Array;
  randomBytes: (length: number) => Uint8Array;
  sha256: (data: Uint8Array) => Uint8Array;
}

/**
 * TinyCloud integration config for vault operations.
 */
export interface DataVaultTinyCloudConfig {
  kv: IKVService;
  ensurePublicSpace: () => Promise<Result<void, ServiceError>>;
  publicKV: IKVService;
  readPublicSpace: <T>(host: string, spaceId: string, key: string) => Promise<Result<T, ServiceError>>;
  makePublicSpaceId: (address: string, chainId: number) => string;
  did: string;
  address: string;
  chainId: number;
  hosts: string[];
}

/**
 * Configuration for DataVaultService constructor.
 */
export interface DataVaultConfig {
  spaceId: string;
  crypto: VaultCrypto;
  tc: DataVaultTinyCloudConfig;
}

/**
 * Options for vault put operations.
 */
export interface VaultPutOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Options for vault get operations.
 */
export interface VaultGetOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Options for vault list operations.
 */
export interface VaultListOptions {
  prefix?: string;
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * Options for vault grant (share access) operations.
 */
export interface VaultGrantOptions {
  timeout?: number;
  signal?: AbortSignal;
}

/**
 * A vault entry returned from get operations.
 */
export interface VaultEntry<T = unknown> {
  key: string;
  keyId: string;
  value: T;
  metadata?: Record<string, string>;
}

/**
 * Response headers from vault operations.
 */
export interface VaultHeaders {
  etag?: string;
  contentType?: string;
  lastModified?: string;
  contentLength?: number;
}

/**
 * Vault-specific error.
 */
export interface VaultError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Vault action types (ability strings).
 */
export const VaultAction = {
  PUT: "tinycloud.vault/put",
  GET: "tinycloud.vault/get",
  LIST: "tinycloud.vault/list",
  DELETE: "tinycloud.vault/del",
  HEAD: "tinycloud.vault/metadata",
  GRANT: "tinycloud.vault/grant",
} as const;

export type VaultActionType = (typeof VaultAction)[keyof typeof VaultAction];
