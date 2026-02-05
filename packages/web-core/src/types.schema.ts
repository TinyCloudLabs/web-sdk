/**
 * Zod schemas for TinyCloud Web Core types.
 *
 * These schemas provide runtime validation for RPC providers, route configuration,
 * and ENS data. Types are derived from schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";

// =============================================================================
// ENS Data
// =============================================================================

/**
 * ENS data supported by TCW.
 */
export const EnsDataSchema = z.object({
  /** ENS name/domain. */
  domain: z.string().nullable().optional(),
  /** ENS avatar. */
  avatarUrl: z.string().nullable().optional(),
});

export type EnsData = z.infer<typeof EnsDataSchema>;

// =============================================================================
// RPC Provider Enums
// =============================================================================

/**
 * Enum of supported EthersJS providers.
 */
export const RPCProvidersSchema = z.enum([
  "alchemy",
  "ankr",
  "cloudflare",
  "custom",
  "etherscan",
  "infura",
  "pocket",
]);

export type RPCProviders = z.infer<typeof RPCProvidersSchema>;

/**
 * Enum values for RPCProviders (for backwards compatibility).
 */
export const RPCProviders = {
  AlchemyProvider: "alchemy",
  AnkrProvider: "ankr",
  CloudflareProvider: "cloudflare",
  CustomProvider: "custom",
  EtherscanProvider: "etherscan",
  InfuraProvider: "infura",
  PocketProvider: "pocket",
} as const;

// =============================================================================
// Network Enums
// =============================================================================

/**
 * Enum of supported networks for Etherscan.
 */
export const EtherscanProviderNetworksSchema = z.enum([
  "homestead",
  "ropsten",
  "rinkeby",
  "goerli",
  "kovan",
]);

export type EtherscanProviderNetworks = z.infer<typeof EtherscanProviderNetworksSchema>;

export const EtherscanProviderNetworks = {
  MAINNET: "homestead",
  ROPSTEN: "ropsten",
  RINKEBY: "rinkeby",
  GOERLI: "goerli",
  KOVAN: "kovan",
} as const;

/**
 * Enum of supported networks for Infura.
 */
export const InfuraProviderNetworksSchema = z.enum([
  "homestead",
  "ropsten",
  "rinkeby",
  "goerli",
  "kovan",
  "matic",
  "maticmum",
  "optimism",
  "optimism-kovan",
  "arbitrum",
  "arbitrum-rinkeby",
]);

export type InfuraProviderNetworks = z.infer<typeof InfuraProviderNetworksSchema>;

export const InfuraProviderNetworks = {
  MAINNET: "homestead",
  ROPSTEN: "ropsten",
  RINKEBY: "rinkeby",
  GOERLI: "goerli",
  KOVAN: "kovan",
  POLYGON: "matic",
  POLYGON_MUMBAI: "maticmum",
  OPTIMISM: "optimism",
  OPTIMISM_KOVAN: "optimism-kovan",
  ARBITRUM: "arbitrum",
  ARBITRUM_RINKEBY: "arbitrum-rinkeby",
} as const;

/**
 * Enum of supported networks for Alchemy.
 */
export const AlchemyProviderNetworksSchema = z.enum([
  "homestead",
  "ropsten",
  "rinkeby",
  "goerli",
  "kovan",
  "matic",
  "maticmum",
  "optimism",
  "optimism-kovan",
  "arbitrum",
  "arbitrum-rinkeby",
]);

export type AlchemyProviderNetworks = z.infer<typeof AlchemyProviderNetworksSchema>;

export const AlchemyProviderNetworks = {
  MAINNET: "homestead",
  ROPSTEN: "ropsten",
  RINKEBY: "rinkeby",
  GOERLI: "goerli",
  KOVAN: "kovan",
  POLYGON: "matic",
  POLYGON_MUMBAI: "maticmum",
  OPTIMISM: "optimism",
  OPTIMISM_KOVAN: "optimism-kovan",
  ARBITRUM: "arbitrum",
  ARBITRUM_RINKEBY: "arbitrum-rinkeby",
} as const;

/**
 * Enum of supported networks for Pocket.
 */
export const PocketProviderNetworksSchema = z.enum([
  "homestead",
  "ropsten",
  "rinkeby",
  "goerli",
]);

export type PocketProviderNetworks = z.infer<typeof PocketProviderNetworksSchema>;

export const PocketProviderNetworks = {
  MAINNET: "homestead",
  ROPSTEN: "ropsten",
  RINKEBY: "rinkeby",
  GOERLI: "goerli",
} as const;

/**
 * Enum of supported networks for Ankr.
 */
export const AnkrProviderNetworksSchema = z.enum([
  "homestead",
  "matic",
  "arbitrum",
]);

export type AnkrProviderNetworks = z.infer<typeof AnkrProviderNetworksSchema>;

export const AnkrProviderNetworks = {
  MAINNET: "homestead",
  POLYGON: "matic",
  ARBITRUM: "arbitrum",
} as const;

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Infura provider project settings.
 */
export const InfuraProviderProjectSettingsSchema = z.object({
  projectId: z.string(),
  projectSecret: z.string(),
});

export type InfuraProviderProjectSettings = z.infer<typeof InfuraProviderProjectSettingsSchema>;

/**
 * Etherscan provider settings.
 */
export const EtherscanProviderSchema = z.object({
  service: z.literal("etherscan"),
  apiKey: z.string().optional(),
  network: EtherscanProviderNetworksSchema.optional(),
});

export type EtherscanProvider = z.infer<typeof EtherscanProviderSchema>;

/**
 * Infura provider settings.
 */
export const InfuraProviderSchema = z.object({
  service: z.literal("infura"),
  apiKey: z.union([z.string(), InfuraProviderProjectSettingsSchema]),
  network: InfuraProviderNetworksSchema.optional(),
});

export type InfuraProvider = z.infer<typeof InfuraProviderSchema>;

/**
 * Alchemy provider settings.
 */
export const AlchemyProviderSchema = z.object({
  service: z.literal("alchemy"),
  apiKey: z.string().optional(),
  network: AlchemyProviderNetworksSchema.optional(),
});

export type AlchemyProvider = z.infer<typeof AlchemyProviderSchema>;

/**
 * Cloudflare provider settings.
 */
export const CloudflareProviderSchema = z.object({
  service: z.literal("cloudflare"),
});

export type CloudflareProvider = z.infer<typeof CloudflareProviderSchema>;

/**
 * Pocket provider settings.
 */
export const PocketProviderSchema = z.object({
  service: z.literal("pocket"),
  apiKey: z.string().optional(),
  network: PocketProviderNetworksSchema.optional(),
});

export type PocketProvider = z.infer<typeof PocketProviderSchema>;

/**
 * Ankr provider settings.
 */
export const AnkrProviderSchema = z.object({
  service: z.literal("ankr"),
  apiKey: z.string().optional(),
  network: AnkrProviderNetworksSchema.optional(),
});

export type AnkrProvider = z.infer<typeof AnkrProviderSchema>;

/**
 * Custom provider settings.
 * Note: url and network are ethers types, validated as unknown.
 */
export const CustomProviderSchema = z.object({
  service: z.literal("custom"),
  url: z.unknown().optional(),
  network: z.unknown().optional(),
});

export type CustomProvider = z.infer<typeof CustomProviderSchema>;

/**
 * Generic provider settings.
 * Note: url and network are ethers types, validated as unknown.
 */
export const GenericProviderSchema = z.object({
  service: RPCProvidersSchema,
  url: z.unknown().optional(),
  network: z.unknown().optional(),
  apiKey: z.union([z.string(), InfuraProviderProjectSettingsSchema]).optional(),
});

export type GenericProvider = z.infer<typeof GenericProviderSchema>;

/**
 * Supported provider types (discriminated union).
 */
export const RPCProviderSchema = z.discriminatedUnion("service", [
  EtherscanProviderSchema,
  InfuraProviderSchema,
  AlchemyProviderSchema,
  CloudflareProviderSchema,
  PocketProviderSchema,
  AnkrProviderSchema,
  CustomProviderSchema,
]);

export type RPCProvider = z.infer<typeof RPCProviderSchema>;

// =============================================================================
// Type Guards (for backwards compatibility)
// =============================================================================

export const isEtherscanProvider = (
  provider: RPCProvider
): provider is EtherscanProvider => provider.service === "etherscan";

export const isInfuraProvider = (
  provider: RPCProvider
): provider is InfuraProvider => provider.service === "infura";

export const isAlchemyProvider = (
  provider: RPCProvider
): provider is AlchemyProvider => provider.service === "alchemy";

export const isCloudflareProvider = (
  provider: RPCProvider
): provider is CloudflareProvider => provider.service === "cloudflare";

export const isPocketProvider = (
  provider: RPCProvider
): provider is PocketProvider => provider.service === "pocket";

export const isAnkrProvider = (
  provider: RPCProvider
): provider is AnkrProvider => provider.service === "ankr";

export const isCustomProvider = (
  provider: RPCProvider
): provider is CustomProvider => provider.service === "custom";

// =============================================================================
// Route Configuration Types
// =============================================================================

/**
 * TCW Route Configuration.
 * This configuration is used to override the default endpoint paths.
 */
export const RouteConfigSchema = z.object({
  /** Endpoint path. */
  url: z.string().optional(),
  /** Endpoint request method. */
  method: z.enum(["get", "post", "put", "delete"]).optional(),
  /** Custom Operation - Replace the tcw function called with a function of your own. */
  customAPIOperation: z.function().optional(),
});

export type RouteConfig = z.infer<typeof RouteConfigSchema>;

/**
 * Server middleware configuration.
 */
export const ServerMiddlewareConfigSchema = z.object({
  path: z.string(),
  callback: z.function().optional(),
});

export type ServerMiddlewareConfig = z.infer<typeof ServerMiddlewareConfigSchema>;

/**
 * Type-Guard for ServerMiddlewareConfig.
 */
export const isServerMiddlewareConfig = (
  config: ServerRouteEndpointType
): config is ServerMiddlewareConfig =>
  typeof config === "object" &&
  config !== null &&
  "path" in config &&
  typeof (config as ServerMiddlewareConfig).path === "string";

/**
 * Server route endpoint type (union).
 */
export const ServerRouteEndpointTypeSchema = z.union([
  RouteConfigSchema.partial(),
  z.unknown(), // AxiosRequestConfig
  z.string(),
  ServerMiddlewareConfigSchema,
]);

export type ServerRouteEndpointType = z.infer<typeof ServerRouteEndpointTypeSchema>;

/**
 * Server endpoints configuration.
 */
export const ServerRoutesSchema = z.object({
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce: ServerRouteEndpointTypeSchema.optional(),
  /** Post login endpoint path. /tcw-login as default. */
  login: ServerRouteEndpointTypeSchema.optional(),
  /** Post logout endpoint path. /tcw-logout as default. */
  logout: ServerRouteEndpointTypeSchema.optional(),
});

export type ServerRoutes = z.infer<typeof ServerRoutesSchema>;

/**
 * Server endpoints name configuration.
 */
export const ServerRouteNamesSchema = z.object({
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce: z.string().optional(),
  /** Post login endpoint path. /tcw-login as default. */
  login: z.string().optional(),
  /** Post logout endpoint path. /tcw-logout as default. */
  logout: z.string().optional(),
});

export type ServerRouteNames = z.infer<typeof ServerRouteNamesSchema>;

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
 * Validates EnsData.
 */
export function validateEnsData(data: unknown): ValidationResult<EnsData> {
  const result = EnsDataSchema.safeParse(data);
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
 * Validates RPCProvider.
 */
export function validateRPCProvider(data: unknown): ValidationResult<RPCProvider> {
  const result = RPCProviderSchema.safeParse(data);
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
 * Validates ServerRoutes.
 */
export function validateServerRoutes(data: unknown): ValidationResult<ServerRoutes> {
  const result = ServerRoutesSchema.safeParse(data);
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
