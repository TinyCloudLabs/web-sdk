import { providers } from 'ethers';
import { ConnectionInfo } from 'ethers/lib/utils';
import { ClientSession } from './client';
import type { AxiosRequestConfig } from 'axios';

/** TCW Route Configuration
 *  This configuration is used to override the default endpoint paths.
 * The config options here are a subset of the
 * [AxiosRequestConfig](https://axios-http.com/docs/req_config).
 * This type does not explicitly extend AxiosRequestConfig,
 * but those options are supported by the client.
 */
export interface RouteConfig {
  /** Endpoint path. */
  url?: string;
  /** Endpoint request method. */
  method?: 'get' | 'post' | 'put' | 'delete';
  /** Custom Operation.
   * Replace the tcw function called with a function of your own
   **/
  customAPIOperation?(
    params: ClientSession | Record<string, any> | any
  ): Promise<any>;
}

export interface ServerMiddlewareConfig {
  path: string;
  callback?: (req: any, body?: Record<string, any>) => Promise<void> | void;
}

/** Type-Guard for ServerMiddlewareConfig. */
export const isServerMiddlewareConfig = (
  config: ServerRouteEndpointType
): config is ServerMiddlewareConfig =>
  (config as ServerMiddlewareConfig)?.path !== undefined;

export type ServerRouteEndpointType =
  | Partial<RouteConfig>
  | AxiosRequestConfig
  | string
  | ServerMiddlewareConfig;

/** Server endpoints configuration. */
export interface ServerRoutes {
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce?: ServerRouteEndpointType;
  /** Post login endpoint path. /tcw-login as default. */
  login?: ServerRouteEndpointType;
  /** Post logout endpoint path. /tcw-logout as default. */
  logout?: ServerRouteEndpointType;
}

/** Server endpoints name configuration. */
export interface ServerRouteNames {
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce?: string;
  /** Post login endpoint path. /tcw-login as default. */
  login?: string;
  /** Post logout endpoint path. /tcw-logout as default. */
  logout?: string;
}

/** Supported provider types. */
export type RPCProvider =
  | GenericProvider
  | EtherscanProvider
  | InfuraProvider
  | AlchemyProvider
  | CloudflareProvider
  | PocketProvider
  | AnkrProvider
  | CustomProvider;

/** Enum of supported EthersJS providers. */
export enum RPCProviders {
  AlchemyProvider = 'alchemy',
  AnkrProvider = 'ankr',
  CloudflareProvider = 'cloudflare',
  CustomProvider = 'custom',
  EtherscanProvider = 'etherscan',
  InfuraProvider = 'infura',
  PocketProvider = 'pocket',
}

/** Enum of supported networks for Etherscan. */
export enum EtherscanProviderNetworks {
  MAINNET = 'homestead',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
  GOERLI = 'goerli',
  KOVAN = 'kovan',
}

/** Etherscan provider settings. */
export type EtherscanProvider = {
  service: RPCProviders.EtherscanProvider;
  apiKey?: string;
  network?: EtherscanProviderNetworks;
};

/* Type-Guard for TCWEtherScanProvider. */
export const isEtherscanProvider = (
  provider: RPCProvider
): provider is EtherscanProvider =>
  provider.service === RPCProviders.EtherscanProvider;

/** Enum of supported networks for Infura. */
export enum InfuraProviderNetworks {
  MAINNET = 'homestead',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
  GOERLI = 'goerli',
  KOVAN = 'kovan',
  POLYGON = 'matic',
  POLYGON_MUMBAI = 'maticmum',
  OPTIMISM = 'optimism',
  OPTIMISM_KOVAN = 'optimism-kovan',
  ARBITRUM = 'arbitrum',
  ARBITRUM_RINKEBY = 'arbitrum-rinkeby',
}

/** Infura provider project settings. */
export type InfuraProviderProjectSettings = {
  projectId: string;
  projectSecret: string;
};

/** Infura provider settings. */
export type InfuraProvider = {
  service: RPCProviders.InfuraProvider;
  apiKey: string | InfuraProviderProjectSettings;
  network?: InfuraProviderNetworks;
};

/* Type-Guard for InfuraProvider. */
export const isInfuraProvider = (
  provider: RPCProvider
): provider is InfuraProvider =>
  provider.service === RPCProviders.InfuraProvider;

/** Enum of supported networks for Alchemy. */
export enum AlchemyProviderNetworks {
  MAINNET = 'homestead',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
  GOERLI = 'goerli',
  KOVAN = 'kovan',
  POLYGON = 'matic',
  POLYGON_MUMBAI = 'maticmum',
  OPTIMISM = 'optimism',
  OPTIMISM_KOVAN = 'optimism-kovan',
  ARBITRUM = 'arbitrum',
  ARBITRUM_RINKEBY = 'arbitrum-rinkeby',
}

/** Alchemy provider settings. */
export type AlchemyProvider = {
  service: RPCProviders.AlchemyProvider;
  apiKey?: string;
  network?: AlchemyProviderNetworks;
};

/* Type-Guard for AlchemyProvider. */
export const isAlchemyProvider = (
  provider: RPCProvider
): provider is AlchemyProvider =>
  provider.service === RPCProviders.AlchemyProvider;

/** Cloudflare provider settings. */
export type CloudflareProvider = {
  service: RPCProviders.CloudflareProvider;
};

/* Type-Guard for CloudflareProvider. */
export const isCloudflareProvider = (
  provider: RPCProvider
): provider is CloudflareProvider =>
  provider.service === RPCProviders.CloudflareProvider;

/** Enum of supported networks for Pocket. */
export enum PocketProviderNetworks {
  MAINNET = 'homestead',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
  GOERLI = 'goerli',
}

/** Pocket provider settings. */
export type PocketProvider = {
  service: RPCProviders.PocketProvider;
  apiKey?: string;
  network?: PocketProviderNetworks;
};

/** Type-Guard for PocketProvider. */
export const isPocketProvider = (
  provider: RPCProvider
): provider is PocketProvider =>
  provider.service === RPCProviders.PocketProvider;

/** Enum of supported networks for Ankr. */
export enum AnkrProviderNetworks {
  MAINNET = 'homestead',
  POLYGON = 'matic',
  ARBITRUM = 'arbitrum',
}

/** Ankr provider settings. */
export type AnkrProvider = {
  service: RPCProviders.AnkrProvider;
  apiKey?: string;
  network?: AnkrProviderNetworks;
};

/** Type-Guard for AnkrProvider. */
export const isAnkrProvider = (
  provider: RPCProvider
): provider is AnkrProvider =>
  provider.service === RPCProviders.AnkrProvider;

/** Custom provider settings. */
export type CustomProvider = {
  service: RPCProviders.CustomProvider;
  url?: string | ConnectionInfo;
  network?: providers.Networkish;
};

/** Type-Guard for CustomProvider. */
export const isCustomProvider = (
  provider: RPCProvider
): provider is CustomProvider =>
  provider.service === RPCProviders.CustomProvider;

/** Generic provider settings. */
export type GenericProvider = {
  service: RPCProviders;
  url?: string | ConnectionInfo;
  network?: providers.Networkish;
  apiKey?: string | InfuraProviderProjectSettings;
};

/** ENS data supported by TCW. */
export interface EnsData {
  /** ENS name/domain. */
  domain?: string | null;
  /** ENS avatar. */
  avatarUrl?: string | null;
}
