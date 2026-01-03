import { ISigner } from "./signer";
import { ISessionStorage, PersistedSessionData } from "./storage";

// Re-export types from web-core to ensure type compatibility
// Client types are exported from the /client subpath
export {
  TCWClientSession,
  TCWExtension,
  SiweConfig,
  ConfigOverrides,
} from "@tinycloudlabs/web-core/client";

// Root types (ENS, SiweMessage) are exported from the main entry
export { TCWEnsData, SiweMessage } from "@tinycloudlabs/web-core";

import type {
  TCWClientSession,
  TCWExtension,
  SiweConfig,
} from "@tinycloudlabs/web-core/client";
import type { SiweMessage } from "@tinycloudlabs/web-core";

/**
 * Partial SIWE message for overrides.
 */
export interface PartialSiweMessage extends Partial<SiweConfig> {
  address?: string;
  chainId?: number;
  uri?: string;
  version?: string;
}

/**
 * Platform-agnostic user authorization interface.
 *
 * This interface defines how users authenticate and manage sessions.
 * Implementations differ by platform:
 * - WebUserAuthorization: Browser with wallet popups
 * - NodeUserAuthorization: Node.js with configurable sign strategies
 */
export interface IUserAuthorization {
  /**
   * The current active session, if signed in.
   */
  session?: TCWClientSession;

  /**
   * Add an extension to the authorization flow.
   * Extensions can add capabilities and lifecycle hooks.
   */
  extend(extension: TCWExtension): void;

  /**
   * Sign in and create a new session.
   * This will prompt for wallet signature (browser) or use configured strategy (node).
   * @returns The new session
   */
  signIn(): Promise<TCWClientSession>;

  /**
   * Sign out and clear the current session.
   */
  signOut(): Promise<void>;

  /**
   * Get the current wallet/signer address.
   * @returns Address or undefined if not connected
   */
  address(): string | undefined;

  /**
   * Get the current chain ID.
   * @returns Chain ID or undefined if not connected
   */
  chainId(): number | undefined;

  /**
   * Sign a message with the connected wallet/signer.
   * @param message - Message to sign
   * @returns Signature hex string
   */
  signMessage(message: string): Promise<string>;

  /**
   * Generate a SIWE message for custom signing flows.
   * @param address - Ethereum address
   * @param partial - Optional overrides for the SIWE message
   * @returns SiweMessage ready for signing
   */
  generateSiweMessage(
    address: string,
    partial?: PartialSiweMessage
  ): Promise<SiweMessage>;

  /**
   * Complete sign-in with a pre-signed message.
   * Useful for custom signing flows or external signers.
   * @param siweMessage - The SIWE message that was signed
   * @param signature - The signature
   * @returns The new session
   */
  signInWithSignature(
    siweMessage: SiweMessage,
    signature: string
  ): Promise<TCWClientSession>;

  /**
   * Attempt to resume a previously persisted session.
   * @param address - Ethereum address to resume for
   * @returns The restored session or null if not available
   */
  tryResumeSession(address: string): Promise<TCWClientSession | null>;

  /**
   * Clear persisted session data.
   * @param address - Optional address; if omitted, clears current session
   */
  clearPersistedSession(address?: string): Promise<void>;

  /**
   * Check if a session is persisted for an address.
   * @param address - Ethereum address
   * @returns true if session data exists
   */
  isSessionPersisted(address: string): boolean;
}

/**
 * Configuration for creating a UserAuthorization instance.
 */
export interface UserAuthorizationConfig {
  /** The signer to use for signing */
  signer: ISigner;
  /** Session storage implementation */
  sessionStorage?: ISessionStorage;
  /** Default SIWE configuration */
  siweConfig?: SiweConfig;
  /** Domain for SIWE messages */
  domain?: string;
  /** Extensions to apply */
  extensions?: TCWExtension[];
}
