import { ServiceType, InvokeFunction, ServiceSession } from "./types";
import { KVService, KVServiceConfig } from "./kv/KVService";
import { IKVService } from "./kv/IKVService";

/**
 * Base service configuration.
 *
 * @deprecated Use `ServiceContextConfig` from `@tinycloudlabs/sdk-services` and
 * the `tinycloud.getService()` pattern instead.
 */
export interface BaseServiceConfig {
  host: string;
  session: ServiceSession;
  invoke: InvokeFunction;
}

/**
 * Service factory for creating TinyCloud service instances.
 *
 * @deprecated Use `tinycloud.getService(KVService)` from `@tinycloudlabs/sdk-services` instead.
 * This factory will be removed in a future major version.
 *
 * Migration example:
 * ```typescript
 * // Before (deprecated)
 * const kv = ServiceFactory.createKV({
 *   host: "https://node.tinycloud.xyz",
 *   session: mySession,
 *   invoke: wasmInvoke,
 * });
 *
 * // After (recommended)
 * const tinycloud = new TinyCloud({ userAuth });
 * const kv = tinycloud.getService(KVService);
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
