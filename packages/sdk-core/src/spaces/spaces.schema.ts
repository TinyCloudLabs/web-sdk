/**
 * Zod schemas for Space and SpaceService configuration types.
 *
 * These schemas provide runtime validation for space management types.
 * Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Result, ServiceError } from "@tinycloudlabs/sdk-services";
import { CreateDelegationParamsSchema } from "../delegations/types.schema.js";

// =============================================================================
// Validation Error Type
// =============================================================================

/**
 * Validation error type for schema validation failures.
 */
export interface ValidationError extends ServiceError {
  code: "VALIDATION_ERROR";
  meta?: {
    issues: z.ZodIssue[];
    path?: string;
  };
}

// =============================================================================
// SpaceConfig Schema
// =============================================================================

/**
 * Configuration for creating a Space object.
 *
 * Contains the space identifier, name, and factory functions for creating
 * space-scoped services.
 */
export const SpaceConfigSchema = z.object({
  /** The space identifier (full URI) */
  id: z.string(),
  /** The short name of the space */
  name: z.string(),
  /** Factory function to create a space-scoped KV service */
  createKV: z.function(),
  /** Factory function to create space-scoped delegations */
  createDelegations: z.function(),
  /** Factory function to create space-scoped sharing */
  createSharing: z.function(),
  /** Function to get space info */
  getInfo: z.function(),
});

export type SpaceConfig = z.infer<typeof SpaceConfigSchema>;

// =============================================================================
// SpaceServiceConfig Schema
// =============================================================================

/**
 * Configuration for SpaceService.
 *
 * Contains all the dependencies needed for the SpaceService to manage
 * spaces, including hosts, session, and factory functions.
 */
export const SpaceServiceConfigSchema = z.object({
  /** TinyCloud host URLs */
  hosts: z.array(z.string()),
  /** Active session for authentication */
  session: z.unknown(),
  /** Platform-specific invoke function */
  invoke: z.function(),
  /** Optional custom fetch implementation */
  fetch: z.function().optional(),
  /** Optional capability key registry for delegated space discovery */
  capabilityRegistry: z.unknown().optional(),
  /** Factory function to create a space-scoped KV service */
  createKVService: z.function().optional(),
  /** User's PKH DID (derived from address or provided explicitly) */
  userDid: z.string().optional(),
  /** Optional SharingService for v2 sharing links (client-side) */
  sharingService: z.unknown().optional(),
  /** Factory function to create delegations using SIWE-based flow */
  createDelegation: z.function().optional(),
});

export type SpaceServiceConfig = z.infer<typeof SpaceServiceConfigSchema>;

// =============================================================================
// SpaceDelegationParams Schema
// =============================================================================

/**
 * Parameters for creating a space-scoped delegation.
 *
 * Extends CreateDelegationParams with the spaceId field.
 */
export const SpaceDelegationParamsSchema = CreateDelegationParamsSchema.extend({
  /** The space ID to create the delegation for */
  spaceId: z.string(),
});

export type SpaceDelegationParams = z.infer<typeof SpaceDelegationParamsSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a SpaceConfig object against the schema.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 *
 * @example
 * ```typescript
 * const result = validateSpaceConfig(config);
 * if (result.ok) {
 *   const space = new Space(result.data);
 * } else {
 *   console.error("Invalid config:", result.error.message);
 * }
 * ```
 */
export function validateSpaceConfig(
  data: unknown
): Result<SpaceConfig, ValidationError> {
  const result = SpaceConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        service: "space",
        meta: { issues: result.error.issues },
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validate a SpaceServiceConfig object against the schema.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 *
 * @example
 * ```typescript
 * const result = validateSpaceServiceConfig(config);
 * if (result.ok) {
 *   const service = new SpaceService(result.data);
 * } else {
 *   console.error("Invalid config:", result.error.message);
 * }
 * ```
 */
export function validateSpaceServiceConfig(
  data: unknown
): Result<SpaceServiceConfig, ValidationError> {
  const result = SpaceServiceConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        service: "space",
        meta: { issues: result.error.issues },
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validate a SpaceDelegationParams object against the schema.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 *
 * @example
 * ```typescript
 * const result = validateSpaceDelegationParams(params);
 * if (result.ok) {
 *   await createDelegation(result.data);
 * } else {
 *   console.error("Invalid params:", result.error.message);
 * }
 * ```
 */
export function validateSpaceDelegationParams(
  data: unknown
): Result<SpaceDelegationParams, ValidationError> {
  const result = SpaceDelegationParamsSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        service: "space",
        meta: { issues: result.error.issues },
      },
    };
  }
  return { ok: true, data: result.data };
}
