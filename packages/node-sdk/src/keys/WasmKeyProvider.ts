/**
 * WasmKeyProvider - KeyProvider implementation using WASM session manager.
 *
 * This provider wraps the TCWSessionManager from node-sdk-wasm to provide
 * cryptographic key operations required by the SharingService.
 *
 * @packageDocumentation
 */

import type { KeyProvider, JWK } from "@tinycloudlabs/sdk-core";
import type { TCWSessionManager } from "@tinycloudlabs/node-sdk-wasm";

/**
 * Configuration for WasmKeyProvider.
 */
export interface WasmKeyProviderConfig {
  /**
   * The WASM session manager instance.
   * Must be created before constructing the KeyProvider.
   */
  sessionManager: TCWSessionManager;
}

/**
 * KeyProvider implementation that wraps the WASM session manager.
 *
 * This allows the SharingService to create new session keys for sharing links
 * using the same cryptographic operations as the main session management.
 *
 * @example
 * ```typescript
 * import { TCWSessionManager } from "@tinycloudlabs/node-sdk-wasm";
 * import { WasmKeyProvider } from "@tinycloudlabs/node-sdk";
 *
 * const sessionManager = new TCWSessionManager();
 * const keyProvider = new WasmKeyProvider({ sessionManager });
 *
 * // Create a session key for a sharing link
 * const keyId = await keyProvider.createSessionKey("share:abc123");
 * const jwk = keyProvider.getJWK(keyId);
 * const did = await keyProvider.getDID(keyId);
 * ```
 */
export class WasmKeyProvider implements KeyProvider {
  private sessionManager: TCWSessionManager;

  /**
   * Create a new WasmKeyProvider.
   *
   * @param config - Configuration with the WASM session manager
   */
  constructor(config: WasmKeyProviderConfig) {
    this.sessionManager = config.sessionManager;
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
    // The WASM session manager's createSessionKey returns the key_id
    // and stores the key internally
    return this.sessionManager.createSessionKey(name);
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
   * This DID can be used as the delegatee in delegations.
   *
   * @param keyId - The key ID to retrieve
   * @returns The DID in did:key format (e.g., "did:key:z6Mk...")
   */
  async getDID(keyId: string): Promise<string> {
    // The WASM session manager has a synchronous getDID method
    return this.sessionManager.getDID(keyId);
  }

  /**
   * List all session keys currently held by the provider.
   *
   * @returns Array of key IDs
   */
  listKeys(): string[] {
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
    const jwk = this.sessionManager.jwk(keyId);
    return jwk !== undefined;
  }
}

/**
 * Create a new WasmKeyProvider instance.
 *
 * @param sessionManager - The WASM session manager
 * @returns A new WasmKeyProvider instance
 */
export function createWasmKeyProvider(sessionManager: TCWSessionManager): WasmKeyProvider {
  return new WasmKeyProvider({ sessionManager });
}
