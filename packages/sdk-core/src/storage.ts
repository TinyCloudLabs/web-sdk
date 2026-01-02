/**
 * Persisted session data structure.
 *
 * Contains all data needed to restore a session without re-authentication.
 */
export interface PersistedSessionData {
  /** The session key JWK */
  sessionKey: object;
  /** The delegation header containing the UCAN */
  delegationHeader: { Authorization: string };
  /** The delegation CID */
  delegationCid: string;
  /** The namespace ID for this session */
  namespaceId: string;
  /** The verification method DID */
  verificationMethod: string;
  /** Session expiration timestamp (ISO 8601) */
  expiresAt: string;
  /** Session creation timestamp (ISO 8601) */
  createdAt: string;
  /** Chain ID the session is bound to */
  chainId: number;
  /** Optional ENS data */
  ens?: {
    name?: string;
    avatar?: string;
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
