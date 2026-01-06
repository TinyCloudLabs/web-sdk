/**
 * TinyCloud-specific session data that's persisted alongside the base session.
 */
export interface PersistedTinyCloudSession {
  /** The delegation header containing the UCAN */
  delegationHeader: { Authorization: string };
  /** The delegation CID */
  delegationCid: string;
  /** The namespace ID for this session */
  namespaceId: string;
  /** The verification method DID */
  verificationMethod: string;
}

/**
 * Full TinyCloud session with delegation data.
 *
 * This extends the base web-core session with TinyCloud-specific fields
 * needed for making invocations and delegations.
 */
export interface TinyCloudSession {
  /** User's Ethereum address */
  address: string;
  /** EIP-155 Chain ID */
  chainId: number;
  /** Session key ID */
  sessionKey: string;
  /** The namespace ID for this session */
  namespaceId: string;
  /** The delegation CID */
  delegationCid: string;
  /** The delegation header for API calls */
  delegationHeader: { Authorization: string };
  /** The verification method DID */
  verificationMethod: string;
  /** The session key JWK (required for invoke operations) */
  jwk: object;
  /** The signed SIWE message */
  siwe: string;
  /** User's signature of the SIWE message */
  signature: string;
}

/**
 * Persisted session data structure.
 *
 * Contains all data needed to restore a session without re-authentication.
 * Aligned with web-sdk's PersistedSession structure.
 */
export interface PersistedSessionData {
  /** User's Ethereum address */
  address: string;
  /** EIP-155 Chain ID */
  chainId: number;
  /** Session key in JWK format (stringified) */
  sessionKey: string;
  /** The signed SIWE message */
  siwe: string;
  /** User's signature of the SIWE message */
  signature: string;
  /** TinyCloud delegation data if available */
  tinycloudSession?: PersistedTinyCloudSession;
  /** Session expiration timestamp (ISO 8601) */
  expiresAt: string;
  /** Session creation timestamp (ISO 8601) */
  createdAt: string;
  /** Schema version for migrations */
  version: string;
  /** Optional ENS data */
  ens?: {
    domain?: string | null;
    avatarUrl?: string | null;
  };
}

/**
 * Session storage interface.
 *
 * Abstracts how sessions are persisted across different platforms.
 * - Browser: localStorage
 * - Node.js: file system or memory
 */
export interface ISessionStorage {
  /**
   * Save a session for an address.
   * @param address - Ethereum address (key for lookup)
   * @param session - Session data to persist
   */
  save(address: string, session: PersistedSessionData): Promise<void>;

  /**
   * Load a session for an address.
   * @param address - Ethereum address
   * @returns Session data or null if not found
   */
  load(address: string): Promise<PersistedSessionData | null>;

  /**
   * Clear a session for an address.
   * @param address - Ethereum address
   */
  clear(address: string): Promise<void>;

  /**
   * Check if a session exists for an address (synchronous check).
   * @param address - Ethereum address
   * @returns true if session exists
   */
  exists(address: string): boolean;

  /**
   * Check if the storage backend is available.
   * @returns true if storage can be used
   */
  isAvailable(): boolean;
}
