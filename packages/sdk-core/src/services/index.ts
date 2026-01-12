/**
 * @deprecated This entire module is deprecated. Use `@tinycloudlabs/sdk-services` instead.
 * All exports from this module will be removed in a future major version.
 *
 * Migration:
 * ```typescript
 * // Before (deprecated)
 * import { KVService, ServiceFactory } from "@tinycloudlabs/sdk-core/services";
 *
 * // After (recommended)
 * import { KVService } from "@tinycloudlabs/sdk-services";
 * const kv = tinycloud.getService(KVService);
 * ```
 * @module
 */

// Types
/**
 * @deprecated Use types from `@tinycloudlabs/sdk-services` instead.
 */
export {
  ServiceType,
  ServiceHeaders,
  ServiceSession,
  InvokeFunction,
  FetchFunction,
  FetchRequestInit,
  FetchResponse,
} from "./types";

// KV Service
/**
 * @deprecated Use `KVService` from `@tinycloudlabs/sdk-services` instead.
 */
export {
  IKVService,
  KVResponse,
  KVResponseHeaders,
  KVGetOptions,
  KVPutOptions,
  KVListOptions,
  KVService,
  KVServiceConfig,
} from "./kv";

// Factory
/**
 * @deprecated Use `tinycloud.getService()` pattern from `@tinycloudlabs/sdk-services` instead.
 */
export { ServiceFactory, BaseServiceConfig } from "./factory";
