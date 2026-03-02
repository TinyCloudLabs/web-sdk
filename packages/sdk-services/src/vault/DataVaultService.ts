/**
 * DataVaultService - Encrypted key-value storage service.
 *
 * Provides client-side encrypted KV storage. Data is encrypted before
 * being stored via the underlying KV service, and decrypted on retrieval.
 * Encryption keys are derived from a user signature (unlock step).
 */

import { BaseService } from "../base/BaseService";
import type { Result } from "../types";
import { ok, err, serviceError } from "../types";
import { IDataVaultService } from "./IDataVaultService";
import { DataVaultConfig, VaultCrypto, VaultEntry, VaultHeaders, VaultGetOptions, VaultPutOptions, VaultListOptions } from "./types";

const VAULT_PREFIX = "vault/";
const UNLOCK_CHALLENGE = "TinyCloud Vault Unlock";
const MASTER_KEY_INFO = "vault-master-key";
const ITEM_KEY_INFO_PREFIX = "vault-item-";

export class DataVaultService extends BaseService implements IDataVaultService {
  static readonly serviceName = "vault";

  private _vaultConfig: DataVaultConfig;
  private _masterKey: Uint8Array | null = null;

  constructor(config: DataVaultConfig) {
    super();
    this._vaultConfig = config;
  }

  get vaultConfig(): DataVaultConfig {
    return this._vaultConfig;
  }

  private get crypto(): VaultCrypto {
    return this._vaultConfig.crypto;
  }

  private get isUnlocked(): boolean {
    return this._masterKey !== null;
  }

  private requireUnlocked(): Result<void> {
    if (!this._masterKey) {
      return { ok: false, error: serviceError("VAULT_LOCKED", "Vault is locked. Call unlock() first.", "vault") };
    }
    return { ok: true, data: undefined };
  }

  private deriveItemKey(key: string): Uint8Array {
    return this.crypto.deriveKey(this._masterKey!, ITEM_KEY_INFO_PREFIX + key);
  }

  async unlock(signer: unknown): Promise<Result<void>> {
    try {
      // signer is expected to have a signMessage method (e.g., ethers Signer)
      const signerObj = signer as { signMessage: (message: string) => Promise<string> };
      if (!signerObj || typeof signerObj.signMessage !== 'function') {
        return err(serviceError("INVALID_INPUT", "Signer must have a signMessage() method", "vault"));
      }

      const signature = await signerObj.signMessage(UNLOCK_CHALLENGE);
      const signatureBytes = new TextEncoder().encode(signature);
      this._masterKey = this.crypto.deriveKey(signatureBytes, MASTER_KEY_INFO);
      return ok(undefined);
    } catch (error) {
      return err(serviceError(
        "VAULT_UNLOCK_FAILED",
        `Failed to unlock vault: ${error instanceof Error ? error.message : String(error)}`,
        "vault",
        { cause: error instanceof Error ? error : undefined }
      ));
    }
  }

  async put(key: string, value: unknown, _options?: VaultPutOptions): Promise<Result<void>> {
    const unlockCheck = this.requireUnlocked();
    if (!unlockCheck.ok) return unlockCheck;

    try {
      const encKey = this.deriveItemKey(key);
      const serialized = new TextEncoder().encode(JSON.stringify(value));
      const encrypted = this.crypto.encrypt(serialized, encKey);

      const kvResult = await this._vaultConfig.tc.kv.put(VAULT_PREFIX + key, encrypted);
      if (!kvResult.ok) {
        return err(serviceError(
          "VAULT_WRITE_FAILED",
          `Failed to store vault entry "${key}": ${kvResult.error.message}`,
          "vault"
        ));
      }
      return ok(undefined);
    } catch (error) {
      return err(serviceError(
        "VAULT_WRITE_FAILED",
        `Failed to store vault entry "${key}": ${error instanceof Error ? error.message : String(error)}`,
        "vault",
        { cause: error instanceof Error ? error : undefined }
      ));
    }
  }

  async get<T = unknown>(key: string, _options?: VaultGetOptions): Promise<Result<VaultEntry<T>>> {
    const unlockCheck = this.requireUnlocked();
    if (!unlockCheck.ok) return unlockCheck as Result<VaultEntry<T>>;

    try {
      const kvResult = await this._vaultConfig.tc.kv.get<Uint8Array>(VAULT_PREFIX + key, { raw: true });
      if (!kvResult.ok) {
        return err(serviceError(
          "VAULT_READ_FAILED",
          `Failed to read vault entry "${key}": ${kvResult.error.message}`,
          "vault"
        ));
      }

      const encKey = this.deriveItemKey(key);
      const encrypted = kvResult.data.data;

      // Handle the case where data comes as a string (base64 or raw) from the KV service
      let encryptedBytes: Uint8Array;
      if (encrypted instanceof Uint8Array) {
        encryptedBytes = encrypted;
      } else if (typeof encrypted === 'string') {
        // KV service may return base64 encoded data
        encryptedBytes = Uint8Array.from(atob(encrypted as string), c => c.charCodeAt(0));
      } else {
        return err(serviceError("VAULT_READ_FAILED", `Unexpected data type for vault entry "${key}"`, "vault"));
      }

      const decrypted = this.crypto.decrypt(encryptedBytes, encKey);
      const jsonStr = new TextDecoder().decode(decrypted);
      const value = JSON.parse(jsonStr) as T;

      return ok({
        key,
        keyId: VAULT_PREFIX + key,
        value,
      });
    } catch (error) {
      return err(serviceError(
        "VAULT_READ_FAILED",
        `Failed to read vault entry "${key}": ${error instanceof Error ? error.message : String(error)}`,
        "vault",
        { cause: error instanceof Error ? error : undefined }
      ));
    }
  }

  async list(options?: VaultListOptions): Promise<Result<string[]>> {
    const unlockCheck = this.requireUnlocked();
    if (!unlockCheck.ok) return unlockCheck as Result<string[]>;

    try {
      const listPrefix = VAULT_PREFIX + (options?.prefix ?? "");
      const kvResult = await this._vaultConfig.tc.kv.list({ prefix: listPrefix });
      if (!kvResult.ok) {
        return err(serviceError(
          "VAULT_LIST_FAILED",
          `Failed to list vault entries: ${kvResult.error.message}`,
          "vault"
        ));
      }

      // Strip the vault/ prefix from returned keys
      const keys = kvResult.data.keys.map((k: string) =>
        k.startsWith(VAULT_PREFIX) ? k.slice(VAULT_PREFIX.length) : k
      );
      return ok(keys);
    } catch (error) {
      return err(serviceError(
        "VAULT_LIST_FAILED",
        `Failed to list vault entries: ${error instanceof Error ? error.message : String(error)}`,
        "vault",
        { cause: error instanceof Error ? error : undefined }
      ));
    }
  }

  async delete(key: string): Promise<Result<void>> {
    const unlockCheck = this.requireUnlocked();
    if (!unlockCheck.ok) return unlockCheck;

    try {
      const kvResult = await this._vaultConfig.tc.kv.delete(VAULT_PREFIX + key);
      if (!kvResult.ok) {
        return err(serviceError(
          "VAULT_DELETE_FAILED",
          `Failed to delete vault entry "${key}": ${kvResult.error.message}`,
          "vault"
        ));
      }
      return ok(undefined);
    } catch (error) {
      return err(serviceError(
        "VAULT_DELETE_FAILED",
        `Failed to delete vault entry "${key}": ${error instanceof Error ? error.message : String(error)}`,
        "vault",
        { cause: error instanceof Error ? error : undefined }
      ));
    }
  }

  async head(key: string): Promise<Result<VaultHeaders>> {
    const unlockCheck = this.requireUnlocked();
    if (!unlockCheck.ok) return unlockCheck as Result<VaultHeaders>;

    try {
      const kvResult = await this._vaultConfig.tc.kv.head(VAULT_PREFIX + key);
      if (!kvResult.ok) {
        return err(serviceError(
          "VAULT_HEAD_FAILED",
          `Failed to get vault entry metadata "${key}": ${kvResult.error.message}`,
          "vault"
        ));
      }

      const headers = kvResult.data.headers;
      return ok({
        etag: headers?.etag,
        contentType: headers?.contentType,
        lastModified: headers?.lastModified,
        contentLength: headers?.contentLength,
      });
    } catch (error) {
      return err(serviceError(
        "VAULT_HEAD_FAILED",
        `Failed to get vault entry metadata "${key}": ${error instanceof Error ? error.message : String(error)}`,
        "vault",
        { cause: error instanceof Error ? error : undefined }
      ));
    }
  }
}
