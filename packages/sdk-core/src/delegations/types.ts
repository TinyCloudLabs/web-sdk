/**
 * Delegation management types for TinyCloud SDK.
 *
 * These types support the delegation and sharing link functionality
 * extracted from ITinyCloudStorage into a dedicated module.
 *
 * @packageDocumentation
 */

import { ServiceSession, FetchFunction, InvokeFunction } from "../services/types";

/**
 * Result type pattern for delegation operations.
 *
 * Services return Result types instead of throwing errors, providing
 * explicit error handling and better type safety.
 *
 * @example
 * ```typescript
 * const result = await delegationManager.create(params);
 * if (result.ok) {
 *   console.log("Created delegation:", result.data.cid);
 * } else {
 *   console.error("Failed:", result.error.message);
 * }
 * ```
 */
export type Result<T, E = DelegationError> =
  | { ok: true; data: T }
  | { ok: false; error: E };

/**
 * Error type for delegation operations.
 */
export interface DelegationError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** The service that produced the error */
  service: "delegation";
  /** Original error if wrapping another error */
  cause?: Error;
  /** Additional metadata about the error */
  meta?: Record<string, unknown>;
}

/**
 * Error codes for delegation operations.
 */
export const DelegationErrorCodes = {
  /** Authentication required for this operation */
  AUTH_REQUIRED: "AUTH_REQUIRED",
  /** Session has expired */
  AUTH_EXPIRED: "AUTH_EXPIRED",
  /** Delegation not found */
  NOT_FOUND: "NOT_FOUND",
  /** Delegation has been revoked */
  REVOKED: "REVOKED",
  /** Network request failed */
  NETWORK_ERROR: "NETWORK_ERROR",
  /** Request timed out */
  TIMEOUT: "TIMEOUT",
  /** Request was aborted */
  ABORTED: "ABORTED",
  /** Invalid input parameters */
  INVALID_INPUT: "INVALID_INPUT",
  /** Insufficient permissions for the requested action */
  PERMISSION_DENIED: "PERMISSION_DENIED",
  /** Delegation creation failed */
  CREATION_FAILED: "CREATION_FAILED",
  /** Delegation revocation failed */
  REVOCATION_FAILED: "REVOCATION_FAILED",
  /** Invalid sharing link token */
  INVALID_TOKEN: "INVALID_TOKEN",
} as const;

export type DelegationErrorCode =
  (typeof DelegationErrorCodes)[keyof typeof DelegationErrorCodes];

/**
 * Represents a delegation from one DID to another.
 *
 * Delegations grant specific permissions (actions) on a resource path
 * within a space, from a delegator to a delegatee.
 */
export interface Delegation {
  /** Content identifier (CID) of the delegation */
  cid: string;
  /** DID of the delegate (the party receiving the delegation) */
  delegateDID: string;
  /** Space ID this delegation applies to */
  spaceId: string;
  /** Resource path this delegation grants access to */
  path: string;
  /** Actions this delegation authorizes (e.g., ["tinycloud.kv/get", "tinycloud.kv/put"]) */
  actions: string[];
  /** When this delegation expires */
  expiry: Date;
  /** Whether this delegation has been revoked */
  isRevoked: boolean;
  /** DID of the delegator (the party granting the delegation) */
  delegatorDID?: string;
  /** When this delegation was created */
  createdAt?: Date;
  /** Parent delegation CID if this is a sub-delegation */
  parentCid?: string;
  /** Whether sub-delegation is allowed */
  allowSubDelegation?: boolean;
}

/**
 * Parameters for creating a new delegation.
 */
export interface CreateDelegationParams {
  /** DID of the delegate (the party receiving the delegation) */
  delegateDID: string;
  /** Resource path this delegation grants access to */
  path: string;
  /** Actions to authorize (e.g., ["tinycloud.kv/get", "tinycloud.kv/put"]) */
  actions: string[];
  /** When this delegation expires (defaults to session expiry) */
  expiry?: Date;
  /** Whether to disable sub-delegation (default: false, meaning sub-delegation is allowed) */
  disableSubDelegation?: boolean;
  /** Optional statement for the SIWE message */
  statement?: string;
}

/**
 * Represents a sharing link that wraps a delegation.
 *
 * Sharing links provide a URL-based mechanism for granting
 * temporary access to resources without requiring the recipient
 * to have an existing session.
 */
export interface SharingLink {
  /** Unique token identifying this sharing link */
  token: string;
  /** The underlying delegation this link is based on */
  delegation: Delegation;
  /** Full URL that can be shared to grant access */
  url: string;
}

/**
 * Parameters for generating a sharing link.
 */
export interface GenerateSharingLinkParams {
  /** Resource key/path to share */
  key: string;
  /** Actions to authorize (defaults to read-only) */
  actions?: string[];
  /** When the link expires (defaults to 24 hours) */
  expiry?: Date;
  /** Optional statement for the SIWE message */
  statement?: string;
}

/**
 * Response from retrieving a sharing link.
 */
export interface SharingLinkData<T = unknown> {
  /** The data accessed via the sharing link */
  data: T;
  /** The delegation that authorized this access */
  delegation: Delegation;
}

/**
 * A chain of delegations from root to leaf.
 *
 * Delegation chains represent the full path of authority
 * from an original delegator through any sub-delegations
 * to the final delegatee.
 */
export type DelegationChain = Delegation[];

/**
 * Configuration for DelegationManager.
 */
export interface DelegationManagerConfig {
  /** TinyCloud host URLs */
  hosts: string[];
  /** Active session for authentication */
  session: ServiceSession;
  /** Platform-specific invoke function (from WASM binding) */
  invoke: InvokeFunction;
  /** Optional custom fetch implementation */
  fetch?: FetchFunction;
}

/**
 * Configuration for SharingLinks.
 */
export interface SharingLinksConfig {
  /** Base URL for generating sharing links (e.g., "https://share.myapp.com") */
  baseUrl: string;
}

/**
 * Response from the delegation API.
 */
export interface DelegationApiResponse {
  /** SIWE message content */
  siwe: string;
  /** Signature of the SIWE message */
  signature: string;
  /** Delegation version */
  version: number;
  /** CID of the created delegation */
  cid?: string;
}
