/**
 * @tinycloudlabs/node-sdk
 *
 * TinyCloud SDK for Node.js environments.
 *
 * This package provides Node.js-specific implementations of the TinyCloud SDK:
 * - PrivateKeySigner: Sign messages using a private key
 * - NodeUserAuthorization: Authorize users with configurable sign strategies
 * - MemorySessionStorage: Store sessions in memory
 * - FileSessionStorage: Persist sessions to the file system
 *
 * @example
 * ```typescript
 * import { TinyCloud } from '@tinycloudlabs/sdk-core';
 * import {
 *   NodeUserAuthorization,
 *   PrivateKeySigner,
 *   FileSessionStorage,
 * } from '@tinycloudlabs/node-sdk';
 *
 * const signer = new PrivateKeySigner(process.env.PRIVATE_KEY);
 * const auth = new NodeUserAuthorization({
 *   signer,
 *   signStrategy: { type: 'auto-sign' },
 *   domain: 'api.myapp.com',
 *   sessionStorage: new FileSessionStorage('/tmp/sessions'),
 * });
 *
 * const tc = new TinyCloud(auth);
 * await tc.signIn();
 * ```
 *
 * @packageDocumentation
 */

// Re-export core types for convenience
export {
  TinyCloud,
  TinyCloudConfig,
  ISigner,
  ISessionStorage,
  IUserAuthorization,
  ClientSession,
  Extension,
  PersistedSessionData,
  TinyCloudSession,
} from "@tinycloudlabs/sdk-core";

// Signers
export { PrivateKeySigner } from "./signers/PrivateKeySigner";

// Storage implementations
export { MemorySessionStorage } from "./storage/MemorySessionStorage";
export { FileSessionStorage } from "./storage/FileSessionStorage";

// Authorization
export {
  NodeUserAuthorization,
  NodeUserAuthorizationConfig,
} from "./authorization/NodeUserAuthorization";

// Sign strategies (re-exported from sdk-core + Node.js-specific types)
export {
  // Common types from sdk-core
  SignRequest,
  SignResponse,
  SignCallback,
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
  defaultSignStrategy,
  // Node.js-specific types
  NodeEventEmitterStrategy,
  SignStrategy,
} from "./authorization/strategies";

// High-level API
export { TinyCloudNode, TinyCloudNodeConfig } from "./TinyCloudNode";

// Delegation
export { DelegatedAccess } from "./DelegatedAccess";
export {
  PortableDelegation,
  serializeDelegation,
  deserializeDelegation,
} from "./delegation";

// Re-export KV service for direct usage
export {
  IKVService,
  KVService,
  KVServiceConfig,
  KVResponse,
  // Prefixed KV
  PrefixedKVService,
  IPrefixedKVService,
} from "@tinycloudlabs/sdk-core";

// Re-export v2 Delegation services and types
export {
  // DelegationManager (v2 DelegationService)
  DelegationManager,
  DelegationManagerConfig,
  // SharingService (v2)
  SharingService,
  ISharingService,
  SharingServiceConfig,
  createSharingService,
  EncodedShareData,
  ReceiveOptions,
  ShareAccess,
  // Delegation types
  Delegation,
  CreateDelegationParams,
  DelegationChain,
  DelegationChainV2,
  DelegationDirection,
  DelegationFilters,
  // Error types
  DelegationResult,
  DelegationError,
  DelegationErrorCodes,
  DelegationErrorCode,
  // Key types
  JWK,
  KeyType,
  KeyInfo,
  CapabilityEntry,
  DelegationRecord,
  // Space types
  SpaceOwnership,
  SpaceInfo,
  // Share types
  ShareSchema,
  ShareLink,
  ShareLinkData,
  IngestOptions,
  GenerateShareParams,
} from "@tinycloudlabs/sdk-core";

// Re-export CapabilityKeyRegistry (v2)
export {
  CapabilityKeyRegistry,
  ICapabilityKeyRegistry,
  createCapabilityKeyRegistry,
  StoredDelegationChain,
  CapabilityKeyRegistryErrorCodes,
  CapabilityKeyRegistryErrorCode,
} from "@tinycloudlabs/sdk-core";

// Re-export SpaceService (v2)
export {
  SpaceService,
  ISpaceService,
  SpaceServiceConfig,
  SpaceErrorCodes,
  SpaceErrorCode,
  createSpaceService,
  parseSpaceUri,
  buildSpaceUri,
  // Space object
  Space,
  ISpace,
  SpaceConfig,
  ISpaceScopedDelegations,
  ISpaceScopedSharing,
} from "@tinycloudlabs/sdk-core";

// Protocol version checking
export {
  ProtocolMismatchError,
  VersionCheckError,
  checkNodeVersion,
} from "@tinycloudlabs/sdk-core";

// Re-export ServiceContext and related types for advanced usage
export {
  ServiceContext,
  ServiceContextConfig,
  ServiceSession,
  InvokeFunction,
  FetchFunction,
} from "@tinycloudlabs/sdk-core";

// Re-export KeyProvider interface from sdk-core
export type { KeyProvider } from "@tinycloudlabs/sdk-core";

// Key management for node-sdk
export {
  WasmKeyProvider,
  WasmKeyProviderConfig,
  createWasmKeyProvider,
} from "./keys/WasmKeyProvider";
