/**
 * @tinycloudlabs/sdk-core
 *
 * Core TinyCloud SDK package providing shared interfaces and the TinyCloud class.
 *
 * This package defines the platform-agnostic interfaces that both web-sdk and node-sdk
 * implement. The main TinyCloud class accepts an IUserAuthorization implementation,
 * allowing it to work in both browser and Node.js environments.
 *
 * @packageDocumentation
 */

// Signer interface
export { ISigner, Bytes } from "./signer";

// Session storage interface
export {
  ISessionStorage,
  PersistedSessionData,
  PersistedTinyCloudSession,
  TinyCloudSession,
} from "./storage";

// User authorization interface and types
export {
  IUserAuthorization,
  TCWExtension,
  TCWEnsData,
  TCWClientSession,
  SiweConfig,
  ConfigOverrides,
  PartialSiweMessage,
  SiweMessage,
  UserAuthorizationConfig,
} from "./userAuthorization";

// Storage interface and types
export {
  ITinyCloudStorage,
  TinyCloudStorageConfig,
  StorageBaseOptions,
  StorageGetOptions,
  StoragePutOptions,
  StorageDeleteOptions,
  StorageListOptions,
  StorageResponse,
  DelegateParams,
  DelegateResponse,
} from "./tinycloudStorage";

// Main TinyCloud class
export {
  TinyCloud,
  TinyCloudConfig,
  StorageFactory,
} from "./TinyCloud";

// Re-export service types from sdk-services for convenience
export {
  // Context
  ServiceContext,
  type ServiceContextConfig,
  type IServiceContext,
  // Service types
  type IService,
  BaseService,
  type ServiceConstructor,
  type ServiceRegistration,
  // KV Service
  KVService,
  type IKVService,
  type KVServiceConfig,
  type KVGetOptions,
  type KVPutOptions,
  type KVListOptions,
  type KVDeleteOptions,
  type KVHeadOptions,
  type KVResponse,
  type KVListResponse,
  type KVResponseHeaders,
  KVAction,
  // Result pattern
  type Result,
  ok,
  err,
  serviceError,
  ErrorCodes,
  type ErrorCode,
  type ServiceError,
  // Session
  type ServiceSession,
  // Platform dependencies
  type InvokeFunction,
  type FetchFunction,
  type FetchRequestInit,
  type FetchResponse,
  type ServiceHeaders,
  // Retry
  type RetryPolicy,
  defaultRetryPolicy,
  // Telemetry
  TelemetryEvents,
  type EventHandler,
  type ServiceRequestEvent,
  type ServiceResponseEvent,
  type ServiceErrorEvent,
  type ServiceRetryEvent,
  // Error helpers
  authRequiredError,
  authExpiredError,
  networkError,
  timeoutError,
  abortedError,
  notFoundError,
  permissionDeniedError,
  wrapError,
  errorResult,
} from "@tinycloudlabs/sdk-services";

// Space utilities
export {
  SpaceHostResult,
  fetchPeerId,
  submitHostDelegation,
  activateSessionWithHost,
} from "./space";

// Legacy Services (deprecated - use @tinycloudlabs/sdk-services instead)
// These are kept for backward compatibility during migration
export {
  ServiceType,
  ServiceFactory,
  BaseServiceConfig,
} from "./services";
// Re-export deprecated KVService from old location with different name for migration
export { KVService as LegacyKVService } from "./services";

// Delegations
export {
  // Result pattern (aliased to avoid conflict with sdk-services Result)
  Result as DelegationResult,
  DelegationError,
  DelegationErrorCodes,
  DelegationErrorCode,
  // Delegation types
  Delegation,
  CreateDelegationParams,
  DelegationChain,
  DelegationApiResponse,
  // Sharing link types
  SharingLink,
  GenerateSharingLinkParams,
  SharingLinkData,
  // Configuration types
  DelegationManagerConfig,
  SharingLinksConfig,
  // Classes
  DelegationManager,
  SharingLinks,
} from "./delegations";
