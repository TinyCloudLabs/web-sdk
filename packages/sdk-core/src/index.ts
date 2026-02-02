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

// Session storage interface and schemas
export {
  // Interface
  ISessionStorage,
  // Types (derived from Zod schemas)
  PersistedSessionData,
  PersistedTinyCloudSession,
  TinyCloudSession,
  ValidationError,
  // Schemas
  PersistedSessionDataSchema,
  PersistedTinyCloudSessionSchema,
  TinyCloudSessionSchema,
  TCWEnsDataSchema,
  // Validation functions
  validatePersistedSessionData,
  validateTinyCloudSession,
  validatePersistedTinyCloudSession,
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

// Main TinyCloud class
export {
  TinyCloud,
  TinyCloudConfig,
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
  PrefixedKVService,
  type IKVService,
  type IPrefixedKVService,
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
  type InvocationFacts,
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
  // Sharing link types (v1 - deprecated)
  SharingLink,
  GenerateSharingLinkParams,
  SharingLinkData,
  // Configuration types
  DelegationManagerConfig,
  SharingLinksConfig,
  KeyProvider,
  // Classes
  DelegationManager,
  SharingLinks,
  // v2 SharingService
  SharingService,
  createSharingService,
  ISharingService,
  SharingServiceConfig,
  EncodedShareData,
  ReceiveOptions,
  ShareAccess,
  // v2 types
  JWK,
  KeyType,
  KeyInfo,
  CapabilityEntry,
  DelegationRecord,
  DelegationChainV2,
  DelegationDirection,
  DelegationFilters,
  SpaceOwnership,
  SpaceInfo,
  ShareSchema,
  ShareLink,
  ShareLinkData,
  IngestOptions,
  GenerateShareParams,
  // WASM delegation types
  CreateDelegationWasmParams,
  CreateDelegationWasmResult,
} from "./delegations";

// Authorization (v2 spec)
export {
  // Class
  CapabilityKeyRegistry,
  // Interface
  ICapabilityKeyRegistry,
  // Factory
  createCapabilityKeyRegistry,
  // Types
  StoredDelegationChain,
  // Error codes
  CapabilityKeyRegistryErrorCodes,
  CapabilityKeyRegistryErrorCode,
  // SignStrategy types
  SignRequest,
  SignResponse,
  SignCallback,
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
  EventEmitterStrategy,
  SignStrategy,
  defaultSignStrategy,
  // Space creation handler types
  SpaceCreationContext,
  ISpaceCreationHandler,
  AutoApproveSpaceCreationHandler,
  defaultSpaceCreationHandler,
} from "./authorization";

// Spaces (v2 spec)
export {
  // Space object
  Space,
  ISpace,
  SpaceConfig,
  ISpaceScopedDelegations,
  ISpaceScopedSharing,
  // SpaceService
  SpaceService,
  ISpaceService,
  SpaceServiceConfig,
  SpaceErrorCodes,
  SpaceErrorCode,
  createSpaceService,
  // URI utilities
  parseSpaceUri,
  buildSpaceUri,
  // Delegation creation types
  SpaceDelegationParams,
  CreateDelegationFunction,
} from "./spaces";
