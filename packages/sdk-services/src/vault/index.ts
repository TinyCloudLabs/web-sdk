/**
 * Vault Service Exports
 *
 * Encrypted key-value storage service for TinyCloud SDK.
 */

// Service implementation
export { DataVaultService } from "./DataVaultService";

// Interface
export { IDataVaultService } from "./IDataVaultService";

// Types
export {
  VaultCrypto,
  DataVaultConfig,
  DataVaultTinyCloudConfig,
  VaultPutOptions,
  VaultGetOptions,
  VaultListOptions,
  VaultGrantOptions,
  VaultEntry,
  VaultHeaders,
  VaultError,
  VaultAction,
  VaultActionType,
} from "./types";
