/**
 * Zod schemas for SignStrategy types.
 *
 * These schemas provide runtime validation for sign strategy configuration.
 * Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";

// =============================================================================
// Sign Request/Response Schemas
// =============================================================================

/**
 * Schema for sign request type.
 */
export const SignRequestTypeSchema = z.enum(["siwe", "message"]);
export type SignRequestType = z.infer<typeof SignRequestTypeSchema>;

/**
 * Schema for sign request passed to callback or event handlers.
 */
export const SignRequestSchema = z.object({
  /** Ethereum address of the signer */
  address: z.string(),
  /** Chain ID for the signing context */
  chainId: z.number(),
  /** Message to be signed */
  message: z.string(),
  /** Type of sign operation */
  type: SignRequestTypeSchema,
});

export type SignRequest = z.infer<typeof SignRequestSchema>;

/**
 * Schema for sign response from callback or event handlers.
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

/**
 * Callback handler type for sign requests.
 * Note: z.function().args() not available in Zod 3, so we use function type annotation.
 */
export type SignCallback = (request: SignRequest) => Promise<SignResponse>;

/**
 * Schema for callback handler type (validated as function shape only).
 */
export const SignCallbackSchema = z.unknown().refine(
  (val): val is SignCallback => typeof val === "function",
  { message: "Expected a callback function" }
);

// =============================================================================
// Strategy Schemas
// =============================================================================

/**
 * Schema for auto-sign strategy: automatically signs all requests.
 */
export const AutoSignStrategySchema = z.object({
  type: z.literal("auto-sign"),
});

export type AutoSignStrategy = z.infer<typeof AutoSignStrategySchema>;

/**
 * Schema for auto-reject strategy: rejects all sign requests.
 */
export const AutoRejectStrategySchema = z.object({
  type: z.literal("auto-reject"),
});

export type AutoRejectStrategy = z.infer<typeof AutoRejectStrategySchema>;

/**
 * Schema for callback strategy: delegates sign decisions to a callback function.
 */
export const CallbackStrategySchema = z.object({
  type: z.literal("callback"),
  /** Callback function that handles sign requests */
  handler: z.unknown().refine(
    (val): val is SignCallback => typeof val === "function",
    { message: "Expected a callback function" }
  ),
});

export type CallbackStrategy = z.infer<typeof CallbackStrategySchema>;

/**
 * Schema for event emitter strategy: emits sign requests as events.
 */
export const EventEmitterStrategySchema = z.object({
  type: z.literal("event-emitter"),
  /** EventTarget for emitting sign-request events */
  emitter: z.unknown().refine(
    (val): val is EventTarget =>
      val !== null && typeof val === "object" && "addEventListener" in val,
    { message: "Expected an EventTarget" }
  ),
  /** Timeout in milliseconds for waiting on event response (default: 60000) */
  timeout: z.number().optional(),
});

export type EventEmitterStrategy = z.infer<typeof EventEmitterStrategySchema>;

/**
 * Schema for sign strategy union type.
 *
 * Uses discriminatedUnion for efficient parsing based on the 'type' field.
 */
export const SignStrategySchema = z.discriminatedUnion("type", [
  AutoSignStrategySchema,
  AutoRejectStrategySchema,
  CallbackStrategySchema,
  EventEmitterStrategySchema,
]);

export type SignStrategy = z.infer<typeof SignStrategySchema>;

/**
 * Default sign strategy is auto-sign for convenience.
 */
export const defaultSignStrategy: SignStrategy = { type: "auto-sign" };

// =============================================================================
// Validation Helpers
// =============================================================================

import type { Result } from "../delegations/types.schema";
import type { ValidationError } from "../storage.schema";

/**
 * Validates a SignStrategy object and returns a Result.
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
 * Validates a SignRequest object and returns a Result.
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
