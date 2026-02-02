/**
 * @tinycloudlabs/node-sdk-wasm
 *
 * TinyCloud WASM bindings for Node.js environments.
 *
 * @packageDocumentation
 */

// Re-export everything from the Node.js WASM build
export * from "../../../node-sdk-wasm/tinycloud_web_sdk_rs.js";

// Also export common utilities directly for convenience
export {
  TCWSessionManager,
  prepareSession,
  completeSessionSetup,
  invoke,
  makeSpaceId,
  ensureEip55,
  signEthereumMessage,
  signSecp256k1,
  initPanicHook,
  exportKey,
  importKey,
  importKeyFromEnvValue,
  // Space hosting
  generateHostSIWEMessage,
  siweToDelegationHeaders,
  // Delegation creation
  createDelegation,
} from "../../../node-sdk-wasm/tinycloud_web_sdk_rs.js";

// Re-export types for TypeScript consumers
export type {
  HostConfig,
  Session,
  SessionConfig,
  SiweConfig,
} from "../../../node-sdk-wasm/tinycloud_web_sdk_rs.js";

// Note: CreateDelegationWasmParams and CreateDelegationWasmResult types are available
// from @tinycloudlabs/sdk-core for TypeScript consumers
