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
  makeNamespaceId,
  ensureEip55,
  signEthereumMessage,
  initPanicHook,
  exportKeyAsBase64,
  importKeyFromBase64,
  importKeyFromEnvValue,
} from "../../../node-sdk-wasm/tinycloud_web_sdk_rs.js";
