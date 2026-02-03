/**
 * Zod schemas for UserAuthorization configuration types.
 *
 * These schemas provide runtime validation for authorization configuration.
 * Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import type { Result } from "./delegations/types.schema";
import type { ValidationError } from "./storage.schema";
import { SignStrategySchema } from "./authorization/strategies.schema";
import { SpaceCreationHandlerSchema } from "./authorization/spaceCreation.schema";
import type { ISigner } from "./signer";
import type { ISessionStorage } from "./storage";
import type { TCWExtension, SiweConfig } from "@tinycloudlabs/web-core/client";

// =============================================================================
// Partial SIWE Message Schema
// =============================================================================

/**
 * Schema for partial SIWE message overrides.
 *
 * This extends the base SiweConfig with additional common fields.
 */
export const PartialSiweMessageSchema = z.object({
  /** Ethereum address of the signer */
  address: z.string().optional(),
  /** Chain ID for the signing context */
  chainId: z.number().int().positive().optional(),
  /** URI for the SIWE message */
  uri: z.string().optional(),
  /** SIWE version (typically "1") */
  version: z.string().optional(),
  /** Domain for the SIWE message */
  domain: z.string().optional(),
  /** Statement for the SIWE message */
  statement: z.string().optional(),
  /** Nonce for replay protection */
  nonce: z.string().optional(),
  /** Issued at timestamp */
  issuedAt: z.string().optional(),
  /** Expiration time */
  expirationTime: z.string().optional(),
  /** Not before time */
  notBefore: z.string().optional(),
  /** Request ID */
  requestId: z.string().optional(),
  /** Resources array */
  resources: z.array(z.string()).optional(),
});

export type PartialSiweMessage = z.infer<typeof PartialSiweMessageSchema>;

// =============================================================================
// User Authorization Config Schema
// =============================================================================

/**
 * Schema for UserAuthorization configuration.
 *
 * Note: ISigner, ISessionStorage, TCWExtension, and SiweConfig are external types
 * that cannot be fully validated at runtime. We use z.unknown() for these.
 */
export const UserAuthorizationConfigSchema = z.object({
  /**
   * The signer to use for signing.
   * Validation-exempt: ISigner is an interface with methods.
   */
  signer: z.unknown().refine(
    (val): val is ISigner => val !== null && typeof val === "object",
    { message: "Expected an ISigner object" }
  ),

  /**
   * Session storage implementation.
   * Optional - defaults to platform-specific storage.
   */
  sessionStorage: z
    .unknown()
    .refine(
      (val): val is ISessionStorage | undefined =>
        val === undefined || (val !== null && typeof val === "object"),
      { message: "Expected an ISessionStorage object or undefined" }
    )
    .optional(),

  /**
   * Default SIWE configuration.
   * Optional - merged with defaults.
   */
  siweConfig: z
    .unknown()
    .refine(
      (val): val is SiweConfig | undefined =>
        val === undefined || (val !== null && typeof val === "object"),
      { message: "Expected a SiweConfig object or undefined" }
    )
    .optional(),

  /**
   * Domain for SIWE messages.
   * Defaults to current window location for web, required for node.
   */
  domain: z.string().optional(),

  /**
   * Extensions to apply to the authorization flow.
   */
  extensions: z
    .array(
      z.unknown().refine(
        (val): val is TCWExtension => val !== null && typeof val === "object",
        { message: "Expected a TCWExtension object" }
      )
    )
    .optional(),

  // Strategy configuration (added for auth module unification)

  /**
   * Strategy for handling sign requests.
   * Default: auto-sign for node, callback for web.
   */
  signStrategy: SignStrategySchema.optional(),

  /**
   * Handler for space creation confirmation.
   * Default: AutoApproveSpaceCreationHandler.
   */
  spaceCreationHandler: SpaceCreationHandlerSchema.optional(),

  /**
   * Whether to automatically create space if it doesn't exist.
   * Default: true.
   */
  autoCreateSpace: z.boolean().optional(),

  /**
   * Space name prefix.
   * Default: "default".
   */
  spacePrefix: z.string().optional(),

  /**
   * TinyCloud host URLs.
   */
  tinycloudHosts: z.array(z.string()).optional(),

  /**
   * Session expiration in milliseconds.
   * Default: 24 hours.
   */
  sessionExpirationMs: z.number().int().positive().optional(),
});

export type UserAuthorizationConfig = z.infer<typeof UserAuthorizationConfigSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates a UserAuthorizationConfig object and returns a Result.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 *
 * @example
 * ```typescript
 * const result = validateUserAuthorizationConfig(rawConfig);
 * if (result.ok) {
 *   // result.data is typed as UserAuthorizationConfig
 *   console.log(result.data.domain);
 * } else {
 *   console.error(result.error.message);
 * }
 * ```
 */
export function validateUserAuthorizationConfig(
  data: unknown
): Result<UserAuthorizationConfig, ValidationError> {
  const result = UserAuthorizationConfigSchema.safeParse(data);
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
 * Validates a PartialSiweMessage object and returns a Result.
 *
 * @param data - Unknown data to validate
 * @returns Result with validated data or validation error
 */
export function validatePartialSiweMessage(
  data: unknown
): Result<PartialSiweMessage, ValidationError> {
  const result = PartialSiweMessageSchema.safeParse(data);
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
