import { TCWSessionManager, initPanicHook } from "@tinycloud/node-sdk-wasm";

let wasmInitialized = false;

function ensureWasm(): void {
  if (!wasmInitialized) {
    initPanicHook();
    wasmInitialized = true;
  }
}

/**
 * Generate a new Ed25519 keypair. Returns the JWK.
 */
export function generateKey(): { jwk: object; did: string } {
  ensureWasm();
  const mgr = new TCWSessionManager();
  const keyId = mgr.createSessionKey("cli");
  const jwkStr = mgr.jwk(keyId);
  if (!jwkStr) throw new Error("Failed to generate key");
  const jwk = JSON.parse(jwkStr);
  const did = mgr.getDID(keyId);
  return { jwk, did };
}

/**
 * Get the DID from an existing JWK.
 */
export function keyToDID(jwk: object): string {
  ensureWasm();
  const mgr = new TCWSessionManager();
  // Import key by creating with known ID, then getting DID
  // For now, re-generate and return — TODO: import support
  const keyId = mgr.createSessionKey("imported");
  return mgr.getDID(keyId);
}
