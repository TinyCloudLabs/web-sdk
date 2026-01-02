/**
 * @tinycloudlabs/node-sdk
 *
 * TinyCloud SDK for Node.js environments.
 *
 * This package provides Node.js-specific implementations of the TinyCloud SDK:
 * - PrivateKeySigner: Sign messages using a private key
 * - NodeUserAuthorization: Authorize users with configurable sign strategies
 * - MemorySessionStorage: Store sessions in memory
 * - FileSessionStorage: Persist sessions to the file system
 *
 * @example
 * ```typescript
 * import { TinyCloud } from '@tinycloudlabs/sdk-core';
 * import {
 *   NodeUserAuthorization,
 *   PrivateKeySigner,
 *   FileSessionStorage,
 * } from '@tinycloudlabs/node-sdk';
 *
 * const signer = new PrivateKeySigner(process.env.PRIVATE_KEY);
 * const auth = new NodeUserAuthorization({
 *   signer,
 *   signStrategy: { type: 'auto-sign' },
 *   domain: 'api.myapp.com',
 *   sessionStorage: new FileSessionStorage('/tmp/sessions'),
 * });
 *
 * const tc = new TinyCloud(auth);
 * await tc.signIn();
 * ```
 *
 * @packageDocumentation
 */

// Re-export core types for convenience
export {
  TinyCloud,
  TinyCloudConfig,
  ISigner,
  ISessionStorage,
  IUserAuthorization,
  ITinyCloudStorage,
  TCWClientSession,
  TCWExtension,
  PersistedSessionData,
} from "@tinycloudlabs/sdk-core";

// Signers
export { PrivateKeySigner } from "./signers/PrivateKeySigner";

// Storage implementations
export { MemorySessionStorage } from "./storage/MemorySessionStorage";
export { FileSessionStorage } from "./storage/FileSessionStorage";

// Authorization
export {
  NodeUserAuthorization,
  NodeUserAuthorizationConfig,
} from "./authorization/NodeUserAuthorization";

// Sign strategies
export {
  SignStrategy,
  SignRequest,
  SignResponse,
  SignCallback,
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
  EventEmitterStrategy,
  defaultSignStrategy,
} from "./authorization/strategies";
