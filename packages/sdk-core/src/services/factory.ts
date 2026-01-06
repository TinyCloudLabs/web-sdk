import { ServiceType, InvokeFunction, ServiceSession } from "./types";
import { KVService, KVServiceConfig } from "./kv/KVService";
import { IKVService } from "./kv/IKVService";

/**
 * Base service configuration.
 */
export interface BaseServiceConfig {
  host: string;
  session: ServiceSession;
  invoke: InvokeFunction;
}

/**
 * Service factory for creating TinyCloud service instances.
 *
 * @example
 * ```typescript
 * const kv = ServiceFactory.createKV({
 *   host: "https://node.tinycloud.xyz",
 *   session: mySession,
 *   invoke: wasmInvoke,
 * });
 * ```
 */
export class ServiceFactory {
  /**
   * Create a service instance by type.
   */
  static create(
    type: ServiceType,
    config: BaseServiceConfig & Partial<KVServiceConfig>
  ): IKVService {
    switch (type) {
      case ServiceType.KV:
        return new KVService(config as KVServiceConfig);
      default:
        throw new Error(`Unknown service type: ${type}`);
    }
  }

  /**
   * Create a KV service (typed convenience method).
   */
  static createKV(config: KVServiceConfig): IKVService {
    return new KVService(config);
  }
}
