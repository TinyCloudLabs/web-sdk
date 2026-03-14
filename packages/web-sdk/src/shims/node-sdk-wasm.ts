/**
 * Browser shim for @tinycloud/node-sdk-wasm.
 *
 * Maps the node-sdk-wasm API surface to the browser's web-sdk-wasm,
 * allowing TinyCloudNode (which imports from @tinycloud/node-sdk-wasm)
 * to run in browser builds via a webpack alias.
 *
 * IMPORTANT: WASM must be initialized (via WasmInitializer.ensureInitialized())
 * before any of these functions are called. The web-sdk-wasm module starts
 * initialization on import, but completion is async.
 */

import { tinycloud, tcwSession, initialized } from "@tinycloud/web-sdk-wasm";
import { invoke as webInvoke, prepareSession as webPrepareSession, completeSessionSetup as webCompleteSessionSetup } from "../modules/Storage/tinycloud/module";

// Re-export TCWSessionManager from web-sdk-wasm
export const TCWSessionManager = tcwSession.TCWSessionManager;

// Use the lazy-loading wrappers from module.ts (access global.tinycloudModule)
// These are safe to call after WasmInitializer.ensureInitialized()
export const invoke = webInvoke;
export const prepareSession = webPrepareSession;
export const completeSessionSetup = webCompleteSessionSetup;

// Direct re-exports from tinycloud namespace
export const makeSpaceId = (address: string, chainId: number, prefix: string) =>
  tinycloud.makeSpaceId(address, chainId, prefix);
export const ensureEip55 = (address: string) =>
  tinycloud.ensureEip55(address);
export const createDelegation = (
  session: any, delegateDID: string, spaceId: string,
  path: string, actions: string[], expirationSecs: number, notBeforeSecs?: number
) => tinycloud.createDelegation(session, delegateDID, spaceId, path, actions, expirationSecs, notBeforeSecs);
export const generateHostSIWEMessage = (params: any) =>
  tinycloud.generateHostSIWEMessage(params);
export const siweToDelegationHeaders = (params: any) =>
  tinycloud.siweToDelegationHeaders(params);
export const protocolVersion = () => tinycloud.protocolVersion();

// initPanicHook is a no-op in browser — already handled by web-sdk-wasm initialization
export const initPanicHook = () => {};

// Vault crypto functions
export const vault_encrypt = (key: Uint8Array, plaintext: Uint8Array) =>
  tinycloud.vault_encrypt(key, plaintext);
export const vault_decrypt = (key: Uint8Array, blob: Uint8Array) =>
  tinycloud.vault_decrypt(key, blob);
export const vault_derive_key = (salt: Uint8Array, signature: Uint8Array, info: Uint8Array) =>
  tinycloud.vault_derive_key(salt, signature, info);
export const vault_x25519_from_seed = (seed: Uint8Array) =>
  tinycloud.vault_x25519_from_seed(seed);
export const vault_x25519_dh = (privateKey: Uint8Array, publicKey: Uint8Array) =>
  tinycloud.vault_x25519_dh(privateKey, publicKey);
export const vault_random_bytes = (length: number) =>
  tinycloud.vault_random_bytes(length);
export const vault_sha256 = (data: Uint8Array) =>
  tinycloud.vault_sha256(data);

// Key management exports (used by node-sdk's WasmKeyProvider)
export const signEthereumMessage = (...args: any[]) =>
  (tinycloud as any).signEthereumMessage?.(...args);
export const signSecp256k1 = (...args: any[]) =>
  (tinycloud as any).signSecp256k1?.(...args);
export const exportKey = (...args: any[]) =>
  (tinycloud as any).exportKey?.(...args);
export const importKey = (...args: any[]) =>
  (tinycloud as any).importKey?.(...args);
export const importKeyFromEnvValue = (...args: any[]) =>
  (tinycloud as any).importKeyFromEnvValue?.(...args);
