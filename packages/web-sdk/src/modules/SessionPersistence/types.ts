/**
 * Types for session persistence functionality
 */

/**
 * TinyCloud session delegation data
 */
export interface PersistedTinyCloudSession {
  /** The delegation from the user to the session key */
  delegationHeader: { Authorization: string };
  /** The delegation reference from the user to the session key */
  delegationCid: string;
  /** The namespace the orbit is in */
  namespace: string;
  /** The orbit that the session key is permitted to perform actions against */
  orbitId: string;
  /** The verification method of the session key */
  verificationMethod: string;
}

/**
 * Bare minimum persisted session data
 */
export interface PersistedSession {
  // TCW Session (absolute minimum)
  /** User's Ethereum address */
  address: string;
  /** EIP-155 Chain ID */
  chainId: number;
  /** Session key in JWK format - this IS the delegation key */
  sessionKey: string;
  /** The signed SIWE message */
  siwe: string;
  /** User's signature of the SIWE message */
  signature: string;

  // TinyCloud Session (the actual delegation)
  /** TinyCloud delegation data if available */
  tinycloudSession?: PersistedTinyCloudSession;

  // Minimal metadata
  /** When session expires (ISO timestamp) */
  expiresAt: string;
  /** When session was created (ISO timestamp) */
  createdAt: string;
  /** Session format version for migration support */
  version: string;
}

/**
 * Encrypted session data stored in browser storage
 */
export interface EncryptedPersistedSession {
  /** Encrypted session data */
  data: string;
  /** Initialization vector for decryption */
  iv: string;
  /** Session format version */
  version: string;
  /** When session expires (plaintext for cleanup) */
  expiresAt: string;
}

/**
 * Configuration for session persistence
 */
export interface SessionPersistenceConfig {
  /** Whether persistence is enabled */
  enabled: boolean;
  /** Storage type to use */
  storage: "localStorage" | "sessionStorage";
  /** Whether to encrypt stored sessions */
  encryptionEnabled: boolean;
  /** Session TTL in milliseconds */
  sessionTTL: number;
  /** Storage key prefix */
  keyPrefix: string;
  /** Whether to automatically resume sessions on signIn() */
  autoResumeSession: boolean;
}

/**
 * Default persistence configuration
 */
export const DEFAULT_PERSISTENCE_CONFIG: SessionPersistenceConfig = {
  enabled: true,
  storage: "localStorage",
  encryptionEnabled: !!crypto.subtle, // default on if Web Crypto API available
  sessionTTL: 7 * 24 * 60 * 60 * 1000, // 7 * 24 hours
  keyPrefix: "tinycloud_session",
  autoResumeSession: true,
};

/**
 * Extended TCW Client Config with persistence options
 */
declare module "@tinycloudlabs/web-core/client" {
  interface TCWClientConfig {
    /** Session persistence configuration */
    persistence?: Partial<SessionPersistenceConfig>;
  }
}
