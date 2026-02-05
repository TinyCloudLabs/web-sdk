/**
 * JSON Schema export for TinyCloud SDK schemas.
 *
 * This module provides functions to generate JSON Schema from Zod schemas,
 * enabling documentation, external tool integration, and schema sharing.
 *
 * @packageDocumentation
 */

import { zodToJsonSchema } from "zod-to-json-schema";
import type { JsonSchema7Type } from "zod-to-json-schema";

/**
 * Extended JSON Schema type that includes optional $schema and definitions.
 * This matches the actual return type of zodToJsonSchema.
 */
export type JsonSchemaWithDefinitions = JsonSchema7Type & {
  $schema?: string;
  definitions?: { [key: string]: JsonSchema7Type };
};

// =============================================================================
// Storage Schemas
// =============================================================================

import {
  EnsDataSchema,
  PersistedTinyCloudSessionSchema,
  PersistedSessionDataSchema,
  TinyCloudSessionSchema,
} from "./storage.schema";

// =============================================================================
// Delegation Schemas
// =============================================================================

import {
  JWKSchema,
  KeyTypeSchema,
  KeyInfoSchema,
  DelegationErrorSchema,
  DelegationSchema,
  CapabilityEntrySchema,
  DelegationRecordSchema,
  CreateDelegationParamsSchema,
  DelegationChainSchema,
  DelegationChainV2Schema,
  DelegationDirectionSchema,
  DelegationFiltersSchema,
  SpaceOwnershipSchema,
  SpaceInfoSchema,
  ShareSchemaSchema,
  ShareLinkSchema,
  IngestOptionsSchema,
  GenerateShareParamsSchema,
  DelegationApiResponseSchema,
  CreateDelegationWasmParamsSchema,
  CreateDelegationWasmResultSchema,
} from "./delegations/types.schema";

// =============================================================================
// Space Hosting Schemas
// =============================================================================

import { SpaceHostResultSchema } from "./space.schema";

// =============================================================================
// Space Creation Schemas
// =============================================================================

import {
  SpaceCreationContextSchema,
  SpaceCreationHandlerSchema,
} from "./authorization/spaceCreation.schema";

// =============================================================================
// TinyCloud Config Schemas
// =============================================================================

import {
  BackoffStrategySchema,
  RetryPolicySchema,
  PartialRetryPolicySchema,
  TinyCloudConfigSchema,
} from "./TinyCloud.schema";

// =============================================================================
// User Authorization Schemas
// =============================================================================

import {
  PartialSiweMessageSchema,
  UserAuthorizationConfigSchema,
} from "./userAuthorization.schema";

// =============================================================================
// Sign Strategy Schemas
// =============================================================================

import {
  SignRequestTypeSchema,
  SignRequestSchema,
  SignResponseSchema,
  AutoSignStrategySchema,
  AutoRejectStrategySchema,
  CallbackStrategySchema,
  EventEmitterStrategySchema,
  SignStrategySchema,
} from "./authorization/strategies.schema";

// =============================================================================
// Space Service Schemas
// =============================================================================

import {
  SpaceConfigSchema,
  SpaceServiceConfigSchema,
  SpaceDelegationParamsSchema,
} from "./spaces/spaces.schema";

// =============================================================================
// JSON Schema Generation Options
// =============================================================================

/**
 * Options for JSON Schema generation.
 */
export interface JsonSchemaOptions {
  /** Name/title for the schema (used as $ref name) */
  name?: string;
  /** Target JSON Schema version */
  target?: "jsonSchema7" | "jsonSchema2019-09" | "openApi3";
}

const defaultOptions: JsonSchemaOptions = {
  target: "jsonSchema7",
};

// =============================================================================
// Individual Schema Exports - Storage
// =============================================================================

/**
 * Generate JSON Schema for EnsData.
 */
export function getEnsDataJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(EnsDataSchema, {
    name: options?.name ?? "EnsData",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for PersistedTinyCloudSession.
 */
export function getPersistedTinyCloudSessionJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(PersistedTinyCloudSessionSchema, {
    name: options?.name ?? "PersistedTinyCloudSession",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for PersistedSessionData.
 */
export function getPersistedSessionDataJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(PersistedSessionDataSchema, {
    name: options?.name ?? "PersistedSessionData",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for TinyCloudSession.
 */
export function getTinyCloudSessionJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(TinyCloudSessionSchema, {
    name: options?.name ?? "TinyCloudSession",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Individual Schema Exports - Delegations
// =============================================================================

/**
 * Generate JSON Schema for JWK.
 */
export function getJWKJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(JWKSchema, {
    name: options?.name ?? "JWK",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for KeyType.
 */
export function getKeyTypeJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(KeyTypeSchema, {
    name: options?.name ?? "KeyType",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for KeyInfo.
 */
export function getKeyInfoJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(KeyInfoSchema, {
    name: options?.name ?? "KeyInfo",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for DelegationError.
 */
export function getDelegationErrorJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationErrorSchema, {
    name: options?.name ?? "DelegationError",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for Delegation.
 */
export function getDelegationJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationSchema, {
    name: options?.name ?? "Delegation",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for CapabilityEntry.
 */
export function getCapabilityEntryJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(CapabilityEntrySchema, {
    name: options?.name ?? "CapabilityEntry",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for DelegationRecord.
 */
export function getDelegationRecordJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationRecordSchema, {
    name: options?.name ?? "DelegationRecord",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for CreateDelegationParams.
 */
export function getCreateDelegationParamsJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(CreateDelegationParamsSchema, {
    name: options?.name ?? "CreateDelegationParams",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for DelegationChain.
 */
export function getDelegationChainJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationChainSchema, {
    name: options?.name ?? "DelegationChain",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for DelegationChainV2.
 */
export function getDelegationChainV2JsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationChainV2Schema, {
    name: options?.name ?? "DelegationChainV2",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for DelegationDirection.
 */
export function getDelegationDirectionJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationDirectionSchema, {
    name: options?.name ?? "DelegationDirection",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for DelegationFilters.
 */
export function getDelegationFiltersJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationFiltersSchema, {
    name: options?.name ?? "DelegationFilters",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SpaceOwnership.
 */
export function getSpaceOwnershipJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceOwnershipSchema, {
    name: options?.name ?? "SpaceOwnership",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SpaceInfo.
 */
export function getSpaceInfoJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceInfoSchema, {
    name: options?.name ?? "SpaceInfo",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for ShareSchema.
 */
export function getShareSchemaJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(ShareSchemaSchema, {
    name: options?.name ?? "ShareSchema",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for ShareLink.
 */
export function getShareLinkJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(ShareLinkSchema, {
    name: options?.name ?? "ShareLink",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for IngestOptions.
 */
export function getIngestOptionsJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(IngestOptionsSchema, {
    name: options?.name ?? "IngestOptions",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for GenerateShareParams.
 */
export function getGenerateShareParamsJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(GenerateShareParamsSchema, {
    name: options?.name ?? "GenerateShareParams",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for DelegationApiResponse.
 */
export function getDelegationApiResponseJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(DelegationApiResponseSchema, {
    name: options?.name ?? "DelegationApiResponse",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for CreateDelegationWasmParams.
 */
export function getCreateDelegationWasmParamsJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(CreateDelegationWasmParamsSchema, {
    name: options?.name ?? "CreateDelegationWasmParams",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for CreateDelegationWasmResult.
 */
export function getCreateDelegationWasmResultJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(CreateDelegationWasmResultSchema, {
    name: options?.name ?? "CreateDelegationWasmResult",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Individual Schema Exports - Space Hosting
// =============================================================================

/**
 * Generate JSON Schema for SpaceHostResult.
 */
export function getSpaceHostResultJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceHostResultSchema, {
    name: options?.name ?? "SpaceHostResult",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Individual Schema Exports - Space Creation
// =============================================================================

/**
 * Generate JSON Schema for SpaceCreationContext.
 */
export function getSpaceCreationContextJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceCreationContextSchema, {
    name: options?.name ?? "SpaceCreationContext",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SpaceCreationHandler.
 */
export function getSpaceCreationHandlerJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceCreationHandlerSchema, {
    name: options?.name ?? "SpaceCreationHandler",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Individual Schema Exports - TinyCloud Config
// =============================================================================

/**
 * Generate JSON Schema for BackoffStrategy.
 */
export function getBackoffStrategyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(BackoffStrategySchema, {
    name: options?.name ?? "BackoffStrategy",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for RetryPolicy.
 */
export function getRetryPolicyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(RetryPolicySchema, {
    name: options?.name ?? "RetryPolicy",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for PartialRetryPolicy.
 */
export function getPartialRetryPolicyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(PartialRetryPolicySchema, {
    name: options?.name ?? "PartialRetryPolicy",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for TinyCloudConfig.
 */
export function getTinyCloudConfigJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(TinyCloudConfigSchema, {
    name: options?.name ?? "TinyCloudConfig",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Individual Schema Exports - User Authorization
// =============================================================================

/**
 * Generate JSON Schema for PartialSiweMessage.
 */
export function getPartialSiweMessageJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(PartialSiweMessageSchema, {
    name: options?.name ?? "PartialSiweMessage",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for UserAuthorizationConfig.
 */
export function getUserAuthorizationConfigJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(UserAuthorizationConfigSchema, {
    name: options?.name ?? "UserAuthorizationConfig",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Individual Schema Exports - Sign Strategy
// =============================================================================

/**
 * Generate JSON Schema for SignRequestType.
 */
export function getSignRequestTypeJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SignRequestTypeSchema, {
    name: options?.name ?? "SignRequestType",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SignRequest.
 */
export function getSignRequestJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SignRequestSchema, {
    name: options?.name ?? "SignRequest",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SignResponse.
 */
export function getSignResponseJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SignResponseSchema, {
    name: options?.name ?? "SignResponse",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for AutoSignStrategy.
 */
export function getAutoSignStrategyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(AutoSignStrategySchema, {
    name: options?.name ?? "AutoSignStrategy",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for AutoRejectStrategy.
 */
export function getAutoRejectStrategyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(AutoRejectStrategySchema, {
    name: options?.name ?? "AutoRejectStrategy",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for CallbackStrategy.
 */
export function getCallbackStrategyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(CallbackStrategySchema, {
    name: options?.name ?? "CallbackStrategy",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for EventEmitterStrategy.
 */
export function getEventEmitterStrategyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(EventEmitterStrategySchema, {
    name: options?.name ?? "EventEmitterStrategy",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SignStrategy.
 */
export function getSignStrategyJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SignStrategySchema, {
    name: options?.name ?? "SignStrategy",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Individual Schema Exports - Space Service
// =============================================================================

/**
 * Generate JSON Schema for SpaceConfig.
 */
export function getSpaceConfigJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceConfigSchema, {
    name: options?.name ?? "SpaceConfig",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SpaceServiceConfig.
 */
export function getSpaceServiceConfigJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceServiceConfigSchema, {
    name: options?.name ?? "SpaceServiceConfig",
    ...defaultOptions,
    ...options,
  });
}

/**
 * Generate JSON Schema for SpaceDelegationParams.
 */
export function getSpaceDelegationParamsJsonSchema(options?: JsonSchemaOptions): JsonSchemaWithDefinitions {
  return zodToJsonSchema(SpaceDelegationParamsSchema, {
    name: options?.name ?? "SpaceDelegationParams",
    ...defaultOptions,
    ...options,
  });
}

// =============================================================================
// Schema Bundle Types
// =============================================================================

/**
 * Collection of all JSON Schemas grouped by category.
 */
export interface JsonSchemaBundle {
  /** Storage-related schemas */
  storage: {
    EnsData: JsonSchemaWithDefinitions;
    PersistedTinyCloudSession: JsonSchemaWithDefinitions;
    PersistedSessionData: JsonSchemaWithDefinitions;
    TinyCloudSession: JsonSchemaWithDefinitions;
  };
  /** Delegation-related schemas */
  delegations: {
    JWK: JsonSchemaWithDefinitions;
    KeyType: JsonSchemaWithDefinitions;
    KeyInfo: JsonSchemaWithDefinitions;
    DelegationError: JsonSchemaWithDefinitions;
    Delegation: JsonSchemaWithDefinitions;
    CapabilityEntry: JsonSchemaWithDefinitions;
    DelegationRecord: JsonSchemaWithDefinitions;
    CreateDelegationParams: JsonSchemaWithDefinitions;
    DelegationChain: JsonSchemaWithDefinitions;
    DelegationChainV2: JsonSchemaWithDefinitions;
    DelegationDirection: JsonSchemaWithDefinitions;
    DelegationFilters: JsonSchemaWithDefinitions;
    SpaceOwnership: JsonSchemaWithDefinitions;
    SpaceInfo: JsonSchemaWithDefinitions;
    ShareSchema: JsonSchemaWithDefinitions;
    ShareLink: JsonSchemaWithDefinitions;
    IngestOptions: JsonSchemaWithDefinitions;
    GenerateShareParams: JsonSchemaWithDefinitions;
    DelegationApiResponse: JsonSchemaWithDefinitions;
    CreateDelegationWasmParams: JsonSchemaWithDefinitions;
    CreateDelegationWasmResult: JsonSchemaWithDefinitions;
  };
  /** Space hosting schemas */
  spaceHosting: {
    SpaceHostResult: JsonSchemaWithDefinitions;
  };
  /** Space creation schemas */
  spaceCreation: {
    SpaceCreationContext: JsonSchemaWithDefinitions;
    SpaceCreationHandler: JsonSchemaWithDefinitions;
  };
  /** TinyCloud configuration schemas */
  config: {
    BackoffStrategy: JsonSchemaWithDefinitions;
    RetryPolicy: JsonSchemaWithDefinitions;
    PartialRetryPolicy: JsonSchemaWithDefinitions;
    TinyCloudConfig: JsonSchemaWithDefinitions;
  };
  /** User authorization schemas */
  authorization: {
    PartialSiweMessage: JsonSchemaWithDefinitions;
    UserAuthorizationConfig: JsonSchemaWithDefinitions;
  };
  /** Sign strategy schemas */
  signStrategy: {
    SignRequestType: JsonSchemaWithDefinitions;
    SignRequest: JsonSchemaWithDefinitions;
    SignResponse: JsonSchemaWithDefinitions;
    AutoSignStrategy: JsonSchemaWithDefinitions;
    AutoRejectStrategy: JsonSchemaWithDefinitions;
    CallbackStrategy: JsonSchemaWithDefinitions;
    EventEmitterStrategy: JsonSchemaWithDefinitions;
    SignStrategy: JsonSchemaWithDefinitions;
  };
  /** Space service schemas */
  spaceService: {
    SpaceConfig: JsonSchemaWithDefinitions;
    SpaceServiceConfig: JsonSchemaWithDefinitions;
    SpaceDelegationParams: JsonSchemaWithDefinitions;
  };
}

// =============================================================================
// Bundle Generation
// =============================================================================

/**
 * Generate all JSON Schemas as a categorized bundle.
 *
 * This function generates JSON Schema for every Zod schema in the SDK,
 * organized into logical categories for easy consumption.
 *
 * @param options - Options applied to all schema generation
 * @returns Object containing all JSON Schemas organized by category
 *
 * @example
 * ```typescript
 * import { getAllJsonSchemas } from "@tinycloud/sdk-core";
 *
 * const schemas = getAllJsonSchemas();
 *
 * // Access individual schemas
 * console.log(schemas.delegations.Delegation);
 * console.log(schemas.storage.PersistedSessionData);
 *
 * // Export all schemas to file
 * fs.writeFileSync("schemas.json", JSON.stringify(schemas, null, 2));
 * ```
 */
export function getAllJsonSchemas(options?: JsonSchemaOptions): JsonSchemaBundle {
  return {
    storage: {
      EnsData: getEnsDataJsonSchema(options),
      PersistedTinyCloudSession: getPersistedTinyCloudSessionJsonSchema(options),
      PersistedSessionData: getPersistedSessionDataJsonSchema(options),
      TinyCloudSession: getTinyCloudSessionJsonSchema(options),
    },
    delegations: {
      JWK: getJWKJsonSchema(options),
      KeyType: getKeyTypeJsonSchema(options),
      KeyInfo: getKeyInfoJsonSchema(options),
      DelegationError: getDelegationErrorJsonSchema(options),
      Delegation: getDelegationJsonSchema(options),
      CapabilityEntry: getCapabilityEntryJsonSchema(options),
      DelegationRecord: getDelegationRecordJsonSchema(options),
      CreateDelegationParams: getCreateDelegationParamsJsonSchema(options),
      DelegationChain: getDelegationChainJsonSchema(options),
      DelegationChainV2: getDelegationChainV2JsonSchema(options),
      DelegationDirection: getDelegationDirectionJsonSchema(options),
      DelegationFilters: getDelegationFiltersJsonSchema(options),
      SpaceOwnership: getSpaceOwnershipJsonSchema(options),
      SpaceInfo: getSpaceInfoJsonSchema(options),
      ShareSchema: getShareSchemaJsonSchema(options),
      ShareLink: getShareLinkJsonSchema(options),
      IngestOptions: getIngestOptionsJsonSchema(options),
      GenerateShareParams: getGenerateShareParamsJsonSchema(options),
      DelegationApiResponse: getDelegationApiResponseJsonSchema(options),
      CreateDelegationWasmParams: getCreateDelegationWasmParamsJsonSchema(options),
      CreateDelegationWasmResult: getCreateDelegationWasmResultJsonSchema(options),
    },
    spaceHosting: {
      SpaceHostResult: getSpaceHostResultJsonSchema(options),
    },
    spaceCreation: {
      SpaceCreationContext: getSpaceCreationContextJsonSchema(options),
      SpaceCreationHandler: getSpaceCreationHandlerJsonSchema(options),
    },
    config: {
      BackoffStrategy: getBackoffStrategyJsonSchema(options),
      RetryPolicy: getRetryPolicyJsonSchema(options),
      PartialRetryPolicy: getPartialRetryPolicyJsonSchema(options),
      TinyCloudConfig: getTinyCloudConfigJsonSchema(options),
    },
    authorization: {
      PartialSiweMessage: getPartialSiweMessageJsonSchema(options),
      UserAuthorizationConfig: getUserAuthorizationConfigJsonSchema(options),
    },
    signStrategy: {
      SignRequestType: getSignRequestTypeJsonSchema(options),
      SignRequest: getSignRequestJsonSchema(options),
      SignResponse: getSignResponseJsonSchema(options),
      AutoSignStrategy: getAutoSignStrategyJsonSchema(options),
      AutoRejectStrategy: getAutoRejectStrategyJsonSchema(options),
      CallbackStrategy: getCallbackStrategyJsonSchema(options),
      EventEmitterStrategy: getEventEmitterStrategyJsonSchema(options),
      SignStrategy: getSignStrategyJsonSchema(options),
    },
    spaceService: {
      SpaceConfig: getSpaceConfigJsonSchema(options),
      SpaceServiceConfig: getSpaceServiceConfigJsonSchema(options),
      SpaceDelegationParams: getSpaceDelegationParamsJsonSchema(options),
    },
  };
}

/**
 * Get a flat object of all JSON Schemas keyed by name.
 *
 * @param options - Options applied to all schema generation
 * @returns Object mapping schema names to JSON Schema definitions
 *
 * @example
 * ```typescript
 * import { getAllJsonSchemasFlat } from "@tinycloud/sdk-core";
 *
 * const schemas = getAllJsonSchemasFlat();
 * console.log(Object.keys(schemas)); // ["EnsData", "Delegation", ...]
 * ```
 */
export function getAllJsonSchemasFlat(options?: JsonSchemaOptions): Record<string, JsonSchemaWithDefinitions> {
  const bundle = getAllJsonSchemas(options);
  return {
    // Storage
    ...bundle.storage,
    // Delegations
    ...bundle.delegations,
    // Space hosting
    ...bundle.spaceHosting,
    // Space creation
    ...bundle.spaceCreation,
    // Config
    ...bundle.config,
    // Authorization
    ...bundle.authorization,
    // Sign strategy
    ...bundle.signStrategy,
    // Space service
    ...bundle.spaceService,
  };
}

/**
 * List of all available schema names.
 */
export const SCHEMA_NAMES = [
  // Storage
  "EnsData",
  "PersistedTinyCloudSession",
  "PersistedSessionData",
  "TinyCloudSession",
  // Delegations
  "JWK",
  "KeyType",
  "KeyInfo",
  "DelegationError",
  "Delegation",
  "CapabilityEntry",
  "DelegationRecord",
  "CreateDelegationParams",
  "DelegationChain",
  "DelegationChainV2",
  "DelegationDirection",
  "DelegationFilters",
  "SpaceOwnership",
  "SpaceInfo",
  "ShareSchema",
  "ShareLink",
  "IngestOptions",
  "GenerateShareParams",
  "DelegationApiResponse",
  "CreateDelegationWasmParams",
  "CreateDelegationWasmResult",
  // Space hosting
  "SpaceHostResult",
  // Space creation
  "SpaceCreationContext",
  "SpaceCreationHandler",
  // Config
  "BackoffStrategy",
  "RetryPolicy",
  "PartialRetryPolicy",
  "TinyCloudConfig",
  // Authorization
  "PartialSiweMessage",
  "UserAuthorizationConfig",
  // Sign strategy
  "SignRequestType",
  "SignRequest",
  "SignResponse",
  "AutoSignStrategy",
  "AutoRejectStrategy",
  "CallbackStrategy",
  "EventEmitterStrategy",
  "SignStrategy",
  // Space service
  "SpaceConfig",
  "SpaceServiceConfig",
  "SpaceDelegationParams",
] as const;

export type SchemaName = (typeof SCHEMA_NAMES)[number];
