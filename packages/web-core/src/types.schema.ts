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
export const TCWEnsDataSchema = z.object({
  /** ENS name/domain. */
  domain: z.string().nullable().optional(),
  /** ENS avatar. */
  avatarUrl: z.string().nullable().optional(),
});

export type TCWEnsData = z.infer<typeof TCWEnsDataSchema>;

// =============================================================================
// RPC Provider Enums
// =============================================================================

/**
 * Enum of supported EthersJS providers.
 */
export const TCWRPCProvidersSchema = z.enum([
  "alchemy",
  "ankr",
  "cloudflare",
  "custom",
  "etherscan",
  "infura",
  "pocket",
]);

export type TCWRPCProviders = z.infer<typeof TCWRPCProvidersSchema>;

/**
 * Enum values for TCWRPCProviders (for backwards compatibility).
 */
export const TCWRPCProviders = {
  TCWAlchemyProvider: "alchemy",
  TCWAnkrProvider: "ankr",
  TCWCloudflareProvider: "cloudflare",
  TCWCustomProvider: "custom",
  TCWEtherscanProvider: "etherscan",
  TCWInfuraProvider: "infura",
  TCWPocketProvider: "pocket",
} as const;

// =============================================================================
// Network Enums
// =============================================================================

/**
 * Enum of supported networks for Etherscan.
 */
export const TCWEtherscanProviderNetworksSchema = z.enum([
  "homestead",
  "ropsten",
  "rinkeby",
  "goerli",
  "kovan",
]);

export type TCWEtherscanProviderNetworks = z.infer<typeof TCWEtherscanProviderNetworksSchema>;

export const TCWEtherscanProviderNetworks = {
  MAINNET: "homestead",
  ROPSTEN: "ropsten",
  RINKEBY: "rinkeby",
  GOERLI: "goerli",
  KOVAN: "kovan",
} as const;

/**
 * Enum of supported networks for Infura.
 */
export const TCWInfuraProviderNetworksSchema = z.enum([
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

export type TCWInfuraProviderNetworks = z.infer<typeof TCWInfuraProviderNetworksSchema>;

export const TCWInfuraProviderNetworks = {
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
export const TCWAlchemyProviderNetworksSchema = z.enum([
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

export type TCWAlchemyProviderNetworks = z.infer<typeof TCWAlchemyProviderNetworksSchema>;

export const TCWAlchemyProviderNetworks = {
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
export const TCWPocketProviderNetworksSchema = z.enum([
  "homestead",
  "ropsten",
  "rinkeby",
  "goerli",
]);

export type TCWPocketProviderNetworks = z.infer<typeof TCWPocketProviderNetworksSchema>;

export const TCWPocketProviderNetworks = {
  MAINNET: "homestead",
  ROPSTEN: "ropsten",
  RINKEBY: "rinkeby",
  GOERLI: "goerli",
} as const;

/**
 * Enum of supported networks for Ankr.
 */
export const TCWAnkrProviderNetworksSchema = z.enum([
  "homestead",
  "matic",
  "arbitrum",
]);

export type TCWAnkrProviderNetworks = z.infer<typeof TCWAnkrProviderNetworksSchema>;

export const TCWAnkrProviderNetworks = {
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
export const TCWInfuraProviderProjectSettingsSchema = z.object({
  projectId: z.string(),
  projectSecret: z.string(),
});

export type TCWInfuraProviderProjectSettings = z.infer<typeof TCWInfuraProviderProjectSettingsSchema>;

/**
 * Etherscan provider settings.
 */
export const TCWEtherscanProviderSchema = z.object({
  service: z.literal("etherscan"),
  apiKey: z.string().optional(),
  network: TCWEtherscanProviderNetworksSchema.optional(),
});

export type TCWEtherscanProvider = z.infer<typeof TCWEtherscanProviderSchema>;

/**
 * Infura provider settings.
 */
export const TCWInfuraProviderSchema = z.object({
  service: z.literal("infura"),
  apiKey: z.union([z.string(), TCWInfuraProviderProjectSettingsSchema]),
  network: TCWInfuraProviderNetworksSchema.optional(),
});

export type TCWInfuraProvider = z.infer<typeof TCWInfuraProviderSchema>;

/**
 * Alchemy provider settings.
 */
export const TCWAlchemyProviderSchema = z.object({
  service: z.literal("alchemy"),
  apiKey: z.string().optional(),
  network: TCWAlchemyProviderNetworksSchema.optional(),
});

export type TCWAlchemyProvider = z.infer<typeof TCWAlchemyProviderSchema>;

/**
 * Cloudflare provider settings.
 */
export const TCWCloudflareProviderSchema = z.object({
  service: z.literal("cloudflare"),
});

export type TCWCloudflareProvider = z.infer<typeof TCWCloudflareProviderSchema>;

/**
 * Pocket provider settings.
 */
export const TCWPocketProviderSchema = z.object({
  service: z.literal("pocket"),
  apiKey: z.string().optional(),
  network: TCWPocketProviderNetworksSchema.optional(),
});

export type TCWPocketProvider = z.infer<typeof TCWPocketProviderSchema>;

/**
 * Ankr provider settings.
 */
export const TCWAnkrProviderSchema = z.object({
  service: z.literal("ankr"),
  apiKey: z.string().optional(),
  network: TCWAnkrProviderNetworksSchema.optional(),
});

export type TCWAnkrProvider = z.infer<typeof TCWAnkrProviderSchema>;

/**
 * Custom provider settings.
 * Note: url and network are ethers types, validated as unknown.
 */
export const TCWCustomProviderSchema = z.object({
  service: z.literal("custom"),
  url: z.unknown().optional(),
  network: z.unknown().optional(),
});

export type TCWCustomProvider = z.infer<typeof TCWCustomProviderSchema>;

/**
 * Generic provider settings.
 * Note: url and network are ethers types, validated as unknown.
 */
export const TCWGenericProviderSchema = z.object({
  service: TCWRPCProvidersSchema,
  url: z.unknown().optional(),
  network: z.unknown().optional(),
  apiKey: z.union([z.string(), TCWInfuraProviderProjectSettingsSchema]).optional(),
});

export type TCWGenericProvider = z.infer<typeof TCWGenericProviderSchema>;

/**
 * Supported provider types (discriminated union).
 */
export const TCWRPCProviderSchema = z.discriminatedUnion("service", [
  TCWEtherscanProviderSchema,
  TCWInfuraProviderSchema,
  TCWAlchemyProviderSchema,
  TCWCloudflareProviderSchema,
  TCWPocketProviderSchema,
  TCWAnkrProviderSchema,
  TCWCustomProviderSchema,
]);

export type TCWRPCProvider = z.infer<typeof TCWRPCProviderSchema>;

// =============================================================================
// Type Guards (for backwards compatibility)
// =============================================================================

export const isTCWEtherscanProvider = (
  provider: TCWRPCProvider
): provider is TCWEtherscanProvider => provider.service === "etherscan";

export const isTCWInfuraProvider = (
  provider: TCWRPCProvider
): provider is TCWInfuraProvider => provider.service === "infura";

export const isTCWAlchemyProvider = (
  provider: TCWRPCProvider
): provider is TCWAlchemyProvider => provider.service === "alchemy";

export const isTCWCloudflareProvider = (
  provider: TCWRPCProvider
): provider is TCWCloudflareProvider => provider.service === "cloudflare";

export const isTCWPocketProvider = (
  provider: TCWRPCProvider
): provider is TCWPocketProvider => provider.service === "pocket";

export const isTCWAnkrProvider = (
  provider: TCWRPCProvider
): provider is TCWAnkrProvider => provider.service === "ankr";

export const isTCWCustomProvider = (
  provider: TCWRPCProvider
): provider is TCWCustomProvider => provider.service === "custom";

// =============================================================================
// Route Configuration Types
// =============================================================================

/**
 * TCW Route Configuration.
 * This configuration is used to override the default endpoint paths.
 */
export const TCWRouteConfigSchema = z.object({
  /** Endpoint path. */
  url: z.string().optional(),
  /** Endpoint request method. */
  method: z.enum(["get", "post", "put", "delete"]).optional(),
  /** Custom Operation - Replace the tcw function called with a function of your own. */
  customAPIOperation: z.function().optional(),
});

export type TCWRouteConfig = z.infer<typeof TCWRouteConfigSchema>;

/**
 * Server middleware configuration.
 */
export const TCWServerMiddlewareConfigSchema = z.object({
  path: z.string(),
  callback: z.function().optional(),
});

export type TCWServerMiddlewareConfig = z.infer<typeof TCWServerMiddlewareConfigSchema>;

/**
 * Type-Guard for TCWServerMiddlewareConfig.
 */
export const isTCWServerMiddlewareConfig = (
  config: TCWServerRouteEndpointType
): config is TCWServerMiddlewareConfig =>
  typeof config === "object" &&
  config !== null &&
  "path" in config &&
  typeof (config as TCWServerMiddlewareConfig).path === "string";

/**
 * Server route endpoint type (union).
 */
export const TCWServerRouteEndpointTypeSchema = z.union([
  TCWRouteConfigSchema.partial(),
  z.unknown(), // AxiosRequestConfig
  z.string(),
  TCWServerMiddlewareConfigSchema,
]);

export type TCWServerRouteEndpointType = z.infer<typeof TCWServerRouteEndpointTypeSchema>;

/**
 * Server endpoints configuration.
 */
export const TCWServerRoutesSchema = z.object({
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce: TCWServerRouteEndpointTypeSchema.optional(),
  /** Post login endpoint path. /tcw-login as default. */
  login: TCWServerRouteEndpointTypeSchema.optional(),
  /** Post logout endpoint path. /tcw-logout as default. */
  logout: TCWServerRouteEndpointTypeSchema.optional(),
});

export type TCWServerRoutes = z.infer<typeof TCWServerRoutesSchema>;

/**
 * Server endpoints name configuration.
 */
export const TCWServerRouteNamesSchema = z.object({
  /** Get nonce endpoint path. /tcw-nonce as default. */
  nonce: z.string().optional(),
  /** Post login endpoint path. /tcw-login as default. */
  login: z.string().optional(),
  /** Post logout endpoint path. /tcw-logout as default. */
  logout: z.string().optional(),
});

export type TCWServerRouteNames = z.infer<typeof TCWServerRouteNamesSchema>;

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
 * Validates TCWEnsData.
 */
export function validateTCWEnsData(data: unknown): ValidationResult<TCWEnsData> {
  const result = TCWEnsDataSchema.safeParse(data);
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
 * Validates TCWRPCProvider.
 */
export function validateTCWRPCProvider(data: unknown): ValidationResult<TCWRPCProvider> {
  const result = TCWRPCProviderSchema.safeParse(data);
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
 * Validates TCWServerRoutes.
 */
export function validateTCWServerRoutes(data: unknown): ValidationResult<TCWServerRoutes> {
  const result = TCWServerRoutesSchema.safeParse(data);
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
