// =============================================================================
// Main class and config
// =============================================================================
export { TinyCloudWeb, Config, ShareReceiveResult } from './modules/tcw';

// =============================================================================
// Legacy auth (UserAuthorization)
// =============================================================================
export { UserAuthorization, IUserAuthorization } from './modules/UserAuthorization';

// =============================================================================
// New auth module (WebUserAuthorization) and strategies
// =============================================================================
export {
  WebUserAuthorization,
  WebUserAuthorizationConfig,
  WebSignStrategy,
  WalletPopupStrategy,
  defaultWebSignStrategy,
  ModalSpaceCreationHandler,
  defaultWebSpaceCreationHandler,
} from './authorization';

// Re-export sdk-core authorization types used by the new auth module
export {
  SignStrategy,
  SignRequest,
  SignResponse,
  SignCallback,
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
  EventEmitterStrategy,
  defaultSignStrategy,
  ISpaceCreationHandler,
  SpaceCreationContext,
  AutoApproveSpaceCreationHandler,
  defaultSpaceCreationHandler,
} from '@tinycloudlabs/sdk-core';

// =============================================================================
// Re-exports from web-core packages
// =============================================================================
export * from '@tinycloudlabs/web-core/client';
export * from '@tinycloudlabs/web-core';
export { SiweMessage } from 'siwe';

// Re-export sdk-core interfaces for platform-agnostic code
export {
  TinyCloud,
  ISigner,
  ISessionStorage,
  IUserAuthorization as ICoreUserAuthorization,
  PersistedSessionData,
  SiweConfig,
  PartialSiweMessage,
} from '@tinycloudlabs/sdk-core';

// Re-export KV service types for direct usage
export {
  IKVService,
  KVService,
  KVResponse,
  PrefixedKVService,
  IPrefixedKVService,
} from '@tinycloudlabs/sdk-core';

// Re-export delegation types and services from sdk-core
export {
  // DelegationManager
  DelegationManager,
  DelegationManagerConfig,
  // Delegation types
  Delegation,
  CreateDelegationParams,
  DelegationChain,
  DelegationApiResponse,
  DelegationResult,
  DelegationError,
  DelegationErrorCodes,
  DelegationErrorCode,
  // SharingService
  SharingService,
  createSharingService,
  ISharingService,
  SharingServiceConfig,
  EncodedShareData,
  ReceiveOptions,
  ShareAccess,
  // Key and delegation record types
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
} from '@tinycloudlabs/sdk-core';

// Re-export CapabilityKeyRegistry from sdk-core
export {
  CapabilityKeyRegistry,
  ICapabilityKeyRegistry,
  createCapabilityKeyRegistry,
  StoredDelegationChain,
  CapabilityKeyRegistryErrorCodes,
  CapabilityKeyRegistryErrorCode,
} from '@tinycloudlabs/sdk-core';

// Re-export SpaceService from sdk-core
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
} from '@tinycloudlabs/sdk-core';

// Protocol version checking
export {
  ProtocolMismatchError,
  VersionCheckError,
  checkNodeVersion,
} from '@tinycloudlabs/sdk-core';

// Adapter for web-sdk
export { createKVService } from './modules/Storage/tinycloud/KVServiceAdapter';

// =============================================================================
// Delegation Transport Types (TC-563: useDelegation support)
// =============================================================================
// These types enable receiving and using delegations from other users.
// Compatible with node-sdk's delegation system for cross-platform delegation exchange.

export {
  PortableDelegation,
  DelegatedAccess,
  serializeDelegation,
  deserializeDelegation,
} from './delegation';
