export interface GlobalConfig {
  defaultProfile: string;
  version: number;
}

export interface ProfileConfig {
  name: string;
  host: string;
  chainId: number;
  spaceName: string;
  did: string;
  primaryDid?: string;
  spaceId?: string;
  createdAt: string;
}

export interface CLIContext {
  profile: string;
  host: string;
  verbose: boolean;
  noCache: boolean;
  quiet: boolean;
}
