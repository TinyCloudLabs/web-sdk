/**
 * WasmKeyProvider - KeyProvider implementation using WASM session manager.
 *
 * This provider wraps the SessionManager from web-sdk-wasm to provide
 * cryptographic key operations required by the SharingService.
 *
 * Supports multiple named session keys that can coexist within a single
 * session manager instance.
 *
 * @packageDocumentation
 */

import type { KeyProvider, JWK } from "@tinycloudlabs/sdk-core";
import { initialized, tcwSession } from "@tinycloudlabs/web-sdk-wasm";

/** Type alias for SessionManager from the tcwSession namespace */
type TCWSessionManager = tcwSession.TCWSessionManager;

/**
 * Configuration for WasmKeyProvider.
 */
export interface WasmKeyProviderConfig {
  /**
   * Optional WASM session manager instance.
   * If not provided, a new manager will be created.
   */
  sessionManager?: TCWSessionManager;
}

/**
 * KeyProvider implementation for web-sdk using WASM session manager.
 *
 * This allows the SharingService to create new session keys for sharing links
 * using the same cryptographic operations as the main session management.
 *
 * Multiple named keys can coexist and are identified by their key ID for
 * delegation targeting.
 *
 * @example
 * ```typescript
 * // Create with a shared session manager
 * const sessionManager = new tcwSession.TCWSessionManager();
 * const keyProvider = new WasmKeyProvider({ sessionManager });
 *
 * // Or create standalone (manages its own session manager)
 * const keyProvider = new WasmKeyProvider();
 *
 * // Create multiple named keys
 * const keyId1 = await keyProvider.createSessionKey("share:abc123");
 * const keyId2 = await keyProvider.createSessionKey("share:def456");
 *
 * // Retrieve keys by ID
 * const jwk1 = keyProvider.getJWK(keyId1);
 * const did1 = await keyProvider.getDID(keyId1);
 *
 * // List all keys
 * console.log(keyProvider.listKeys()); // ["share:abc123", "share:def456"]
 * ```
 */
export class WasmKeyProvider implements KeyProvider {
  /** The WASM session manager instance */
  private sessionManager?: TCWSessionManager;

  /** Promise that resolves when initialization is complete */
  private initPromise?: Promise<void>;

  /**
   * Create a new WasmKeyProvider.
   *
   * @param config - Optional configuration with session manager
   */
  constructor(config: WasmKeyProviderConfig = {}) {
    if (config.sessionManager) {
      this.sessionManager = config.sessionManager;
    }
  }

  /**
   * Ensure the session manager is initialized.
   * Creates a new one if not provided in config.
   */
  private async ensureInitialized(): Promise<TCWSessionManager> {
    if (this.sessionManager) {
      return this.sessionManager;
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        await initialized;
        this.sessionManager = new tcwSession.TCWSessionManager();
      })();
    }

    await this.initPromise;
    return this.sessionManager!;
  }

  /**
   * Generate a new session key with the given name.
   *
   * This creates a new Ed25519 key pair in the WASM session manager.
   * The key can then be used for signing delegations in sharing links.
   *
   * @param name - A unique name/ID for the key (e.g., "share:timestamp:random")
   * @returns The key ID (same as the name provided)
   */
  async createSessionKey(name: string): Promise<string> {
    const manager = await this.ensureInitialized();
    // The WASM session manager's createSessionKey accepts an optional key_id
    // and stores the key internally for later retrieval
    return manager.createSessionKey(name);
  }

  /**
   * Get the JWK (JSON Web Key) for a key.
   *
   * Returns the full JWK including the private key (d parameter),
   * which is required for signing and for embedding in sharing links.
   *
   * @param keyId - The key ID to retrieve
   * @returns The JWK object with public and private key components
   * @throws Error if the key is not found
   */
  getJWK(keyId: string): JWK {
    if (!this.sessionManager) {
      throw new Error("WasmKeyProvider not initialized. Call createSessionKey first.");
    }
    // The WASM session manager returns the JWK as a JSON string
    const jwkJson = this.sessionManager.jwk(keyId);
    if (!jwkJson) {
      throw new Error(`Key not found: ${keyId}`);
    }
    // Parse the JSON string to get the JWK object
    return JSON.parse(jwkJson) as JWK;
  }

  /**
   * Get the DID (Decentralized Identifier) for a key.
   *
   * Returns the did:key format DID derived from the key's public key.
   * The DID can be used as the delegatee in delegations.
   *
   * @param keyId - The key ID to get the DID for
   * @returns The did:key formatted DID string
   * @throws Error if the key is not found
   */
  async getDID(keyId: string): Promise<string> {
    const manager = await this.ensureInitialized();
    // The WASM session manager has a synchronous getDID method
    return manager.getDID(keyId);
  }

  /**
   * List all session keys currently held by the provider.
   *
   * @returns Array of key IDs
   */
  listKeys(): string[] {
    if (!this.sessionManager) {
      return [];
    }
    const keys = this.sessionManager.listSessionKeys();
    return Array.isArray(keys) ? keys : [];
  }

  /**
   * Check if a key exists in the provider.
   *
   * @param keyId - The key ID to check
   * @returns True if the key exists
   */
  hasKey(keyId: string): boolean {
    if (!this.sessionManager) {
      return false;
    }
    const jwk = this.sessionManager.jwk(keyId);
    return jwk !== undefined;
  }
}

/**
 * Create a new WasmKeyProvider instance.
 *
 * @param sessionManager - Optional WASM session manager to use
 * @returns A new WasmKeyProvider instance
 */
export function createWasmKeyProvider(sessionManager?: TCWSessionManager): WasmKeyProvider {
  return new WasmKeyProvider({ sessionManager });
}
