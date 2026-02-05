/**
 * Zod schemas for TinyCloud Web Core client types.
 *
 * These schemas provide runtime validation for client sessions, configurations,
 * and extension interfaces. Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";
import {
  EnsDataSchema,
  RPCProviderSchema,
  ServerRoutesSchema,
} from "../types.schema.js";

// =============================================================================
// Server Configuration
// =============================================================================

/**
 * The URL of the server running tcw-server.
 */
export const ServerHostSchema = z.string();
export type ServerHost = z.infer<typeof ServerHostSchema>;

/**
 * The tcw-powered server configuration settings.
 */
export const ProviderServerSchema = z.object({
  host: ServerHostSchema,
  /** Optional configuration for the server's routes. */
  routes: ServerRoutesSchema.optional(),
});

export type ProviderServer = z.infer<typeof ProviderServerSchema>;

// =============================================================================
// Web3 Provider Configuration
// =============================================================================

/**
 * Web3 provider configuration settings.
 * Note: driver is any external provider (Metamask, Web3Modal, etc.)
 */
export const ProviderWeb3Schema = z.object({
  /**
   * window.ethereum for Metamask;
   * web3modal.connect() for Web3Modal;
   * const signer = useSigner(); const provider = signer.provider; from Wagmi for Rainbowkit
   */
  driver: z.unknown(),
});

export type ProviderWeb3 = z.infer<typeof ProviderWeb3Schema>;

/**
 * TCW web3 configuration settings.
 */
export const ClientProvidersSchema = z.object({
  /** Web3 wallet provider */
  web3: ProviderWeb3Schema.optional(),
  /** JSON RPC provider configurations */
  rpc: RPCProviderSchema.optional(),
  /** Optional reference to server running tcw-server. */
  server: ProviderServerSchema.optional(),
});

export type ClientProviders = z.infer<typeof ClientProvidersSchema>;

// =============================================================================
// SIWE Configuration
// =============================================================================

/**
 * Extra SIWE fields.
 * Note: This is from tcwSession.ExtraFields which is an external type.
 */
export const ExtraFieldsSchema = z.record(z.string(), z.unknown());
export type ExtraFields = z.infer<typeof ExtraFieldsSchema>;

/**
 * Optional session configuration for the SIWE message.
 * Note: Extends Partial<tcwSession.SiweConfig> from @tinycloud/web-sdk-wasm.
 */
export const SiweConfigSchema = z.object({
  /** Domain for the SIWE message. */
  domain: z.string().optional(),
  /** URI for the SIWE message. */
  uri: z.string().optional(),
  /** Chain ID for the SIWE message. */
  chainId: z.number().optional(),
  /** Statement for the SIWE message. */
  statement: z.string().optional(),
  /** Nonce for the SIWE message. */
  nonce: z.string().optional(),
  /** Expiration time for the SIWE message. */
  expirationTime: z.string().optional(),
  /** Not before time for the SIWE message. */
  notBefore: z.string().optional(),
  /** Request ID for the SIWE message. */
  requestId: z.string().optional(),
  /** Resources for the SIWE message. */
  resources: z.array(z.string()).optional(),
}).passthrough(); // Allow additional fields from external type

export type SiweConfig = z.infer<typeof SiweConfigSchema>;

/**
 * Overrides for the session configuration.
 */
export const ConfigOverridesSchema = z.object({
  siwe: SiweConfigSchema.optional(),
});

export type ConfigOverrides = z.infer<typeof ConfigOverridesSchema>;

// =============================================================================
// Client Configuration
// =============================================================================

/**
 * Core config for TCW.
 */
export const ClientConfigSchema = z.object({
  /** Connection to a cryptographic keypair and/or network. */
  providers: ClientProvidersSchema.optional(),
  /** Optional session configuration for the SIWE message. */
  siweConfig: SiweConfigSchema.optional(),
  /** Whether or not ENS resolution is enabled. True means resolve all on client. */
  resolveEns: z.boolean().optional(),
});

export type ClientConfig = z.infer<typeof ClientConfigSchema>;

// =============================================================================
// Client Session
// =============================================================================

/**
 * Representation of an active TCWSession.
 */
export const ClientSessionSchema = z.object({
  /** User address */
  address: z.string(),
  /** User address without delegation */
  walletAddress: z.string(),
  /** Chain ID */
  chainId: z.number(),
  /** Key to identify the session */
  sessionKey: z.string(),
  /** The message that can be obtained by SiweMessage.prepareMessage() */
  siwe: z.string(),
  /** The signature of the siwe message */
  signature: z.string(),
  /** ENS data supported by TCW */
  ens: EnsDataSchema.optional(),
});

export type ClientSession = z.infer<typeof ClientSessionSchema>;

// =============================================================================
// Extension Interface
// =============================================================================

/**
 * Interface for an extension to TCW.
 * Note: Methods are async functions, validated as functions at runtime.
 */
export const ExtensionSchema = z.object({
  /** [recap] Capability namespace. */
  namespace: z.string().optional(),
  /** [recap] Default delegated actions in capability namespace. */
  defaultActions: z.function().optional(),
  /** [recap] Delegated actions by target in capability namespace. */
  targetedActions: z.function().optional(),
  /** [recap] Extra metadata to help validate the capability. */
  extraFields: z.function().optional(),
  /** Hook to run after TCW has connected to the user's wallet. */
  afterConnect: z.function().optional(),
  /** Hook to run after TCW has signed in. */
  afterSignIn: z.function().optional(),
});

export type Extension = z.infer<typeof ExtensionSchema>;

/**
 * Interface to an intermediate TCW state: connected, but not signed-in.
 * Note: Contains many functions and external types, use z.unknown() for complex fields.
 */
export const IConnectedSchema = z.object({
  /** Instance of TCWSessionManager. */
  builder: z.unknown(),
  /** TCWConfig object. */
  config: ClientConfigSchema,
  /** List of enabled extensions. */
  extensions: z.array(ExtensionSchema),
  /** Web3 provider. */
  provider: z.unknown(),
  /** Promise that is initialized on construction to run the "afterConnect" methods of extensions. */
  afterConnectHooksPromise: z.unknown(),
  /** Method to verify if extension is enabled. */
  isExtensionEnabled: z.function(),
  /** Axios instance. */
  api: z.unknown().optional(),
  /** Method to apply the "afterConnect" methods and the delegated capabilities of the extensions. */
  applyExtensions: z.function(),
  /** Method to apply the "afterSignIn" methods of the extensions. */
  afterSignIn: z.function(),
  /** Method to request the user to sign in. */
  signIn: z.function(),
  /** Method to request the user to sign out. */
  signOut: z.function(),
});

export type IConnected = z.infer<typeof IConnectedSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validation error type.
 */
export interface ValidationError {
  code: string;
  message: string;
  issues?: unknown[];
}

/**
 * Result type for validation operations.
 */
export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ValidationError };

/**
 * Validates ClientSession.
 */
export function validateClientSession(data: unknown): ValidationResult<ClientSession> {
  const result = ClientSessionSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates ClientConfig.
 */
export function validateClientConfig(data: unknown): ValidationResult<ClientConfig> {
  const result = ClientConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates SiweConfig.
 */
export function validateSiweConfig(data: unknown): ValidationResult<SiweConfig> {
  const result = SiweConfigSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data };
}

/**
 * Validates Extension.
 */
export function validateExtension(data: unknown): ValidationResult<Extension> {
  const result = ExtensionSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: result.error.message,
        issues: result.error.issues,
      },
    };
  }
  return { ok: true, data: result.data };
}
