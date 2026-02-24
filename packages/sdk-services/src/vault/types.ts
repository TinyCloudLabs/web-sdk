/**
 * Data Vault Service Types
 *
 * Type definitions for the Data Vault (encrypted KV) service operations.
 */

/**
 * Configuration for DataVaultService.
 */
export interface DataVaultConfig {
  /** Space ID for encrypted data storage */
  spaceId: string;
  /** Key rotation policy */
  keyRotation?: "per-write" | "per-key"; // default: "per-write"
}

/**
 * Options for vault put operations.
 */
export interface VaultPutOptions {
  /** Custom metadata tags appended to the envelope */
  metadata?: Record<string, string>;
  /** Content type hint for deserialization (default: auto-detect) */
  contentType?: string;
  /** Custom serializer (default: JSON.stringify for objects) */
  serialize?: (value: unknown) => Uint8Array;
}

/**
 * Options for vault get operations.
 */
export interface VaultGetOptions<T = unknown> {
  /** Custom deserializer (default: JSON.parse if content-type is JSON) */
  deserialize?: (data: Uint8Array) => T;
  /** Return raw decrypted bytes without deserialization */
  raw?: boolean;
}

/**
 * Options for vault list operations.
 */
export interface VaultListOptions {
  /** Prefix filter for key names */
  prefix?: string;
  /** Remove prefix from returned keys */
  removePrefix?: boolean;
}

/**
 * Options for vault grant (sharing) operations.
 */
export interface VaultGrantOptions {
  /** Additional metadata on the grant */
  metadata?: Record<string, string>;
}

/**
 * A decrypted vault entry returned by get operations.
 *
 * @template T - Type of the decrypted value
 */
export interface VaultEntry<T> {
  /** Decrypted value */
  value: T;
  /** Envelope metadata */
  metadata: Record<string, string>;
  /** Key ID used for encryption */
  keyId: string;
}

/**
 * Structured error codes for vault operations.
 */
export type VaultError =
  | { code: "DECRYPTION_FAILED"; message: string }
  | { code: "KEY_NOT_FOUND"; key: string }
  | { code: "INTEGRITY_ERROR"; message: string }
  | { code: "GRANT_NOT_FOUND"; grantor: string; key: string }
  | { code: "VAULT_LOCKED"; message: string }
  | { code: "PUBLIC_KEY_NOT_FOUND"; did: string }
  | { code: "STORAGE_ERROR"; cause: Error };

/**
 * Vault action types for UCAN invocations.
 */
export const VaultAction = {
  PUT: "tinycloud.vault/put",
  GET: "tinycloud.vault/get",
  LIST: "tinycloud.vault/list",
  DELETE: "tinycloud.vault/del",
  HEAD: "tinycloud.vault/metadata",
  GRANT: "tinycloud.vault/grant",
  REVOKE: "tinycloud.vault/revoke",
} as const;

export type VaultActionType = (typeof VaultAction)[keyof typeof VaultAction];

/** Metadata header keys used in vault envelopes */
export const VaultHeaders = {
  VERSION: "x-vault-version",
  CIPHER: "x-vault-cipher",
  KEY_ID: "x-vault-key-id",
  CONTENT_TYPE: "x-vault-content-type",
  KDF: "x-vault-kdf",
  KEY_ROTATION: "x-vault-key-rotation",
  GRANT_VERSION: "x-vault-grant-version",
  GRANTOR: "x-vault-grantor",
} as const;
