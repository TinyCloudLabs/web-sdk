import { providers } from 'ethers';
import { ConnectionInfo } from 'ethers/lib/utils';
import { TCWClientSession } from './client';
import type { AxiosRequestConfig } from 'axios';

/** TCW Route Configuration
 *  This configuration is used to override the default endpoint paths.
 * The config options here are a subset of the
 * [AxiosRequestConfig](https://axios-http.com/docs/req_config).
 * This type does not explicitly extend AxiosRequestConfig,
 * but those options are supported by the client.
 */
export interface TCWRouteConfig {
  /** Endpoint path. */
  url?: string;
  /** Endpoint request method. */
  method?: 'get' | 'post' | 'put' | 'delete';
  /** Custom Operation.
   * Replace the tcw function called with a function of your own
   **/
  customAPIOperation?(
    params: TCWClientSession | Record<string, any> | any
  ): Promise<any>;
}

export interface TCWServerMiddlewareConfig {
  path: string;
  callback?: (req: any, body?: Record<string, any>) => Promise<void> | void;
}

/** Type-Guard for TCWServerMiddlewareConfig. */
export const isTCWServerMiddlewareConfig = (
  config: TCWServerRouteEndpointType
): config is TCWServerMiddlewareConfig =>
  (config as TCWServerMiddlewareConfig)?.path !== undefined;

export type TCWServerRouteEndpointType =
  | Partial<TCWRouteConfig>
  | AxiosRequestConfig
  | string
  | TCWServerMiddlewareConfig;

/** Server endpoints configuration. */
export interface TCWServerRoutes {
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce?: TCWServerRouteEndpointType;
  /** Post login endpoint path. /tcw-login as default. */
  login?: TCWServerRouteEndpointType;
  /** Post logout endpoint path. /tcw-logout as default. */
  logout?: TCWServerRouteEndpointType;
}

/** Server endpoints name configuration. */
export interface TCWServerRouteNames {
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce?: string;
  /** Post login endpoint path. /tcw-login as default. */
  login?: string;
  /** Post logout endpoint path. /tcw-logout as default. */
  logout?: string;
}

/** Supported provider types. */
export type TCWRPCProvider =
  | TCWGenericProvider
  | TCWEtherscanProvider
  | TCWInfuraProvider
  | TCWAlchemyProvider
  | TCWCloudflareProvider
  | TCWPocketProvider
  | TCWAnkrProvider
  | TCWCustomProvider;

/** Enum of supported EthersJS providers. */
export enum TCWRPCProviders {
  TCWAlchemyProvider = 'alchemy',
  TCWAnkrProvider = 'ankr',
  TCWCloudflareProvider = 'cloudflare',
  TCWCustomProvider = 'custom',
  TCWEtherscanProvider = 'etherscan',
  TCWInfuraProvider = 'infura',
  TCWPocketProvider = 'pocket',
}

/** Enum of supported networks for Etherscan. */
export enum TCWEtherscanProviderNetworks {
  MAINNET = 'homestead',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
  GOERLI = 'goerli',
  KOVAN = 'kovan',
}

/** Etherscan provider settings. */
export type TCWEtherscanProvider = {
  service: TCWRPCProviders.TCWEtherscanProvider;
  apiKey?: string;
  network?: TCWEtherscanProviderNetworks;
};

/* Type-Guard for TCWEtherScanProvider. */
export const isTCWEtherscanProvider = (
  provider: TCWRPCProvider
): provider is TCWEtherscanProvider =>
  provider.service === TCWRPCProviders.TCWEtherscanProvider;

/** Enum of supported networks for Infura. */
export enum TCWInfuraProviderNetworks {
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
export type TCWInfuraProviderProjectSettings = {
  projectId: string;
  projectSecret: string;
};

/** Infura provider settings. */
export type TCWInfuraProvider = {
  service: TCWRPCProviders.TCWInfuraProvider;
  apiKey: string | TCWInfuraProviderProjectSettings;
  network?: TCWInfuraProviderNetworks;
};

/* Type-Guard for TCWInfuraProvider. */
export const isTCWInfuraProvider = (
  provider: TCWRPCProvider
): provider is TCWInfuraProvider =>
  provider.service === TCWRPCProviders.TCWInfuraProvider;

/** Enum of supported networks for Alchemy. */
export enum TCWAlchemyProviderNetworks {
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
export type TCWAlchemyProvider = {
  service: TCWRPCProviders.TCWAlchemyProvider;
  apiKey?: string;
  network?: TCWAlchemyProviderNetworks;
};

/* Type-Guard for TCWAlchemyProvider. */
export const isTCWAlchemyProvider = (
  provider: TCWRPCProvider
): provider is TCWAlchemyProvider =>
  provider.service === TCWRPCProviders.TCWAlchemyProvider;

/** Cloudflare provider settings. */
export type TCWCloudflareProvider = {
  service: TCWRPCProviders.TCWCloudflareProvider;
};

/* Type-Guard for TCWCloudflareProvider. */
export const isTCWCloudflareProvider = (
  provider: TCWRPCProvider
): provider is TCWCloudflareProvider =>
  provider.service === TCWRPCProviders.TCWCloudflareProvider;

/** Enum of supported networks for Pocket. */
export enum TCWPocketProviderNetworks {
  MAINNET = 'homestead',
  ROPSTEN = 'ropsten',
  RINKEBY = 'rinkeby',
  GOERLI = 'goerli',
}

/** Pocket provider settings. */
export type TCWPocketProvider = {
  service: TCWRPCProviders.TCWPocketProvider;
  apiKey?: string;
  network?: TCWPocketProviderNetworks;
};

/** Type-Guard for TCWPocketProvider. */
export const isTCWPocketProvider = (
  provider: TCWRPCProvider
): provider is TCWPocketProvider =>
  provider.service === TCWRPCProviders.TCWPocketProvider;

/** Enum of supported networks for Ankr. */
export enum TCWAnkrProviderNetworks {
  MAINNET = 'homestead',
  POLYGON = 'matic',
  ARBITRUM = 'arbitrum',
}

/** Ankr provider settings. */
export type TCWAnkrProvider = {
  service: TCWRPCProviders.TCWAnkrProvider;
  apiKey?: string;
  network?: TCWAnkrProviderNetworks;
};

/** Type-Guard for TCWAnkrProvider. */
export const isTCWAnkrProvider = (
  provider: TCWRPCProvider
): provider is TCWAnkrProvider =>
  provider.service === TCWRPCProviders.TCWAnkrProvider;

/** Custom provider settings. */
export type TCWCustomProvider = {
  service: TCWRPCProviders.TCWCustomProvider;
  url?: string | ConnectionInfo;
  network?: providers.Networkish;
};

/** Type-Guard for TCWCustomProvider. */
export const isTCWCustomProvider = (
  provider: TCWRPCProvider
): provider is TCWCustomProvider =>
  provider.service === TCWRPCProviders.TCWCustomProvider;

/** Generic provider settings. */
export type TCWGenericProvider = {
  service: TCWRPCProviders;
  url?: string | ConnectionInfo;
  network?: providers.Networkish;
  apiKey?: string | TCWInfuraProviderProjectSettings;
};

/** ENS data supported by TCW. */
export interface TCWEnsData {
  /** ENS name/domain. */
  domain?: string | null;
  /** ENS avatar. */
  avatarUrl?: string | null;
}
