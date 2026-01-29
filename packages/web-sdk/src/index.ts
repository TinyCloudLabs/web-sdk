export * from './modules/tcw';
export * from './modules';
export * from './notifications';
export * from './authorization';
export * from '@tinycloudlabs/web-core/client';
export * from '@tinycloudlabs/web-core';
export {
  /** @deprecated use TCWClientConfig field instead */
  TCWClientConfig as TCWConfig,
  /** @deprecated use TCWClientProviders field instead */
  TCWClientProviders as TCWProviders,
  /** @deprecated use TCWClientSession field instead */
  TCWClientSession as TCWSession,
} from '@tinycloudlabs/web-core/client';
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

// =============================================================================
// Auth Module Types (TC-715: Unified auth architecture for 1.0.0)
// =============================================================================
//
// The new auth module is exported via `export * from './authorization'` above.
// Key types available:
//
// SignStrategy types (control signing behavior):
//   - SignStrategy, SignRequest, SignResponse, SignCallback
//   - AutoSignStrategy, AutoRejectStrategy, CallbackStrategy, EventEmitterStrategy
//   - WebSignStrategy, WalletPopupStrategy (web-specific, includes wallet-popup)
//   - defaultSignStrategy, defaultWebSignStrategy
//
// Space creation handler types (control space creation UX):
//   - ISpaceCreationHandler, SpaceCreationContext
//   - AutoApproveSpaceCreationHandler, defaultSpaceCreationHandler
//   - ModalSpaceCreationHandler, defaultWebSpaceCreationHandler (web modal)
//
// WebUserAuthorization (new unified auth class):
//   - WebUserAuthorization, WebUserAuthorizationConfig
//   - Features: did, sessionDid, isSessionOnly, connectWallet()
//
// =============================================================================

/**
 * Alias for ModalSpaceCreationHandler.
 * @deprecated Use ModalSpaceCreationHandler directly instead.
 */
export { ModalSpaceCreationHandler as WebSpaceCreationHandler } from './authorization';

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
  // DelegationManager (v1)
  DelegationManager,
  DelegationManagerConfig,
  // v1 types
  Delegation,
  CreateDelegationParams,
  DelegationChain,
  DelegationApiResponse,
  DelegationResult,
  DelegationError,
  DelegationErrorCodes,
  DelegationErrorCode,
  // SharingLinks (v1 - deprecated)
  SharingLinks,
  SharingLinksConfig,
  SharingLink,
  GenerateSharingLinkParams,
  SharingLinkData,
  // v2 SharingService from sdk-core
  SharingService as SharingServiceV2,
  createSharingService as createSharingServiceV2,
  ISharingService,
  SharingServiceConfig as SharingServiceConfigV2,
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
