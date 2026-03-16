export interface GlobalConfig {
  defaultProfile: string;
  version: number;
}

export type AuthMethod = "openkey" | "local";

export interface ProfileConfig {
  name: string;
  host: string;
  chainId: number;
  spaceName: string;
  did: string;
  primaryDid?: string;
  spaceId?: string;
  createdAt: string;
  authMethod?: AuthMethod;
  /** Hex-encoded Ethereum private key (only present when authMethod is "local") */
  privateKey?: string;
  /** Ethereum address derived from privateKey (only present when authMethod is "local") */
  address?: string;
}

export interface CLIContext {
  profile: string;
  host: string;
  verbose: boolean;
  noCache: boolean;
  quiet: boolean;
}
