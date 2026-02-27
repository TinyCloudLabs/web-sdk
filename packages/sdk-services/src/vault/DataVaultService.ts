/**
 * DataVaultService - Encrypted key-value storage service.
 *
 * Stub implementation -- crypto logic to be wired in a follow-up.
 */

import { BaseService } from "../base/BaseService";
import type { Result } from "../types";
import { serviceError } from "../types";
import { IDataVaultService } from "./IDataVaultService";
import { DataVaultConfig, VaultEntry, VaultHeaders, VaultGetOptions, VaultPutOptions, VaultListOptions, VaultGrantOptions } from "./types";

const STUB_ERROR = (method: string) =>
  serviceError("VAULT_NOT_IMPLEMENTED", `DataVaultService.${method}() is not yet implemented`, "vault");

export class DataVaultService extends BaseService implements IDataVaultService {
  static readonly serviceName = "vault";

  private _vaultConfig: DataVaultConfig;

  constructor(config: DataVaultConfig) {
    super();
    this._vaultConfig = config;
  }

  get vaultConfig(): DataVaultConfig {
    return this._vaultConfig;
  }

  async unlock(_signer: unknown): Promise<Result<void>> {
    return { ok: false, error: STUB_ERROR("unlock") };
  }

  async put(_key: string, _value: unknown, _options?: VaultPutOptions): Promise<Result<void>> {
    return { ok: false, error: STUB_ERROR("put") };
  }

  async get<T = unknown>(_key: string, _options?: VaultGetOptions): Promise<Result<VaultEntry<T>>> {
    return { ok: false, error: STUB_ERROR("get") };
  }

  async list(_options?: VaultListOptions): Promise<Result<string[]>> {
    return { ok: false, error: STUB_ERROR("list") };
  }

  async delete(_key: string): Promise<Result<void>> {
    return { ok: false, error: STUB_ERROR("delete") };
  }

  async head(_key: string): Promise<Result<VaultHeaders>> {
    return { ok: false, error: STUB_ERROR("head") };
  }
}
