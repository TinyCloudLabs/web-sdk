/**
 * Zod schemas for space hosting and session activation types.
 *
 * These schemas provide runtime validation for space hosting operations.
 * Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Result, ServiceError } from "@tinycloud/sdk-services";

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
// SpaceHostResult Schema
// =============================================================================

/**
 * Result of a space hosting or session activation attempt.
 *
 * This schema represents the response from space hosting and session
 * activation operations with TinyCloud servers.
 */
export const SpaceHostResultSchema = z.object({
  /** Whether the operation succeeded (2xx status) */
  success: z.boolean(),
  /** HTTP status code */
  status: z.number().int(),
  /** Error message if failed */
  error: z.string().optional(),
});

export type SpaceHostResult = z.infer<typeof SpaceHostResultSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validate a SpaceHostResult object against the schema.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 *
 * @example
 * ```typescript
 * const result = validateSpaceHostResult(response);
 * if (result.ok) {
 *   if (result.data.success) {
 *     console.log("Space hosted successfully");
 *   } else {
 *     console.error("Failed:", result.data.error);
 *   }
 * } else {
 *   console.error("Validation failed:", result.error.message);
 * }
 * ```
 */
export function validateSpaceHostResult(
  data: unknown
): Result<SpaceHostResult, ValidationError> {
  const result = SpaceHostResultSchema.safeParse(data);
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
