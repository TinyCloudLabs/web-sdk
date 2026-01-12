/**
 * TinyCloud SDK Services
 *
 * Platform-agnostic services with plugin architecture for TinyCloud.
 *
 * @packageDocumentation
 * @module @tinycloudlabs/sdk-services
 *
 * @example
 * ```typescript
 * import {
 *   ServiceContext,
 *   BaseService,
 *   Result,
 *   ErrorCodes,
 * } from '@tinycloudlabs/sdk-services';
 *
 * // Create a context
 * const context = new ServiceContext({
 *   invoke: wasmInvoke,
 *   hosts: ['https://node.tinycloud.xyz'],
 * });
 *
 * // Create and register a service
 * const kv = new KVService({ prefix: 'myapp' });
 * context.registerService('kv', kv);
 * kv.initialize(context);
 *
 * // Use the service
 * const result = await kv.get('key');
 * if (result.ok) {
 *   console.log(result.data);
 * }
 * ```
 */

// Core types
export type {
  Result,
  ServiceError,
  ErrorCode,
  IServiceContext,
  IService,
  ServiceSession,
  RetryPolicy,
  InvokeFunction,
  FetchFunction,
  FetchRequestInit,
  FetchResponse,
  ServiceHeaders,
  EventHandler,
  ServiceRequestEvent,
  ServiceResponseEvent,
  ServiceErrorEvent,
  ServiceRetryEvent,
} from "./types";

export {
  ErrorCodes,
  defaultRetryPolicy,
  TelemetryEvents,
  ok,
  err,
  serviceError,
} from "./types";

// Context
export { ServiceContext } from "./context";
export type { ServiceContextConfig } from "./context";

// Errors
export {
  authRequiredError,
  authExpiredError,
  networkError,
  timeoutError,
  abortedError,
  notFoundError,
  permissionDeniedError,
  wrapError,
  errorResult,
} from "./errors";

// Base service
export { BaseService } from "./base/index";
export type {
  ServiceConstructor,
  ServiceRegistration,
  BaseServiceOptions,
} from "./base/index";

// KV service
export { KVService, IKVService, KVAction } from "./kv";
export type {
  KVServiceConfig,
  KVGetOptions,
  KVPutOptions,
  KVListOptions,
  KVDeleteOptions,
  KVHeadOptions,
  KVResponse,
  KVListResponse,
  KVResponseHeaders,
  KVActionType,
} from "./kv";
