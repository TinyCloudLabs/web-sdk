/**
 * Zod schemas for authorization types.
 *
 * These schemas provide runtime validation for sign strategies and space creation
 * contexts. Types are derived from schemas using z.infer<>.
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
// SignRequest Schema
// =============================================================================

/**
 * Type of sign operation.
 */
export const SignTypeSchema = z.enum(["siwe", "message"]);
export type SignType = z.infer<typeof SignTypeSchema>;

/**
 * Sign request passed to callback or event handlers.
 */
export const SignRequestSchema = z.object({
  /** Ethereum address of the signer */
  address: z.string(),
  /** Chain ID for the signing context */
  chainId: z.number().int().positive(),
  /** Message to be signed */
  message: z.string(),
  /** Type of sign operation */
  type: SignTypeSchema,
});

export type SignRequest = z.infer<typeof SignRequestSchema>;

// =============================================================================
// SignResponse Schema
// =============================================================================

/**
 * Sign response from callback or event handlers.
 */
export const SignResponseSchema = z.object({
  /** Whether the sign request was approved */
  approved: z.boolean(),
  /** The signature if approved */
  signature: z.string().optional(),
  /** Reason for rejection if not approved */
  reason: z.string().optional(),
});

export type SignResponse = z.infer<typeof SignResponseSchema>;

// =============================================================================
// SignCallback Schema
// =============================================================================

/**
 * Callback handler type for sign requests.
 * Note: Function types cannot be fully validated at runtime.
 * We use z.unknown().refine() for runtime type checking while preserving TypeScript types.
 */
export const SignCallbackSchema = z.unknown().refine(
  (val): val is (request: SignRequest) => Promise<SignResponse> =>
    typeof val === "function",
  { message: "Expected a function" }
);

export type SignCallback = (request: SignRequest) => Promise<SignResponse>;

// =============================================================================
// SignStrategy Schemas (Discriminated Union)
// =============================================================================

/**
 * Auto-sign strategy: automatically signs all requests.
 */
export const AutoSignStrategySchema = z.object({
  type: z.literal("auto-sign"),
});

export type AutoSignStrategy = z.infer<typeof AutoSignStrategySchema>;

/**
 * Auto-reject strategy: rejects all sign requests.
 */
export const AutoRejectStrategySchema = z.object({
  type: z.literal("auto-reject"),
});

export type AutoRejectStrategy = z.infer<typeof AutoRejectStrategySchema>;

/**
 * Callback strategy: delegates sign decisions to a callback function.
 */
export const CallbackStrategySchema = z.object({
  type: z.literal("callback"),
  handler: z.unknown().refine(
    (val): val is SignCallback => typeof val === "function",
    { message: "Expected a function" }
  ),
});

export type CallbackStrategy = {
  type: "callback";
  handler: SignCallback;
};

/**
 * Event emitter strategy: emits sign requests as events.
 */
export const EventEmitterStrategySchema = z.object({
  type: z.literal("event-emitter"),
  emitter: z.unknown().refine(
    (val): val is EventTarget => val !== null && typeof val === "object" && "addEventListener" in val,
    { message: "Expected an EventTarget" }
  ),
  /** Timeout in milliseconds for waiting on event response (default: 60000) */
  timeout: z.number().int().positive().optional(),
});

export type EventEmitterStrategy = z.infer<typeof EventEmitterStrategySchema>;

/**
 * Sign strategy discriminated union.
 * Determines how sign requests are handled in UserAuthorization implementations.
 */
export const SignStrategySchema = z.discriminatedUnion("type", [
  AutoSignStrategySchema,
  AutoRejectStrategySchema,
  CallbackStrategySchema,
  EventEmitterStrategySchema,
]);

export type SignStrategy = z.infer<typeof SignStrategySchema>;

// =============================================================================
// SpaceCreationContext Schema
// =============================================================================

/**
 * Context passed to space creation handlers.
 */
export const SpaceCreationContextSchema = z.object({
  /** The unique identifier for the space being created */
  spaceId: z.string(),
  /** Ethereum address of the user creating the space */
  address: z.string(),
  /** Chain ID for the creation context */
  chainId: z.number().int().positive(),
  /** Host URL where the space will be created */
  host: z.string().url(),
});

export type SpaceCreationContext = z.infer<typeof SpaceCreationContextSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates a SignRequest object and returns a Result.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 */
export function validateSignRequest(
  data: unknown
): Result<SignRequest, ValidationError> {
  const result = SignRequestSchema.safeParse(data);
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
 * Validates a SignResponse object and returns a Result.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 */
export function validateSignResponse(
  data: unknown
): Result<SignResponse, ValidationError> {
  const result = SignResponseSchema.safeParse(data);
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
 * Validates a SignStrategy object and returns a Result.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 */
export function validateSignStrategy(
  data: unknown
): Result<SignStrategy, ValidationError> {
  const result = SignStrategySchema.safeParse(data);
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
 * Validates a SpaceCreationContext object and returns a Result.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
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
 * Generic validation function factory for authorization types.
 *
 * @param schema - Zod schema to use for validation
 * @returns A validation function that returns a Result
 */
export function createAuthorizationValidator<T>(
  schema: z.ZodType<T>
): (data: unknown) => Result<T, ValidationError> {
  return (data: unknown): Result<T, ValidationError> => {
    const result = schema.safeParse(data);
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
  };
}
