/* eslint-disable no-shadow */
import { tcwSession } from '@tinycloudlabs/web-sdk-wasm';
import { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import {
  EnsData,
  RPCProvider,
  ServerRoutes,
} from '../types';

/** Core config for TCW. */
export interface ClientConfig {
  /** Connection to a cryptographic keypair and/or network. */
  providers?: ClientProviders;
  /** Optional session configuration for the SIWE message. */
  siweConfig?: SiweConfig;
  /** Whether or not ENS resolution is enabled. True means resolve all on client. */
  resolveEns?: boolean;
}

/** Representation of an active TCWSession. */
export type ClientSession = {
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
  ens?: EnsData;
};

/** The URL of the server running tcw-server. Providing this field enables SIWE server communication */
export type ServerHost = string;

/** The tcw-powered server configuration settings */
export type ProviderServer = {
  host: ServerHost;
  /** Optional configuration for the server's routes. */
  routes?: ServerRoutes;
};

/** Web3 provider configuration settings */
export interface ProviderWeb3 {
  /**
   * window.ethereum for Metamask;
   * web3modal.connect() for Web3Modal;
   * const signer = useSigner(); const provider = signer.provider; from Wagmi for Rainbowkit
   * */
  driver: any;
}

/** TCW web3 configuration settings */
export interface ClientProviders {
  /** Web3 wallet provider */
  web3?: ProviderWeb3;
  /** JSON RPC provider configurations */
  rpc?: RPCProvider;
  /** Optional reference to server running tcw-server.
   * Providing this field enables communication with tcw-server */
  server?: ProviderServer;
}

/** Optional session configuration for the SIWE message. */
export interface SiweConfig extends Partial<tcwSession.SiweConfig> {}

/** Extra SIWE fields. */
export type ExtraFields = tcwSession.ExtraFields;

/** Overrides for the session configuration. */
export type ConfigOverrides = {
  siwe?: SiweConfig;
};


/** Interface to an intermediate TCW state: connected, but not signed-in. */
export interface IConnected {
  /** Instance of TCWSessionManager. */
  builder: tcwSession.TCWSessionManager;
  /** TCWConfig object. */
  config: ClientConfig;
  /** List of enabled extensions. */
  extensions: Extension[];
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
  afterSignIn: (session: ClientSession) => Promise<void>;
  /** Method to request the user to sign in. */
  signIn: () => Promise<ClientSession>;
  /** Method to request the user to sign out. */
  signOut: (session: ClientSession) => Promise<void>;
}

/** Interface for an extension to TCW. */
export interface Extension {
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
  afterConnect?(tcw: IConnected): Promise<ConfigOverrides>;
  /** Hook to run after TCW has signed in. */
  afterSignIn?(session: ClientSession): Promise<void>;
}
