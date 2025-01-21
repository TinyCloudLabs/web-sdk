/* eslint-disable no-shadow */
import { ssxSession } from '@spruceid/ssx-sdk-wasm';
import { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import {
  TCWEnsData,
  TCWEnsResolveOptions,
  TCWRPCProvider,
  TCWServerRoutes,
} from '../types';

/** Core config for TCW. */
export interface TCWClientConfig {
  /** Connection to a cryptographic keypair and/or network. */
  providers?: TCWClientProviders;
  /** Optional session configuration for the SIWE message. */
  siweConfig?: SiweConfig;
  /** Whether or not ENS resolution is enabled. True means resolve all on client. */
  resolveEns?: boolean | TCWEnsConfig;
}

/** Representation of an active TCWSession. */
export type TCWClientSession = {
  /** User address */
  address: string;
  /** User address without delegation */
  walletAddress: string;
  chainId: number;
  /** Key to identify the session */
  sessionKey: string;
  /** The message that can be obtained by SiweMessage.prepareMessage() */
  siwe: string;
  /** The signature of the siwe message */
  signature: string;
  /** ENS data supported by TCW */
  ens?: TCWEnsData;
};

/** The URL of the server running tcw-server. Providing this field enables SIWE server communication */
export type TCWServerHost = string;

/** The tcw-powered server configuration settings */
export type TCWProviderServer = {
  host: TCWServerHost;
  /** Optional configuration for the server's routes. */
  routes?: TCWServerRoutes;
};

/** Web3 provider configuration settings */
export interface TCWProviderWeb3 {
  /**
   * window.ethereum for Metamask;
   * web3modal.connect() for Web3Modal;
   * const signer = useSigner(); const provider = signer.provider; from Wagmi for Rainbowkit
   * */
  driver: any;
}

/** TCW web3 configuration settings */
export interface TCWClientProviders {
  /** Web3 wallet provider */
  web3?: TCWProviderWeb3;
  /** JSON RPC provider configurations */
  rpc?: TCWRPCProvider;
  /** Optional reference to server running tcw-server.
   * Providing this field enables communication with tcw-server */
  server?: TCWProviderServer;
}

/** Optional session configuration for the SIWE message. */
export interface SiweConfig extends Partial<ssxSession.SiweConfig> {}

/** Extra SIWE fields. */
export type ExtraFields = ssxSession.ExtraFields;

/** Overrides for the session configuration. */
export type ConfigOverrides = {
  siwe?: SiweConfig;
};

/** ENS options supported by TCW. */
export interface TCWEnsConfig {
  /** Enable the ENS resolution on server instead of on client. */
  resolveOnServer?: boolean;
  /** ENS resolution options. True means resolve all. */
  resolve: TCWEnsResolveOptions;
}

/** Interface to an intermediate TCW state: connected, but not signed-in. */
export interface ITCWConnected {
  /** Instance of SSXSessionManager. */
  builder: ssxSession.SSXSessionManager;
  /** TCWConfig object. */
  config: TCWClientConfig;
  /** List of enabled extensions. */
  extensions: TCWExtension[];
  /** Web3 provider. */
  provider: ethers.providers.Web3Provider;
  /** Promise that is initialized on construction to run the "afterConnect" methods of extensions. */
  afterConnectHooksPromise: Promise<void>;
  /** Method to verify if extension is enabled. */
  isExtensionEnabled: (namespace: string) => boolean;
  /** Axios instance. */
  api?: AxiosInstance;
  /** Method to apply the "afterConnect" methods and the delegated capabilities of the extensions. */
  applyExtensions: () => Promise<void>;
  /** Method to apply the "afterSignIn" methods of the extensions. */
  afterSignIn: (session: TCWClientSession) => Promise<void>;
  /** Method to request nonce from server. */
  tcwServerNonce: (params: Record<string, any>) => Promise<string>;
  /** Method to request sign in from server and return session. */
  tcwServerLogin: (session: TCWClientSession) => Promise<any>;
  /** Method to request the user to sign in. */
  signIn: () => Promise<TCWClientSession>;
  /** Method to request the user to sign out. */
  signOut: (session: TCWClientSession) => Promise<void>;
}

/** Interface for an extension to TCW. */
export interface TCWExtension {
  /** [recap] Capability namespace. */
  namespace?: string;
  /** [recap] Default delegated actions in capability namespace. */
  defaultActions?(): Promise<string[]>;
  /** [recap] Delegated actions by target in capability namespace. */
  targetedActions?(): Promise<{ [target: string]: string[] }>;
  /** [recap] Extra metadata to help validate the capability. */
  extraFields?(): Promise<ExtraFields>;
  /** Hook to run after TCW has connected to the user's wallet.
   * This can return an object literal to override the session configuration before the user
   * signs in. */
  afterConnect?(tcw: ITCWConnected): Promise<ConfigOverrides>;
  /** Hook to run after TCW has signed in. */
  afterSignIn?(session: TCWClientSession): Promise<void>;
}
