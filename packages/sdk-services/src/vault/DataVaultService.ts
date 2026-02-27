/**
 * DataVaultService - Encrypted key-value storage service.
 *
 * Stub implementation -- crypto logic to be wired in a follow-up.
 */

import { BaseService } from "../base/BaseService";
import type { Result } from "../types";
import { IDataVaultService } from "./IDataVaultService";
import { DataVaultConfig, VaultEntry, VaultHeaders, VaultGetOptions, VaultPutOptions, VaultListOptions, VaultGrantOptions } from "./types";

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
    throw new Error("DataVaultService: not yet implemented");
  }

  async put(_key: string, _value: unknown, _options?: VaultPutOptions): Promise<Result<void>> {
    throw new Error("DataVaultService: not yet implemented");
  }

  async get<T = unknown>(_key: string, _options?: VaultGetOptions): Promise<Result<VaultEntry<T>>> {
    throw new Error("DataVaultService: not yet implemented");
  }

  async list(_options?: VaultListOptions): Promise<Result<string[]>> {
    throw new Error("DataVaultService: not yet implemented");
  }

  async delete(_key: string): Promise<Result<void>> {
    throw new Error("DataVaultService: not yet implemented");
  }

  async head(_key: string): Promise<Result<VaultHeaders>> {
    throw new Error("DataVaultService: not yet implemented");
  }
}
