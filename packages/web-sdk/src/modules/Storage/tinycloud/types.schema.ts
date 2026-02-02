/**
 * Zod schemas for TinyCloud storage session and configuration types.
 *
 * These schemas provide runtime validation for session configuration,
 * active sessions, and host configuration. Types are derived from
 * schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";

// =============================================================================
// Session Configuration
// =============================================================================

/**
 * Configuration object for starting a TinyCloud session.
 */
export const SessionConfigSchema = z.object({
  /** Actions that the session key will be permitted to perform, organized by service and path */
  actions: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
  /** Ethereum address. */
  address: z.string(),
  /** Chain ID. */
  chainId: z.number(),
  /** Domain of the webpage. */
  domain: z.string(),
  /** Current time for SIWE message (ISO 8601 format). */
  issuedAt: z.string(),
  /** The space that is the target resource of the delegation. */
  spaceId: z.string(),
  /** The earliest time that the session will be valid from. */
  notBefore: z.string().optional(),
  /** The latest time that the session will be valid until. */
  expirationTime: z.string(),
  /** Optional parent delegations to inherit and attenuate */
  parents: z.array(z.string()).optional(),
  /** Optional jwk to delegate to */
  jwk: z.record(z.string(), z.unknown()).optional(),
});

export type SessionConfig = z.infer<typeof SessionConfigSchema>;

// =============================================================================
// Active Session
// =============================================================================

/**
 * A TinyCloud session.
 */
export const SessionSchema = z.object({
  /** The delegation from the user to the session key. */
  delegationHeader: z.object({
    Authorization: z.string(),
  }),
  /** The delegation reference from the user to the session key. */
  delegationCid: z.string(),
  /** The session key (JWK format). */
  jwk: z.record(z.string(), z.unknown()),
  /** The space that the session key is permitted to perform actions against. */
  spaceId: z.string(),
  /** The verification method of the session key. */
  verificationMethod: z.string(),
});

export type Session = z.infer<typeof SessionSchema>;

// =============================================================================
// Host Configuration
// =============================================================================

/**
 * Configuration object for generating a Space Host Delegation SIWE message.
 */
export const HostConfigSchema = z.object({
  /** Ethereum address. */
  address: z.string(),
  /** Chain ID. */
  chainId: z.number(),
  /** Domain of the webpage. */
  domain: z.string(),
  /** Current time for SIWE message (ISO 8601 format). */
  issuedAt: z.string(),
  /** The space that is the target resource of the delegation. */
  spaceId: z.string(),
  /** The peer that is the target/invoker in the delegation. */
  peerId: z.string(),
});

export type HostConfig = z.infer<typeof HostConfigSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validation error type.
 */
export interface ValidationError {
  code: string;
  message: string;
  issues?: unknown[];
}

/**
 * Result type for validation operations.
 */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ValidationError };

/**
 * Validates SessionConfig.
 */
export function validateSessionConfig(data: unknown): ValidationResult<SessionConfig> {
  const result = SessionConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates Session.
 */
export function validateSession(data: unknown): ValidationResult<Session> {
  const result = SessionSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates HostConfig.
 */
export function validateHostConfig(data: unknown): ValidationResult<HostConfig> {
  const result = HostConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data };
}
