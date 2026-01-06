import {
  InvokeFunction,
  FetchFunction,
  FetchResponse,
  ServiceSession,
} from "../types";
import { IKVService } from "./IKVService";
import {
  KVResponse,
  KVGetOptions,
  KVPutOptions,
  KVListOptions,
} from "./types";

/**
 * Configuration for KVService.
 */
export interface KVServiceConfig {
  /** TinyCloud host URL */
  host: string;
  /** Active session for authentication */
  session: ServiceSession;
  /** Platform-specific invoke function (from WASM binding) */
  invoke: InvokeFunction;
  /** Optional path prefix for all operations (used for delegated access) */
  pathPrefix?: string;
  /** Optional custom fetch implementation */
  fetch?: FetchFunction;
}

/**
 * KV service actions.
 */
const KVAction = {
  GET: "tinycloud.kv/get",
  PUT: "tinycloud.kv/put",
  LIST: "tinycloud.kv/list",
  DELETE: "tinycloud.kv/del",
  HEAD: "tinycloud.kv/metadata",
} as const;

/**
 * Platform-agnostic KV service implementation.
 *
 * Uses dependency injection for the invoke function, allowing the same
 * implementation to work with both node-sdk-wasm and web-sdk-wasm.
 *
 * @example Node.js
 * ```typescript
 * import { invoke } from "@tinycloudlabs/node-sdk-wasm";
 * const kv = new KVService({ host, session, invoke });
 * ```
 *
 * @example Browser
 * ```typescript
 * import { invoke } from "./module"; // Proxies to web-sdk-wasm
 * const kv = new KVService({ host, session, invoke });
 * ```
 */
export class KVService implements IKVService {
  private host: string;
  private session: ServiceSession;
  private invoke: InvokeFunction;
  private pathPrefix: string;
  private fetchFn: FetchFunction;

  constructor(config: KVServiceConfig) {
    this.host = config.host;
    this.session = config.session;
    this.invoke = config.invoke;
    this.pathPrefix = config.pathPrefix ?? "";
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Update the session (e.g., after re-authentication).
   */
  public updateSession(session: ServiceSession): void {
    this.session = session;
  }

  /**
   * Get the full path with optional prefix.
   */
  private getFullPath(key: string): string {
    return this.pathPrefix ? `${this.pathPrefix}${key}` : key;
  }

  /**
   * Execute an invoke operation.
   */
  private async invokeOperation(
    path: string,
    action: string,
    body?: Blob | string
  ): Promise<FetchResponse> {
    const headers = this.invoke(this.session, "kv", path, action);

    return this.fetchFn(`${this.host}/invoke`, {
      method: "POST",
      headers,
      body,
    });
  }

  /**
   * Convert fetch Response to KVResponse.
   */
  private async toKVResponse<T>(
    response: FetchResponse,
    parseBody: boolean = true
  ): Promise<KVResponse<T>> {
    const { ok, status, statusText, headers } = response;

    let data: T | undefined;
    if (parseBody && ok) {
      const contentType = headers.get("content-type");
      if (contentType?.includes("application/json")) {
        data = (await response.json()) as T;
      } else if (contentType?.startsWith("text/")) {
        data = (await response.text()) as unknown as T;
      }
    }

    return { ok, status, statusText, headers, data };
  }

  async get<T = unknown>(
    key: string,
    options?: KVGetOptions
  ): Promise<KVResponse<T>> {
    const path = this.getFullPath(key);
    const response = await this.invokeOperation(path, KVAction.GET);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to get key "${key}": ${response.status} - ${error}`
      );
    }

    return this.toKVResponse<T>(response, !options?.raw);
  }

  async put(
    key: string,
    value: unknown,
    options?: KVPutOptions
  ): Promise<KVResponse<void>> {
    const path = this.getFullPath(key);

    // Serialize value to string
    let body: string;
    if (typeof value === "string") {
      body = value;
    } else {
      body = JSON.stringify(value);
    }

    const response = await this.invokeOperation(path, KVAction.PUT, body);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to put key "${key}": ${response.status} - ${error}`
      );
    }

    return this.toKVResponse<void>(response, false);
  }

  async list(
    prefix?: string,
    options?: KVListOptions
  ): Promise<KVResponse<string[]>> {
    const path = this.getFullPath(prefix ?? "");
    const response = await this.invokeOperation(path, KVAction.LIST);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to list keys: ${response.status} - ${error}`);
    }

    return this.toKVResponse<string[]>(response, !options?.raw);
  }

  async delete(key: string): Promise<KVResponse<void>> {
    const path = this.getFullPath(key);
    const response = await this.invokeOperation(path, KVAction.DELETE);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to delete key "${key}": ${response.status} - ${error}`
      );
    }

    return this.toKVResponse<void>(response, false);
  }

  async head(key: string): Promise<KVResponse<void>> {
    const path = this.getFullPath(key);
    const response = await this.invokeOperation(path, KVAction.HEAD);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Failed to get metadata for key "${key}": ${response.status} - ${error}`
      );
    }

    return this.toKVResponse<void>(response, false);
  }
}
