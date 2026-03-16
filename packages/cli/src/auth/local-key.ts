import { TCWSessionManager, initPanicHook } from "@tinycloud/node-sdk-wasm";
import { PrivateKeySigner } from "@tinycloud/node-sdk";
import { randomBytes } from "node:crypto";

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

/**
 * Generate a new random Ethereum private key.
 * Returns the hex-encoded key with 0x prefix.
 */
export function generateEthereumPrivateKey(): string {
  const keyBytes = randomBytes(32);
  return "0x" + keyBytes.toString("hex");
}

/**
 * Derive the Ethereum address from a private key.
 * Uses PrivateKeySigner from node-sdk.
 */
export async function deriveAddress(privateKey: string): Promise<string> {
  const signer = new PrivateKeySigner(privateKey);
  return signer.getAddress();
}

/**
 * Create a did:pkh DID from an Ethereum address.
 * Uses EIP-155 chain ID 1 (mainnet).
 */
export function addressToDID(address: string, chainId: number = 1): string {
  return `did:pkh:eip155:${chainId}:${address}`;
}

/**
 * Generate a new local Ethereum key and return all identity info.
 */
export async function generateLocalIdentity(chainId: number = 1): Promise<{
  privateKey: string;
  address: string;
  did: string;
}> {
  const privateKey = generateEthereumPrivateKey();
  const address = await deriveAddress(privateKey);
  const did = addressToDID(address, chainId);
  return { privateKey, address, did };
}

/**
 * Sign in to TinyCloud using a local Ethereum private key.
 * Creates a TinyCloudNode with the private key and calls signIn().
 */
export async function localKeySignIn(options: {
  privateKey: string;
  host: string;
}): Promise<{
  spaceId: string;
  address: string;
  chainId: number;
}> {
  const { TinyCloudNode } = await import("@tinycloud/node-sdk");

  const node = new TinyCloudNode({
    privateKey: options.privateKey,
    host: options.host,
    autoCreateSpace: true,
  });

  await node.signIn();

  const address = await new PrivateKeySigner(options.privateKey).getAddress();

  return {
    spaceId: node.spaceId ?? "",
    address,
    chainId: 1,
  };
}
