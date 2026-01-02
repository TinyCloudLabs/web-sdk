/**
 * TinyCloud Node.js SDK - WASM bindings
 *
 * This package provides the TinyCloud SDK for Node.js environments.
 * It includes session management, key management, and Ethereum signing capabilities.
 *
 * @packageDocumentation
 */

// Import from wasm-pack nodejs output (CommonJS, auto-initializes synchronously)
// @ts-ignore - wasm-pack generates this file
import * as wasm from "../../web-sdk-rs/pkg-nodejs/tinycloud_web_sdk_rs.js";

// Re-export the session manager
export const TCWSessionManager = wasm.TCWSessionManager;
export type TCWSessionManager = InstanceType<typeof wasm.TCWSessionManager>;

// Re-export initialization
export const initPanicHook = wasm.initPanicHook;

// Re-export tinycloud-sdk-wasm functions
export const invoke = wasm.invoke;
export const prepareSession = wasm.prepareSession;
export const completeSessionSetup = wasm.completeSessionSetup;
export const ensureEip55 = wasm.ensureEip55;
export const makeNamespaceId = wasm.makeNamespaceId;
export const generateHostSIWEMessage = wasm.generateHostSIWEMessage;
export const siweToDelegationHeaders = wasm.siweToDelegationHeaders;

// Node.js specific: Key management functions
export const importKeyFromBase64 = wasm.importKeyFromBase64;
export const exportKeyAsBase64 = wasm.exportKeyAsBase64;
export const importKeyFromEnvValue = wasm.importKeyFromEnvValue;
export const signSecp256k1 = wasm.signSecp256k1;
export const signEthereumMessage = wasm.signEthereumMessage;

/**
 * Load a key from an environment variable.
 *
 * The environment variable should contain a base64-encoded JWK.
 *
 * @param manager - The session manager to import the key into
 * @param envVarName - The name of the environment variable
 * @param keyId - Optional key ID (defaults to "default")
 * @returns The key ID of the imported key
 * @throws Error if the environment variable is not set
 *
 * @example
 * ```ts
 * const manager = new TCWSessionManager();
 * loadKeyFromEnv(manager, "TINYCLOUD_PRIVATE_KEY", "my-key");
 * ```
 */
export function loadKeyFromEnv(
  manager: TCWSessionManager,
  envVarName: string,
  keyId?: string
): string {
  const envValue = process.env[envVarName];
  if (!envValue) {
    throw new Error(`Environment variable ${envVarName} is not set`);
  }
  return wasm.importKeyFromEnvValue(manager, envValue, keyId);
}

// Type definitions for better TypeScript support
export interface SessionConfig {
  /** Actions that the session key will be permitted to perform, organized by service and path */
  abilities: { [service: string]: { [key: string]: string[] } };
  /** Ethereum address */
  address: string;
  /** Chain ID */
  chainId: number;
  /** Domain of the application */
  domain: string;
  /** Current time for SIWE message (ISO 8601) */
  issuedAt: string;
  /** The namespace that is the target resource of the delegation */
  namespaceId: string;
  /** The earliest time that the session will be valid from (ISO 8601) */
  notBefore?: string;
  /** The latest time that the session will be valid until (ISO 8601) */
  expirationTime: string;
  /** Optional parent delegations to inherit and attenuate */
  parents?: string[];
  /** Optional JWK to delegate to */
  jwk?: object;
}

export interface Session {
  /** The delegation from the user to the session key */
  delegationHeader: { Authorization: string };
  /** The delegation reference from the user to the session key */
  delegationCid: string;
  /** The session key */
  jwk: object;
  /** The namespace that the session key is permitted to perform actions against */
  namespaceId: string;
  /** The verification method of the session key */
  verificationMethod: string;
}

export interface HostConfig {
  /** Ethereum address */
  address: string;
  /** Chain ID */
  chainId: number;
  /** Domain of the application */
  domain: string;
  /** Current time for SIWE message (ISO 8601) */
  issuedAt: string;
  /** The namespace that is the target resource of the delegation */
  namespaceId: string;
  /** The peer that is the target/invoker in the delegation */
  peerId: string;
}

export interface SiweConfig {
  /** Ethereum address (EIP-55 checksum) */
  address: string;
  /** EIP-155 Chain ID */
  chainId: number;
  /** RFC 4501 dns authority */
  domain: string;
  /** Randomized token for replay protection */
  nonce?: string;
  /** ISO 8601 datetime string of the current time */
  issuedAt: string;
  /** ISO 8601 datetime string for expiration */
  expirationTime?: string;
  /** ISO 8601 datetime string for when the message becomes valid */
  notBefore?: string;
  /** System-specific identifier for the sign-in request */
  requestId?: string;
  /** List of resources the user wishes to have resolved */
  resources?: string[];
  /** Human-readable assertion that the user will sign */
  statement?: string;
}
