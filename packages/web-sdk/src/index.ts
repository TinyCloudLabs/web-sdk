export * from './modules/tcw';
export * from './modules';
export * from './notifications';
export * from '@tinycloudlabs/web-core/client';
export * from '@tinycloudlabs/web-core';
export {
  /** @deprecated use TCWClientConfig field instead */
  TCWClientConfig as TCWConfig,
  /** @deprecated use TCWClientProviders field instead */
  TCWClientProviders as TCWProviders,
  /** @deprecated use TCWClientSession field instead */
  TCWClientSession as TCWSession,
} from '@tinycloudlabs/web-core/client';
export { SiweMessage } from 'siwe';

// Re-export sdk-core interfaces for platform-agnostic code
export {
  TinyCloud,
  ISigner,
  ISessionStorage,
  IUserAuthorization as ICoreUserAuthorization,
  PersistedSessionData,
  SiweConfig,
  PartialSiweMessage,
} from '@tinycloudlabs/sdk-core';

// Re-export KV service types for direct usage
export {
  IKVService,
  KVService,
  KVResponse,
} from '@tinycloudlabs/sdk-core';

// Adapter for web-sdk
export { createKVService } from './modules/Storage/tinycloud/KVServiceAdapter';
