/**
 * Failure codes for the application-facing policy-access flow.
 *
 * Every code names the boundary that refused, so an app can render a correct
 * message without inspecting HTTP status codes or parsing engine denials.
 */
export const POLICY_ACCESS_ERROR_CODES = [
  // configuration / caller mistakes
  "access-descriptor-invalid",
  "capability-not-read-only",
  "capability-not-exact-resource",
  "holder-mismatch",
  "origin-not-allowed",
  // credential acquisition
  "credential-unreachable",
  "credential-denied",
  "credential-response-invalid",
  "credential-subject-mismatch",
  // policy engine presentation
  "engine-unreachable",
  "engine-response-invalid",
  "engine-denied",
  "challenge-binding-mismatch",
  "challenge-reused",
  // delegation
  "delegation-invalid",
  "delegation-wrong-holder",
  "delegation-wrong-issuer",
  "delegation-ttl-excessive",
  "delegation-capability-wider",
  "delegation-not-terminal",
  "delegation-import-failed",
  // node read
  "node-unreachable",
  "node-denied",
  "node-response-invalid",
  "read-not-contained",
  "session-expired",
  // local decrypt
  "decrypt-failed",
] as const;

export type PolicyAccessErrorCode = (typeof POLICY_ACCESS_ERROR_CODES)[number];

export class PolicyAccessError extends Error {
  readonly code: PolicyAccessErrorCode;
  /** Frozen Policy Engine denial code, when the engine refused. */
  readonly denialCode?: string;
  readonly status?: number;

  constructor(
    code: PolicyAccessErrorCode,
    message: string,
    options: { readonly denialCode?: string; readonly status?: number } = {},
  ) {
    super(message);
    this.name = "PolicyAccessError";
    this.code = code;
    if (options.denialCode !== undefined) this.denialCode = options.denialCode;
    if (options.status !== undefined) this.status = options.status;
  }
}
