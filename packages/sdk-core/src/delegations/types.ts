/**
 * Delegation management types for TinyCloud SDK v2.
 *
 * These types support the delegation, capability key management,
 * and sharing link functionality.
 *
 * All types are defined using Zod schemas in types.schema.ts and
 * re-exported here for backwards compatibility.
 *
 * @packageDocumentation
 */

// Re-export all types and schemas from the Zod schema file
export {
  // Result type and factory
  createResultSchema,
  type Result,

  // JWK types
  JWKSchema,
  type JWK,

  // Key management types
  KeyTypeSchema,
  type KeyType,
  KeyInfoSchema,
  type KeyInfo,
  CapabilityEntrySchema,
  type CapabilityEntry,

  // Error types
  DelegationErrorSchema,
  type DelegationError,
  DelegationErrorCodes,
  type DelegationErrorCode,

  // Core delegation types
  DelegationSchema,
  type Delegation,
  DelegationRecordSchema,
  type DelegationRecord,
  CreateDelegationParamsSchema,
  type CreateDelegationParams,
  DelegationChainSchema,
  type DelegationChain,
  DelegationChainV2Schema,
  type DelegationChainV2,

  // Filtering types
  DelegationDirectionSchema,
  type DelegationDirection,
  DelegationFiltersSchema,
  type DelegationFilters,

  // Space types
  SpaceOwnershipSchema,
  type SpaceOwnership,
  SpaceInfoSchema,
  type SpaceInfo,

  // Share link types (v2)
  ShareSchemaSchema,
  type ShareSchema,
  ShareLinkSchema,
  type ShareLink,
  createShareLinkDataSchema,
  ShareLinkDataSchema,
  type ShareLinkData,

  // Deprecated sharing types (v1)
  SharingLinkSchema,
  type SharingLink,
  GenerateSharingLinkParamsSchema,
  type GenerateSharingLinkParams,
  createSharingLinkDataSchema,
  SharingLinkDataSchema,
  type SharingLinkData,

  // Ingestion types
  IngestOptionsSchema,
  type IngestOptions,

  // Parameter types
  GenerateShareParamsSchema,
  type GenerateShareParams,

  // Configuration types
  DelegationManagerConfigSchema,
  type DelegationManagerConfig,
  KeyProviderSchema,
  type KeyProvider,
  KVServiceGetterSchema,
  type KVServiceGetter,
  SharingLinksConfigSchema,
  type SharingLinksConfig,

  // API response types
  DelegationApiResponseSchema,
  type DelegationApiResponse,

  // WASM types
  CreateDelegationWasmParamsSchema,
  type CreateDelegationWasmParams,
  CreateDelegationWasmResultSchema,
  type CreateDelegationWasmResult,

  // Validation helpers
  validateDelegation,
  validateCreateDelegationParams,
  validateDelegationFilters,
  validateShareLink,
  createValidator,
} from "./types.schema.js";
