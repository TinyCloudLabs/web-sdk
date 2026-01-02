/**
 * @tinycloudlabs/sdk-core
 *
 * Core TinyCloud SDK package providing shared interfaces and the TinyCloud class.
 *
 * This package defines the platform-agnostic interfaces that both web-sdk and node-sdk
 * implement. The main TinyCloud class accepts an IUserAuthorization implementation,
 * allowing it to work in both browser and Node.js environments.
 *
 * @packageDocumentation
 */

// Signer interface
export { ISigner, Bytes } from "./signer";

// Session storage interface
export {
  ISessionStorage,
  PersistedSessionData,
} from "./storage";

// User authorization interface and types
export {
  IUserAuthorization,
  TCWExtension,
  TCWEnsData,
  TCWClientSession,
  SiweConfig,
  PartialSiweMessage,
  SiweMessage,
  UserAuthorizationConfig,
} from "./userAuthorization";

// Storage interface and types
export {
  ITinyCloudStorage,
  TinyCloudStorageConfig,
  StorageBaseOptions,
  StorageGetOptions,
  StoragePutOptions,
  StorageDeleteOptions,
  StorageListOptions,
  StorageResponse,
  DelegateParams,
  DelegateResponse,
} from "./tinycloudStorage";

// Main TinyCloud class
export {
  TinyCloud,
  TinyCloudConfig,
  StorageFactory,
} from "./TinyCloud";
