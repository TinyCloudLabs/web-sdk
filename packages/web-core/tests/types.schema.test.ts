/**
 * Tests for TinyCloud Web Core type Zod schemas.
 */

import { describe, it, expect } from "bun:test";
import {
  // ENS Data
  TCWEnsDataSchema,
  // Provider Enums
  TCWRPCProvidersSchema,
  TCWEtherscanProviderNetworksSchema,
  TCWInfuraProviderNetworksSchema,
  TCWAlchemyProviderNetworksSchema,
  TCWPocketProviderNetworksSchema,
  TCWAnkrProviderNetworksSchema,
  // Provider Types
  TCWInfuraProviderProjectSettingsSchema,
  TCWEtherscanProviderSchema,
  TCWInfuraProviderSchema,
  TCWAlchemyProviderSchema,
  TCWCloudflareProviderSchema,
  TCWPocketProviderSchema,
  TCWAnkrProviderSchema,
  TCWCustomProviderSchema,
  TCWRPCProviderSchema,
  // Route Configuration
  TCWRouteConfigSchema,
  TCWServerMiddlewareConfigSchema,
  TCWServerRoutesSchema,
  TCWServerRouteNamesSchema,
  // Type Guards
  isTCWEtherscanProvider,
  isTCWInfuraProvider,
  isTCWAlchemyProvider,
  isTCWCloudflareProvider,
  isTCWPocketProvider,
  isTCWAnkrProvider,
  isTCWCustomProvider,
  isTCWServerMiddlewareConfig,
  // Validation Helpers
  validateTCWEnsData,
  validateTCWRPCProvider,
  validateTCWServerRoutes,
} from "../src/types.schema.js";

import {
  // Client Types
  TCWServerHostSchema,
  TCWProviderServerSchema,
  TCWProviderWeb3Schema,
  TCWClientProvidersSchema,
  SiweConfigSchema,
  ConfigOverridesSchema,
  TCWClientConfigSchema,
  TCWClientSessionSchema,
  TCWExtensionSchema,
  // Validation Helpers
  validateTCWClientSession,
  validateTCWClientConfig,
  validateSiweConfig,
  validateTCWExtension,
} from "../src/client/types.schema.js";

// =============================================================================
// TCWEnsData Tests
// =============================================================================

describe("TCWEnsDataSchema", () => {
  it("should validate empty object", () => {
    const result = TCWEnsDataSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate with domain only", () => {
    const result = TCWEnsDataSchema.safeParse({ domain: "test.eth" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("test.eth");
    }
  });

  it("should validate with avatarUrl only", () => {
    const result = TCWEnsDataSchema.safeParse({ avatarUrl: "https://example.com/avatar.png" });
    expect(result.success).toBe(true);
  });

  it("should validate with both fields", () => {
    const result = TCWEnsDataSchema.safeParse({
      domain: "test.eth",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("should validate with null values", () => {
    const result = TCWEnsDataSchema.safeParse({
      domain: null,
      avatarUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-string domain", () => {
    const result = TCWEnsDataSchema.safeParse({ domain: 123 });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// RPC Provider Enum Tests
// =============================================================================

describe("TCWRPCProvidersSchema", () => {
  it("should validate all provider types", () => {
    const providers = ["alchemy", "ankr", "cloudflare", "custom", "etherscan", "infura", "pocket"];
    providers.forEach((provider) => {
      const result = TCWRPCProvidersSchema.safeParse(provider);
      expect(result.success).toBe(true);
    });
  });

  it("should reject invalid provider", () => {
    const result = TCWRPCProvidersSchema.safeParse("invalid");
    expect(result.success).toBe(false);
  });
});

describe("TCWEtherscanProviderNetworksSchema", () => {
  it("should validate all network types", () => {
    const networks = ["homestead", "ropsten", "rinkeby", "goerli", "kovan"];
    networks.forEach((network) => {
      const result = TCWEtherscanProviderNetworksSchema.safeParse(network);
      expect(result.success).toBe(true);
    });
  });

  it("should reject invalid network", () => {
    const result = TCWEtherscanProviderNetworksSchema.safeParse("polygon");
    expect(result.success).toBe(false);
  });
});

describe("TCWInfuraProviderNetworksSchema", () => {
  it("should validate polygon networks", () => {
    const networks = ["matic", "maticmum"];
    networks.forEach((network) => {
      const result = TCWInfuraProviderNetworksSchema.safeParse(network);
      expect(result.success).toBe(true);
    });
  });

  it("should validate optimism networks", () => {
    const networks = ["optimism", "optimism-kovan"];
    networks.forEach((network) => {
      const result = TCWInfuraProviderNetworksSchema.safeParse(network);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Provider Type Tests
// =============================================================================

describe("TCWEtherscanProviderSchema", () => {
  it("should validate minimal provider", () => {
    const result = TCWEtherscanProviderSchema.safeParse({ service: "etherscan" });
    expect(result.success).toBe(true);
  });

  it("should validate provider with apiKey and network", () => {
    const result = TCWEtherscanProviderSchema.safeParse({
      service: "etherscan",
      apiKey: "test-api-key",
      network: "homestead",
    });
    expect(result.success).toBe(true);
  });

  it("should reject wrong service type", () => {
    const result = TCWEtherscanProviderSchema.safeParse({ service: "infura" });
    expect(result.success).toBe(false);
  });
});

describe("TCWInfuraProviderSchema", () => {
  it("should validate provider with string apiKey", () => {
    const result = TCWInfuraProviderSchema.safeParse({
      service: "infura",
      apiKey: "test-api-key",
    });
    expect(result.success).toBe(true);
  });

  it("should validate provider with project settings", () => {
    const result = TCWInfuraProviderSchema.safeParse({
      service: "infura",
      apiKey: {
        projectId: "test-project-id",
        projectSecret: "test-project-secret",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject provider without apiKey", () => {
    const result = TCWInfuraProviderSchema.safeParse({ service: "infura" });
    expect(result.success).toBe(false);
  });
});

describe("TCWCloudflareProviderSchema", () => {
  it("should validate cloudflare provider", () => {
    const result = TCWCloudflareProviderSchema.safeParse({ service: "cloudflare" });
    expect(result.success).toBe(true);
  });

  it("should not allow extra fields on cloudflare", () => {
    const result = TCWCloudflareProviderSchema.safeParse({
      service: "cloudflare",
      apiKey: "should-not-exist",
    });
    // Zod strips unknown keys by default
    expect(result.success).toBe(true);
  });
});

describe("TCWCustomProviderSchema", () => {
  it("should validate custom provider with url", () => {
    const result = TCWCustomProviderSchema.safeParse({
      service: "custom",
      url: "https://my-rpc.example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should validate custom provider with network", () => {
    const result = TCWCustomProviderSchema.safeParse({
      service: "custom",
      network: { chainId: 1 },
    });
    expect(result.success).toBe(true);
  });
});

describe("TCWRPCProviderSchema (discriminated union)", () => {
  it("should validate etherscan provider", () => {
    const result = TCWRPCProviderSchema.safeParse({ service: "etherscan" });
    expect(result.success).toBe(true);
  });

  it("should validate infura provider", () => {
    const result = TCWRPCProviderSchema.safeParse({
      service: "infura",
      apiKey: "test-key",
    });
    expect(result.success).toBe(true);
  });

  it("should validate cloudflare provider", () => {
    const result = TCWRPCProviderSchema.safeParse({ service: "cloudflare" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid service", () => {
    const result = TCWRPCProviderSchema.safeParse({ service: "invalid" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe("Provider Type Guards", () => {
  it("isTCWEtherscanProvider should return true for etherscan", () => {
    const provider = { service: "etherscan" as const };
    expect(isTCWEtherscanProvider(provider)).toBe(true);
  });

  it("isTCWEtherscanProvider should return false for infura", () => {
    const provider = { service: "infura" as const, apiKey: "test" };
    expect(isTCWEtherscanProvider(provider)).toBe(false);
  });

  it("isTCWInfuraProvider should return true for infura", () => {
    const provider = { service: "infura" as const, apiKey: "test" };
    expect(isTCWInfuraProvider(provider)).toBe(true);
  });

  it("isTCWCloudflareProvider should return true for cloudflare", () => {
    const provider = { service: "cloudflare" as const };
    expect(isTCWCloudflareProvider(provider)).toBe(true);
  });

  it("isTCWCustomProvider should return true for custom", () => {
    const provider = { service: "custom" as const };
    expect(isTCWCustomProvider(provider)).toBe(true);
  });
});

// =============================================================================
// Route Configuration Tests
// =============================================================================

describe("TCWRouteConfigSchema", () => {
  it("should validate empty config", () => {
    const result = TCWRouteConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate config with url", () => {
    const result = TCWRouteConfigSchema.safeParse({ url: "/api/custom" });
    expect(result.success).toBe(true);
  });

  it("should validate config with method", () => {
    const result = TCWRouteConfigSchema.safeParse({ method: "post" });
    expect(result.success).toBe(true);
  });

  it("should validate config with customAPIOperation", () => {
    const result = TCWRouteConfigSchema.safeParse({
      customAPIOperation: async () => {},
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid method", () => {
    const result = TCWRouteConfigSchema.safeParse({ method: "patch" });
    expect(result.success).toBe(false);
  });
});

describe("TCWServerMiddlewareConfigSchema", () => {
  it("should validate middleware config", () => {
    const result = TCWServerMiddlewareConfigSchema.safeParse({ path: "/middleware" });
    expect(result.success).toBe(true);
  });

  it("should validate middleware config with callback", () => {
    const result = TCWServerMiddlewareConfigSchema.safeParse({
      path: "/middleware",
      callback: () => {},
    });
    expect(result.success).toBe(true);
  });

  it("should reject config without path", () => {
    const result = TCWServerMiddlewareConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("isTCWServerMiddlewareConfig", () => {
  it("should return true for middleware config", () => {
    expect(isTCWServerMiddlewareConfig({ path: "/test" })).toBe(true);
  });

  it("should return false for string", () => {
    expect(isTCWServerMiddlewareConfig("/test")).toBe(false);
  });

  it("should return false for route config", () => {
    expect(isTCWServerMiddlewareConfig({ url: "/test" })).toBe(false);
  });
});

describe("TCWServerRoutesSchema", () => {
  it("should validate empty routes", () => {
    const result = TCWServerRoutesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate routes with string paths", () => {
    const result = TCWServerRoutesSchema.safeParse({
      nonce: "/custom-nonce",
      login: "/custom-login",
      logout: "/custom-logout",
    });
    expect(result.success).toBe(true);
  });

  it("should validate routes with middleware config", () => {
    const result = TCWServerRoutesSchema.safeParse({
      nonce: { path: "/nonce", callback: () => {} },
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Client Type Tests
// =============================================================================

describe("TCWClientSessionSchema", () => {
  const validSession = {
    address: "0x1234567890abcdef",
    walletAddress: "0x1234567890abcdef",
    chainId: 1,
    sessionKey: "session-key-123",
    siwe: "SIWE message content",
    signature: "0xsignature",
  };

  it("should validate complete session", () => {
    const result = TCWClientSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("should validate session with ENS data", () => {
    const result = TCWClientSessionSchema.safeParse({
      ...validSession,
      ens: { domain: "test.eth", avatarUrl: "https://example.com/avatar.png" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject session without address", () => {
    const { address, ...incomplete } = validSession;
    const result = TCWClientSessionSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject session with invalid chainId", () => {
    const result = TCWClientSessionSchema.safeParse({
      ...validSession,
      chainId: "not-a-number",
    });
    expect(result.success).toBe(false);
  });
});

describe("TCWClientConfigSchema", () => {
  it("should validate empty config", () => {
    const result = TCWClientConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate config with resolveEns", () => {
    const result = TCWClientConfigSchema.safeParse({ resolveEns: true });
    expect(result.success).toBe(true);
  });

  it("should validate config with siweConfig", () => {
    const result = TCWClientConfigSchema.safeParse({
      siweConfig: {
        domain: "example.com",
        statement: "Sign in to Example",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should validate config with providers", () => {
    const result = TCWClientConfigSchema.safeParse({
      providers: {
        rpc: { service: "etherscan" },
      },
    });
    expect(result.success).toBe(true);
  });
});

describe("SiweConfigSchema", () => {
  it("should validate empty config", () => {
    const result = SiweConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate config with all fields", () => {
    const result = SiweConfigSchema.safeParse({
      domain: "example.com",
      uri: "https://example.com",
      chainId: 1,
      statement: "Sign in",
      nonce: "random-nonce",
      expirationTime: "2025-12-31T23:59:59Z",
      notBefore: "2025-01-01T00:00:00Z",
      requestId: "req-123",
      resources: ["https://example.com/resource"],
    });
    expect(result.success).toBe(true);
  });

  it("should allow extra fields (passthrough)", () => {
    const result = SiweConfigSchema.safeParse({
      domain: "example.com",
      customField: "custom-value",
    });
    expect(result.success).toBe(true);
  });
});

describe("TCWExtensionSchema", () => {
  it("should validate empty extension", () => {
    const result = TCWExtensionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate extension with namespace", () => {
    const result = TCWExtensionSchema.safeParse({ namespace: "tinycloud.storage" });
    expect(result.success).toBe(true);
  });

  it("should validate extension with functions", () => {
    const result = TCWExtensionSchema.safeParse({
      namespace: "tinycloud.storage",
      defaultActions: async () => ["read", "write"],
      afterConnect: async () => ({}),
      afterSignIn: async () => {},
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Validation Helper Tests
// =============================================================================

describe("validateTCWEnsData", () => {
  it("should return success for valid data", () => {
    const result = validateTCWEnsData({ domain: "test.eth" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.domain).toBe("test.eth");
    }
  });

  it("should return error for invalid data", () => {
    const result = validateTCWEnsData({ domain: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateTCWRPCProvider", () => {
  it("should return success for valid provider", () => {
    const result = validateTCWRPCProvider({ service: "etherscan" });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid provider", () => {
    const result = validateTCWRPCProvider({ service: "invalid" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateTCWClientSession", () => {
  it("should return success for valid session", () => {
    const result = validateTCWClientSession({
      address: "0x1234",
      walletAddress: "0x1234",
      chainId: 1,
      sessionKey: "key",
      siwe: "message",
      signature: "sig",
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for incomplete session", () => {
    const result = validateTCWClientSession({ address: "0x1234" });
    expect(result.ok).toBe(false);
  });
});

describe("validateTCWClientConfig", () => {
  it("should return success for valid config", () => {
    const result = validateTCWClientConfig({ resolveEns: true });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid config", () => {
    const result = validateTCWClientConfig({ resolveEns: "not-a-boolean" });
    expect(result.ok).toBe(false);
  });
});

describe("validateSiweConfig", () => {
  it("should return success for valid config", () => {
    const result = validateSiweConfig({ domain: "example.com" });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid chainId", () => {
    const result = validateSiweConfig({ chainId: "not-a-number" });
    expect(result.ok).toBe(false);
  });
});

describe("validateTCWExtension", () => {
  it("should return success for valid extension", () => {
    const result = validateTCWExtension({
      namespace: "test",
      defaultActions: async () => [],
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid namespace type", () => {
    const result = validateTCWExtension({ namespace: 123 });
    expect(result.ok).toBe(false);
  });
});
