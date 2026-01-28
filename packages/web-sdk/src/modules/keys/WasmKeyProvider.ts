/**
 * WasmKeyProvider - KeyProvider implementation using WASM session manager.
 *
 * This provider creates new session keys using the WASM session manager from web-sdk-wasm.
 * Each key is created with a fresh TCWSessionManager instance since build() consumes the manager.
 *
 * @packageDocumentation
 */

import type { KeyProvider, JWK } from "@tinycloudlabs/sdk-core";
import {
  initialized,
  tcwSession,
} from "@tinycloudlabs/web-sdk-wasm";

/**
 * KeyProvider implementation for web-sdk using WASM session manager.
 *
 * This allows the SharingService to create new session keys for sharing links
 * using the same cryptographic operations as the main session management.
 *
 * @example
 * ```typescript
 * const keyProvider = new WasmKeyProvider();
 *
 * // Create a session key for a sharing link
 * const keyId = await keyProvider.createSessionKey("share:abc123");
 * const jwk = keyProvider.getJWK(keyId);
 * const did = await keyProvider.getDID(keyId);
 * ```
 */
export class WasmKeyProvider implements KeyProvider {
  /** Map of key IDs to their JWKs */
  private keys: Map<string, JWK> = new Map();

  /**
   * Generate a new session key with the given name.
   *
   * This creates a new Ed25519 key pair using a fresh WASM session manager.
   * The key can then be used for signing delegations in sharing links.
   *
   * @param name - A unique name/ID for the key (e.g., "share:timestamp:random")
   * @returns The key ID (same as the name provided)
   */
  async createSessionKey(name: string): Promise<string> {
    // Ensure WASM is initialized
    await initialized;

    // Create a fresh session manager for this key
    const sessionManager = new tcwSession.TCWSessionManager();

    // Generate the key
    sessionManager.createSessionKey();

    // Get the JWK
    const jwkString = sessionManager.jwk();
    if (!jwkString) {
      throw new Error("Failed to get JWK from session manager");
    }

    // Parse and store the JWK
    const jwk = JSON.parse(jwkString) as JWK;
    this.keys.set(name, jwk);

    return name;
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
    const jwk = this.keys.get(keyId);
    if (!jwk) {
      throw new Error(`Key not found: ${keyId}`);
    }
    return jwk;
  }

  /**
   * Get the DID (Decentralized Identifier) for a key.
   *
   * Returns the did:key format DID derived from the key's public key.
   * The DID is computed from the JWK's public key components.
   *
   * @param keyId - The key ID to get the DID for
   * @returns The did:key formatted DID string
   * @throws Error if the key is not found
   */
  async getDID(keyId: string): Promise<string> {
    const jwk = this.getJWK(keyId);

    // For Ed25519 keys, the DID is derived from the x (public key) value
    // The format is did:key:z6Mk... where the suffix is the multibase-encoded public key
    // We need to use WASM to get the proper DID format
    await initialized;

    // Create a temporary session manager just to derive the DID
    // This is a bit wasteful but ensures we get the correct DID format
    const sessionManager = new tcwSession.TCWSessionManager();
    sessionManager.createSessionKey();

    // Unfortunately, we can't inject a JWK into the session manager
    // So we compute the DID from the JWK manually using the same algorithm

    // For Ed25519 (OKP keys), the DID is did:key:z6Mk{base58-encoded-public-key}
    // The public key is in the 'x' field of the JWK
    if (jwk.kty === "OKP" && jwk.crv === "Ed25519" && jwk.x) {
      // The x value is base64url encoded
      // Convert to multibase multicodec format for did:key
      // Multicodec prefix for Ed25519 public key is 0xed01
      const publicKeyBase64 = jwk.x;

      // Decode base64url to bytes
      const publicKeyBytes = base64UrlToBytes(publicKeyBase64);

      // Create multicodec-prefixed key (0xed, 0x01 for ed25519-pub)
      const multicodecKey = new Uint8Array(2 + publicKeyBytes.length);
      multicodecKey[0] = 0xed;
      multicodecKey[1] = 0x01;
      multicodecKey.set(publicKeyBytes, 2);

      // Encode as base58btc with 'z' prefix (multibase)
      const multibaseKey = "z" + base58btcEncode(multicodecKey);

      return `did:key:${multibaseKey}`;
    }

    throw new Error(`Unsupported key type: ${jwk.kty}/${(jwk as any).crv}`);
  }
}

// Helper: Base64URL to bytes
function base64UrlToBytes(base64url: string): Uint8Array {
  // Convert base64url to base64
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }

  // Decode
  if (typeof atob !== "undefined") {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  } else if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  throw new Error("No base64 decoding available");
}

// Helper: Base58btc encoding (Bitcoin alphabet)
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58btcEncode(bytes: Uint8Array): string {
  const digits = [0];

  for (const byte of bytes) {
    let carry = byte;
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }

  // Convert to string
  let result = "";

  // Handle leading zeros
  for (const byte of bytes) {
    if (byte === 0) {
      result += BASE58_ALPHABET[0];
    } else {
      break;
    }
  }

  // Convert digits to characters (reverse order)
  for (let i = digits.length - 1; i >= 0; i--) {
    result += BASE58_ALPHABET[digits[i]];
  }

  return result;
}
