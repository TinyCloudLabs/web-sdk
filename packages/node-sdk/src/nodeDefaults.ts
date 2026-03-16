/**
 * Node.js-specific defaults registration.
 *
 * Importing this module registers NodeWasmBindings and PrivateKeySigner
 * as default factories on TinyCloudNode, so Node.js users get the same
 * zero-config experience (e.g., `new TinyCloudNode({ privateKey: '...' })`).
 *
 * The main entry point (index.ts) imports this for side effects.
 * The /core entry point does NOT import this, keeping it free of
 * @tinycloud/node-sdk-wasm dependencies for browser bundling.
 *
 * @packageDocumentation
 */

import { NodeWasmBindings } from "./NodeWasmBindings";
import { PrivateKeySigner } from "./signers/PrivateKeySigner";
import { TinyCloudNode } from "./TinyCloudNode";

TinyCloudNode.registerNodeDefaults({
  createWasmBindings: () => new NodeWasmBindings(),
  createSigner: (privateKey: string, chainId?: number) => new PrivateKeySigner(privateKey, chainId),
});
