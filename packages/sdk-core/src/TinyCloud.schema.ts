/**
 * Zod schemas for TinyCloud SDK configuration types.
 *
 * These schemas provide runtime validation for TinyCloud configuration.
 * Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Result } from "./delegations/types.schema";
import type { ValidationError } from "./storage.schema";
import type {
  InvokeFunction,
  FetchFunction,
  ServiceConstructor,
} from "@tinycloudlabs/sdk-services";

// =============================================================================
// Retry Policy Schema
// =============================================================================

/**
 * Schema for backoff strategy.
 */
export const BackoffStrategySchema = z.enum(["none", "linear", "exponential"]);
export type BackoffStrategy = z.infer<typeof BackoffStrategySchema>;

/**
 * Schema for retry policy configuration.
 */
export const RetryPolicySchema = z.object({
  /** Maximum number of attempts (including initial) */
  maxAttempts: z.number().int().positive(),
  /** Backoff strategy between retries */
  backoff: BackoffStrategySchema,
  /** Base delay in milliseconds for backoff calculation */
  baseDelayMs: z.number().int().nonnegative(),
  /** Maximum delay in milliseconds between retries */
  maxDelayMs: z.number().int().nonnegative(),
  /** Error codes that should trigger a retry */
  retryableErrors: z.array(z.string()),
});

export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Schema for partial retry policy (all fields optional).
 */
export const PartialRetryPolicySchema = RetryPolicySchema.partial();
export type PartialRetryPolicy = z.infer<typeof PartialRetryPolicySchema>;

// =============================================================================
// TinyCloud Config Schema
// =============================================================================

/**
 * Schema for TinyCloud SDK configuration.
 */
export const TinyCloudConfigSchema = z.object({
  /** Whether to automatically resolve ENS names */
  resolveEns: z.boolean().optional(),

  // === Service Configuration ===

  /**
   * TinyCloud host URLs.
   * Required when using services.
   */
  hosts: z.array(z.string()).optional(),

  /**
   * Platform-specific invoke function from WASM binding.
   * Required when using services.
   */
  invoke: z
    .unknown()
    .refine(
      (val): val is InvokeFunction =>
        val === undefined || typeof val === "function",
      { message: "Expected an invoke function or undefined" }
    )
    .optional(),

  /**
   * Custom fetch implementation.
   * Defaults to globalThis.fetch.
   */
  fetch: z
    .unknown()
    .refine(
      (val): val is FetchFunction =>
        val === undefined || typeof val === "function",
      { message: "Expected a fetch function or undefined" }
    )
    .optional(),

  /**
   * Service constructors to register.
   * Built-in services (like KVService) are registered by default unless overridden.
   */
  services: z
    .record(
      z.string(),
      z.unknown().refine(
        (val): val is ServiceConstructor => typeof val === "function",
        { message: "Expected a service constructor" }
      )
    )
    .optional(),

  /**
   * Per-service configuration.
   */
  serviceConfigs: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),

  /**
   * Retry policy for service operations.
   */
  retryPolicy: PartialRetryPolicySchema.optional(),
});

export type TinyCloudConfig = z.infer<typeof TinyCloudConfigSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates a TinyCloudConfig object and returns a Result.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 *
 * @example
 * ```typescript
 * const result = validateTinyCloudConfig(rawConfig);
 * if (result.ok) {
 *   // result.data is typed as TinyCloudConfig
 *   console.log(result.data.hosts);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function validateTinyCloudConfig(
  data: unknown
): Result<TinyCloudConfig, ValidationError> {
  const result = TinyCloudConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        service: "tinycloud",
        meta: { issues: result.error.issues },
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates a RetryPolicy object and returns a Result.
 */
export function validateRetryPolicy(
  data: unknown
): Result<RetryPolicy, ValidationError> {
  const result = RetryPolicySchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        service: "tinycloud",
        meta: { issues: result.error.issues },
      },
    };
  }
  return { ok: true, data: result.data };
}
