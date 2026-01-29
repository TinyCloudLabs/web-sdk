/**
 * Delegation management types for TinyCloud SDK v2.
 *
 * These types support the delegation, capability key management,
 * and sharing link functionality.
 *
 * @packageDocumentation
 */

import type {
  FetchFunction,
  IKVService,
  InvokeFunction,
  ServiceSession,
} from "@tinycloudlabs/sdk-services";

// =============================================================================
// JWK Type (JSON Web Key)
// =============================================================================

/**
 * JSON Web Key representation for cryptographic keys.
 *
 * Follows the JWK specification (RFC 7517) with common fields
 * used in TinyCloud delegation operations.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7517
 */
export interface JWK {
  /** Key type (e.g., "EC", "RSA", "OKP") */
  kty: string;
  /** Curve for EC/OKP keys (e.g., "P-256", "Ed25519") */
  crv?: string;
  /** X coordinate for EC keys, public key for OKP */
  x?: string;
  /** Y coordinate for EC keys */
  y?: string;
  /** Private key value (d parameter) */
  d?: string;
  /** Public exponent for RSA keys */
  e?: string;
  /** Modulus for RSA keys */
  n?: string;
  /** Key ID */
  kid?: string;
  /** Algorithm */
  alg?: string;
  /** Key use (e.g., "sig", "enc") */
  use?: string;
  /** Key operations (e.g., ["sign", "verify"]) */
  key_ops?: string[];
}

// =============================================================================
// Key Management Types (v2 spec)
// =============================================================================

/**
 * Type of key in the capability registry.
 *
 * - `main`: Primary wallet/account key (highest authority)
 * - `session`: Temporary session key created for a browsing session
 * - `ingested`: Key imported from an external delegation
 */
export type KeyType = "main" | "session" | "ingested";

/**
 * Information about a cryptographic key used for delegations.
 *
 * Keys are managed by the CapabilityKeyRegistry and associated
 * with specific capabilities they can exercise.
 *
 * @example
 * ```typescript
 * const sessionKey: KeyInfo = {
 *   id: "session-key-1",
 *   did: "did:key:z6Mk...",
 *   type: "session",
 *   priority: 0,
 *   jwk: { kty: "EC", crv: "P-256", ... }
 * };
 * ```
 */
export interface KeyInfo {
  /** Unique identifier for this key */
  id: string;
  /** DID associated with this key (did:key or did:pkh format) */
  did: string;
  /** Type of key determining its authority level */
  type: KeyType;
  /** Private key in JWK format (present for session/ingested keys, absent for main) */
  jwk?: JWK;
  /** Priority for key selection (lower = higher priority: session=0, main=1, ingested=2) */
  priority: number;
}

/**
 * Entry in the capability registry mapping a capability to available keys.
 *
 * Each entry represents a specific resource/action pair and the keys
 * that can be used to exercise that capability.
 *
 * @example
 * ```typescript
 * const entry: CapabilityEntry = {
 *   resource: "tinycloud://space-id/kv/my-data",
 *   action: "tinycloud.kv/get",
 *   keys: [sessionKey, mainKey],
 *   delegation: delegationObject,
 *   expiresAt: new Date("2024-12-31")
 * };
 * ```
 */
export interface CapabilityEntry {
  /** Resource URI this capability applies to */
  resource: string;
  /** Action this capability authorizes (e.g., "tinycloud.kv/get") */
  action: string;
  /** Keys that can exercise this capability, ordered by priority */
  keys: KeyInfo[];
  /** The delegation that grants this capability */
  delegation: Delegation;
  /** When this capability expires */
  expiresAt?: Date;
}

// =============================================================================
// Delegation Record Types (v2 spec)
// =============================================================================

/**
 * Persistent record of a delegation stored in the system.
 *
 * DelegationRecord extends the core Delegation with metadata
 * for storage, indexing, and chain traversal.
 *
 * @example
 * ```typescript
 * const record: DelegationRecord = {
 *   cid: "bafyrei...",
 *   spaceId: "space-123",
 *   delegator: "did:pkh:eip155:1:0x...",
 *   delegatee: "did:key:z6Mk...",
 *   keyId: "session-key-1",
 *   path: "/kv/shared/*",
 *   actions: ["tinycloud.kv/get", "tinycloud.kv/put"],
 *   expiry: new Date("2024-12-31"),
 *   notBefore: new Date("2024-01-01"),
 *   isRevoked: false,
 *   createdAt: new Date()
 * };
 * ```
 */
export interface DelegationRecord {
  /** Content identifier (CID) of the delegation */
  cid: string;
  /** Space ID this delegation applies to */
  spaceId: string;
  /** DID of the delegator (grantor) */
  delegator: string;
  /** DID of the delegatee (recipient) */
  delegatee: string;
  /** Key ID used to sign/exercise this delegation */
  keyId?: string;
  /** Resource path pattern this delegation grants access to */
  path: string;
  /** Actions this delegation authorizes */
  actions: string[];
  /** When this delegation expires */
  expiry?: Date;
  /** When this delegation becomes valid (not before) */
  notBefore?: Date;
  /** Whether this delegation has been revoked */
  isRevoked: boolean;
  /** When this delegation was created */
  createdAt: Date;
  /** Parent delegation CID if this is a sub-delegation */
  parentCid?: string;
}

// =============================================================================
// Result and Error Types
// =============================================================================

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
  /** Service not initialized */
  NOT_INITIALIZED: "NOT_INITIALIZED",
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
  /** KV service not available for data retrieval */
  KV_SERVICE_UNAVAILABLE: "KV_SERVICE_UNAVAILABLE",
  /** Data fetch failed */
  DATA_FETCH_FAILED: "DATA_FETCH_FAILED",
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
  /** Authorization header (UCAN bearer token) - optional, for sharing links */
  authHeader?: string;
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
 *
 * @deprecated Use ShareLink instead (v2 spec) which includes schema and expiry
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
 *
 * @deprecated Use GenerateShareParams instead (v2 spec)
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
 *
 * @deprecated Use ShareLinkData instead (v2 spec)
 */
export interface SharingLinkData<T = unknown> {
  /** The data accessed via the sharing link */
  data: T;
  /** The delegation that authorized this access */
  delegation: Delegation;
}

/**
 * A chain of delegations from root to leaf (array format).
 *
 * Delegation chains represent the full path of authority
 * from an original delegator through any sub-delegations
 * to the final delegatee.
 *
 * @remarks
 * This is the v1 format (array). For v2 structured format, use DelegationChainV2.
 * Migration to DelegationChainV2 is planned for future releases.
 */
export type DelegationChain = Delegation[];

/**
 * Structured delegation chain (v2 spec).
 *
 * Provides explicit access to root, intermediate, and leaf delegations
 * in the chain. Preferred for new code.
 *
 * @example
 * ```typescript
 * const chain: DelegationChainV2 = {
 *   root: ownerDelegation,
 *   chain: [intermediateDelegation],
 *   leaf: userDelegation
 * };
 *
 * // Access the final delegatee
 * console.log(chain.leaf.delegateDID);
 *
 * // Check chain depth
 * console.log(`Chain has ${chain.chain.length + 2} delegations`);
 * ```
 */
export interface DelegationChainV2 {
  /** The root delegation from the original authority */
  root: Delegation;
  /** Intermediate delegations in the chain (may be empty) */
  chain: Delegation[];
  /** The final delegation to the current user */
  leaf: Delegation;
}

// =============================================================================
// Filtering and Query Types (v2 spec)
// =============================================================================

/**
 * Direction of delegation to filter by.
 *
 * - `granted`: Delegations where the user is the delegator
 * - `received`: Delegations where the user is the delegatee
 * - `all`: Both granted and received delegations
 */
export type DelegationDirection = "granted" | "received" | "all";

/**
 * Filters for listing delegations.
 *
 * Used by DelegationService.list() to filter results.
 *
 * @example
 * ```typescript
 * const filters: DelegationFilters = {
 *   direction: "received",
 *   path: "/kv/shared/*",
 *   actions: ["tinycloud.kv/get"],
 *   includeRevoked: false
 * };
 * ```
 */
export interface DelegationFilters {
  /** Filter by delegation direction */
  direction?: DelegationDirection;
  /** Filter by resource path pattern (supports wildcards) */
  path?: string;
  /** Filter by required actions */
  actions?: string[];
  /** Include revoked delegations (default: false) */
  includeRevoked?: boolean;
  /** Filter by delegator DID */
  delegator?: string;
  /** Filter by delegatee DID */
  delegatee?: string;
  /** Only include delegations valid at this time */
  validAt?: Date;
  /** Maximum number of results to return */
  limit?: number;
  /** Cursor for pagination */
  cursor?: string;
}

// =============================================================================
// Space Types (v2 spec)
// =============================================================================

/**
 * Type of space ownership.
 *
 * - `owned`: User is the owner of the space
 * - `delegated`: User has delegated access to the space
 */
export type SpaceOwnership = "owned" | "delegated";

/**
 * Information about a space the user has access to.
 *
 * @example
 * ```typescript
 * const space: SpaceInfo = {
 *   id: "space-123",
 *   name: "My Documents",
 *   owner: "did:pkh:eip155:1:0x...",
 *   type: "owned",
 *   permissions: ["tinycloud.kv/*", "tinycloud.space/*"]
 * };
 * ```
 */
export interface SpaceInfo {
  /** Space identifier */
  id: string;
  /** Human-readable name for the space */
  name?: string;
  /** DID of the space owner */
  owner: string;
  /** Whether user owns or has delegated access */
  type: SpaceOwnership;
  /** Permissions the user has in this space */
  permissions?: string[];
  /** When the access expires (for delegated spaces) */
  expiresAt?: Date;
}

// =============================================================================
// Share Link Types (v2 spec)
// =============================================================================

/**
 * Schema for encoding share link data.
 *
 * - `base64`: Base64-encoded delegation data in URL
 * - `compact`: Compact binary encoding for shorter URLs
 * - `ipfs`: IPFS CID reference (delegation stored on IPFS)
 */
export type ShareSchema = "base64" | "compact" | "ipfs";

/**
 * A shareable link containing delegation credentials.
 *
 * Share links allow users to grant access to resources via a URL
 * that can be shared outside the platform.
 *
 * @example
 * ```typescript
 * const shareLink: ShareLink = {
 *   token: "abc123...",
 *   url: "https://app.example.com/share/abc123...",
 *   delegation: delegationObject,
 *   schema: "base64",
 *   expiresAt: new Date("2024-12-31")
 * };
 * ```
 */
export interface ShareLink {
  /** Unique token identifying this share link */
  token: string;
  /** Full URL for sharing */
  url: string;
  /** The delegation this link grants access to */
  delegation: Delegation;
  /** Encoding schema used for the link */
  schema: ShareSchema;
  /** When this share link expires */
  expiresAt?: Date;
  /** Human-readable description of what is being shared */
  description?: string;
}

/**
 * Data retrieved from a share link.
 *
 * Contains both the accessed data and metadata about the delegation
 * that authorized the access.
 */
export interface ShareLinkData<T = unknown> {
  /** The retrieved data */
  data: T;
  /** The delegation that authorized this access */
  delegation: Delegation;
  /** The space the data belongs to */
  spaceId: string;
  /** The resource path that was accessed */
  path: string;
}

// =============================================================================
// Ingestion Types (v2 spec)
// =============================================================================

/**
 * Options for ingesting an external delegation.
 *
 * Ingestion allows importing delegations from share links
 * or other external sources into the local capability registry.
 *
 * @example
 * ```typescript
 * const options: IngestOptions = {
 *   persist: true,
 *   validateChain: true,
 *   keyName: "shared-access-key"
 * };
 * ```
 */
export interface IngestOptions {
  /** Whether to persist the delegation to storage (default: true) */
  persist?: boolean;
  /** Whether to validate the full delegation chain (default: true) */
  validateChain?: boolean;
  /** Name for the ingested key (auto-generated if not provided) */
  keyName?: string;
  /** Whether to create a session key for this delegation (default: false) */
  createSessionKey?: boolean;
  /** Override the priority for the ingested key */
  priority?: number;
}

// =============================================================================
// Parameter Types (v2 spec updates)
// =============================================================================

/**
 * Parameters for generating a share link.
 *
 * @example
 * ```typescript
 * const params: GenerateShareParams = {
 *   path: "/kv/documents/report.pdf",
 *   actions: ["tinycloud.kv/get"],
 *   expiry: new Date("2024-12-31"),
 *   schema: "base64",
 *   description: "Q4 Financial Report"
 * };
 * ```
 */
export interface GenerateShareParams {
  /** Resource path to share */
  path: string;
  /** Actions to authorize (defaults to read-only) */
  actions?: string[];
  /** When the share link expires */
  expiry?: Date;
  /** Encoding schema for the link (default: "base64") */
  schema?: ShareSchema;
  /** Human-readable description */
  description?: string;
  /** Base URL for the share link (defaults to configured base) */
  baseUrl?: string;
}

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
 * Provider interface for cryptographic key operations.
 *
 * Allows injection of platform-specific key generation (e.g., WASM-based
 * session manager in web-sdk, native crypto in node-sdk).
 */
export interface KeyProvider {
  /** Generate a new session key, returns key ID */
  createSessionKey(name: string): Promise<string>;
  /** Get JWK for a key */
  getJWK(keyId: string): object;
  /** Get DID for a key */
  getDID(keyId: string): Promise<string>;
}

/**
 * Function that returns an IKVService instance.
 * Used for lazy initialization when KVService may not be available at construction time.
 */
export type KVServiceGetter = () => IKVService | undefined;

/**
 * Configuration for SharingLinks.
 */
export interface SharingLinksConfig {
  /** Base URL for generating sharing links (e.g., "https://share.myapp.com") */
  baseUrl: string;
  /** Optional key provider for cryptographic operations */
  keyProvider?: KeyProvider;
  /**
   * Function to get the KVService for fetching shared data.
   * Required for retrieve() to actually fetch data.
   * Can be provided lazily since KVService may not exist at construction time.
   */
  getKVService?: KVServiceGetter;
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
