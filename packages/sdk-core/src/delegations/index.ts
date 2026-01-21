/**
 * TinyCloud SDK Delegations Module
 *
 * This module provides delegation and sharing link functionality
 * for the TinyCloud SDK. It extracts and improves upon the delegation
 * functionality previously in ITinyCloudStorage.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import {
 *   DelegationManager,
 *   SharingLinks,
 *   Delegation,
 *   CreateDelegationParams,
 * } from "@tinycloudlabs/sdk-core/delegations";
 *
 * // Create delegation manager
 * const delegations = new DelegationManager({
 *   hosts: ["https://node.tinycloud.xyz"],
 *   session,
 *   invoke,
 * });
 *
 * // Create a delegation
 * const result = await delegations.create({
 *   delegateDID: "did:pkh:eip155:1:0x...",
 *   path: "shared/",
 *   actions: ["tinycloud.kv/get", "tinycloud.kv/list"],
 * });
 *
 * // Create sharing links manager
 * const sharing = new SharingLinks(delegations, {
 *   baseUrl: "https://share.myapp.com",
 * });
 *
 * // Generate a sharing link
 * const linkResult = await sharing.generate({ key: "document.json" });
 * if (linkResult.ok) {
 *   console.log("Share URL:", linkResult.data.url);
 * }
 * ```
 */

// Types
export {
  // Result pattern
  Result,
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
  KVServiceGetter,

  // v2 types for CapabilityKeyRegistry
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
} from "./types";

// Classes
export { DelegationManager } from "./DelegationManager";
export { SharingLinks } from "./SharingLinks";

// v2 SharingService
export {
  SharingService,
  createSharingService,
  ISharingService,
  SharingServiceConfig,
  EncodedShareData,
  ReceiveOptions,
  ShareAccess,
} from "./SharingService";
