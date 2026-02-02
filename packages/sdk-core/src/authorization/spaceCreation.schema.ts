/**
 * Zod schemas for space creation handler types.
 *
 * These schemas provide runtime validation for space creation configuration.
 * Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Result } from "../delegations/types.schema";
import type { ValidationError } from "../storage.schema";

// =============================================================================
// Shared Patterns
// =============================================================================

/**
 * Ethereum address pattern (checksummed or lowercase).
 */
const ethereumAddressPattern = /^0x[a-fA-F0-9]{40}$/;

// =============================================================================
// Space Creation Context Schema
// =============================================================================

/**
 * Schema for context passed to space creation handlers.
 */
export const SpaceCreationContextSchema = z.object({
  /** The unique identifier for the space being created */
  spaceId: z.string(),
  /** Ethereum address of the user creating the space */
  address: z.string().regex(ethereumAddressPattern, "Invalid Ethereum address"),
  /** Chain ID for the creation context */
  chainId: z.number().int().positive(),
  /** Host URL where the space will be created */
  host: z.string().url(),
});

export type SpaceCreationContext = z.infer<typeof SpaceCreationContextSchema>;

// =============================================================================
// Space Creation Handler Schema
// =============================================================================

/**
 * Schema for ISpaceCreationHandler interface.
 *
 * Note: Since this is an interface with methods, we validate shape only.
 * The actual implementation is not validated at runtime.
 */
export const SpaceCreationHandlerSchema = z.object({
  /** Called when a new space needs to be created */
  confirmSpaceCreation: z.unknown().refine(
    (val): val is (context: SpaceCreationContext) => Promise<boolean> =>
      typeof val === "function",
    { message: "Expected a confirmSpaceCreation function" }
  ),
  /** Called after successful space creation (optional) */
  onSpaceCreated: z
    .unknown()
    .refine(
      (val): val is ((context: SpaceCreationContext) => void) | undefined =>
        val === undefined || typeof val === "function",
      { message: "Expected an onSpaceCreated function or undefined" }
    )
    .optional(),
  /** Called if space creation fails (optional) */
  onSpaceCreationFailed: z
    .unknown()
    .refine(
      (val): val is ((context: SpaceCreationContext, error: Error) => void) | undefined =>
        val === undefined || typeof val === "function",
      { message: "Expected an onSpaceCreationFailed function or undefined" }
    )
    .optional(),
});

export type ISpaceCreationHandler = z.infer<typeof SpaceCreationHandlerSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates a SpaceCreationContext object and returns a Result.
 */
export function validateSpaceCreationContext(
  data: unknown
): Result<SpaceCreationContext, ValidationError> {
  const result = SpaceCreationContextSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        service: "authorization",
        meta: { issues: result.error.issues },
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates an ISpaceCreationHandler object and returns a Result.
 */
export function validateSpaceCreationHandler(
  data: unknown
): Result<ISpaceCreationHandler, ValidationError> {
  const result = SpaceCreationHandlerSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        service: "authorization",
        meta: { issues: result.error.issues },
      },
    };
  }
  return { ok: true, data: result.data };
}
