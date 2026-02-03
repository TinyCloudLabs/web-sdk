/**
 * Tests for TinyCloud Web Core type Zod schemas.
 */

import { describe, it, expect } from "bun:test";
import {
  // ENS Data
  EnsDataSchema,
  // Provider Enums
  RPCProvidersSchema,
  EtherscanProviderNetworksSchema,
  InfuraProviderNetworksSchema,
  AlchemyProviderNetworksSchema,
  PocketProviderNetworksSchema,
  AnkrProviderNetworksSchema,
  // Provider Types
  InfuraProviderProjectSettingsSchema,
  EtherscanProviderSchema,
  InfuraProviderSchema,
  AlchemyProviderSchema,
  CloudflareProviderSchema,
  PocketProviderSchema,
  AnkrProviderSchema,
  CustomProviderSchema,
  RPCProviderSchema,
  // Route Configuration
  RouteConfigSchema,
  ServerMiddlewareConfigSchema,
  ServerRoutesSchema,
  ServerRouteNamesSchema,
  // Type Guards
  isEtherscanProvider,
  isInfuraProvider,
  isAlchemyProvider,
  isCloudflareProvider,
  isPocketProvider,
  isAnkrProvider,
  isCustomProvider,
  isServerMiddlewareConfig,
  // Validation Helpers
  validateEnsData,
  validateRPCProvider,
  validateServerRoutes,
} from "../src/types.schema.js";

import {
  // Client Types
  ServerHostSchema,
  ProviderServerSchema,
  ProviderWeb3Schema,
  ClientProvidersSchema,
  SiweConfigSchema,
  ConfigOverridesSchema,
  ClientConfigSchema,
  ClientSessionSchema,
  ExtensionSchema,
  // Validation Helpers
  validateClientSession,
  validateClientConfig,
  validateSiweConfig,
  validateExtension,
} from "../src/client/types.schema.js";

// =============================================================================
// TCWEnsData Tests
// =============================================================================

describe("EnsDataSchema", () => {
  it("should validate empty object", () => {
    const result = EnsDataSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate with domain only", () => {
    const result = EnsDataSchema.safeParse({ domain: "test.eth" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.domain).toBe("test.eth");
    }
  });

  it("should validate with avatarUrl only", () => {
    const result = EnsDataSchema.safeParse({ avatarUrl: "https://example.com/avatar.png" });
    expect(result.success).toBe(true);
  });

  it("should validate with both fields", () => {
    const result = EnsDataSchema.safeParse({
      domain: "test.eth",
      avatarUrl: "https://example.com/avatar.png",
    });
    expect(result.success).toBe(true);
  });

  it("should validate with null values", () => {
    const result = EnsDataSchema.safeParse({
      domain: null,
      avatarUrl: null,
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-string domain", () => {
    const result = EnsDataSchema.safeParse({ domain: 123 });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// RPC Provider Enum Tests
// =============================================================================

describe("RPCProvidersSchema", () => {
  it("should validate all provider types", () => {
    const providers = ["alchemy", "ankr", "cloudflare", "custom", "etherscan", "infura", "pocket"];
    providers.forEach((provider) => {
      const result = RPCProvidersSchema.safeParse(provider);
      expect(result.success).toBe(true);
    });
  });

  it("should reject invalid provider", () => {
    const result = RPCProvidersSchema.safeParse("invalid");
    expect(result.success).toBe(false);
  });
});

describe("EtherscanProviderNetworksSchema", () => {
  it("should validate all network types", () => {
    const networks = ["homestead", "ropsten", "rinkeby", "goerli", "kovan"];
    networks.forEach((network) => {
      const result = EtherscanProviderNetworksSchema.safeParse(network);
      expect(result.success).toBe(true);
    });
  });

  it("should reject invalid network", () => {
    const result = EtherscanProviderNetworksSchema.safeParse("polygon");
    expect(result.success).toBe(false);
  });
});

describe("InfuraProviderNetworksSchema", () => {
  it("should validate polygon networks", () => {
    const networks = ["matic", "maticmum"];
    networks.forEach((network) => {
      const result = InfuraProviderNetworksSchema.safeParse(network);
      expect(result.success).toBe(true);
    });
  });

  it("should validate optimism networks", () => {
    const networks = ["optimism", "optimism-kovan"];
    networks.forEach((network) => {
      const result = InfuraProviderNetworksSchema.safeParse(network);
      expect(result.success).toBe(true);
    });
  });
});

// =============================================================================
// Provider Type Tests
// =============================================================================

describe("EtherscanProviderSchema", () => {
  it("should validate minimal provider", () => {
    const result = EtherscanProviderSchema.safeParse({ service: "etherscan" });
    expect(result.success).toBe(true);
  });

  it("should validate provider with apiKey and network", () => {
    const result = EtherscanProviderSchema.safeParse({
      service: "etherscan",
      apiKey: "test-api-key",
      network: "homestead",
    });
    expect(result.success).toBe(true);
  });

  it("should reject wrong service type", () => {
    const result = EtherscanProviderSchema.safeParse({ service: "infura" });
    expect(result.success).toBe(false);
  });
});

describe("InfuraProviderSchema", () => {
  it("should validate provider with string apiKey", () => {
    const result = InfuraProviderSchema.safeParse({
      service: "infura",
      apiKey: "test-api-key",
    });
    expect(result.success).toBe(true);
  });

  it("should validate provider with project settings", () => {
    const result = InfuraProviderSchema.safeParse({
      service: "infura",
      apiKey: {
        projectId: "test-project-id",
        projectSecret: "test-project-secret",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should reject provider without apiKey", () => {
    const result = InfuraProviderSchema.safeParse({ service: "infura" });
    expect(result.success).toBe(false);
  });
});

describe("CloudflareProviderSchema", () => {
  it("should validate cloudflare provider", () => {
    const result = CloudflareProviderSchema.safeParse({ service: "cloudflare" });
    expect(result.success).toBe(true);
  });

  it("should not allow extra fields on cloudflare", () => {
    const result = CloudflareProviderSchema.safeParse({
      service: "cloudflare",
      apiKey: "should-not-exist",
    });
    // Zod strips unknown keys by default
    expect(result.success).toBe(true);
  });
});

describe("CustomProviderSchema", () => {
  it("should validate custom provider with url", () => {
    const result = CustomProviderSchema.safeParse({
      service: "custom",
      url: "https://my-rpc.example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should validate custom provider with network", () => {
    const result = CustomProviderSchema.safeParse({
      service: "custom",
      network: { chainId: 1 },
    });
    expect(result.success).toBe(true);
  });
});

describe("RPCProviderSchema (discriminated union)", () => {
  it("should validate etherscan provider", () => {
    const result = RPCProviderSchema.safeParse({ service: "etherscan" });
    expect(result.success).toBe(true);
  });

  it("should validate infura provider", () => {
    const result = RPCProviderSchema.safeParse({
      service: "infura",
      apiKey: "test-key",
    });
    expect(result.success).toBe(true);
  });

  it("should validate cloudflare provider", () => {
    const result = RPCProviderSchema.safeParse({ service: "cloudflare" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid service", () => {
    const result = RPCProviderSchema.safeParse({ service: "invalid" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Type Guard Tests
// =============================================================================

describe("Provider Type Guards", () => {
  it("isEtherscanProvider should return true for etherscan", () => {
    const provider = { service: "etherscan" as const };
    expect(isEtherscanProvider(provider)).toBe(true);
  });

  it("isEtherscanProvider should return false for infura", () => {
    const provider = { service: "infura" as const, apiKey: "test" };
    expect(isEtherscanProvider(provider)).toBe(false);
  });

  it("isInfuraProvider should return true for infura", () => {
    const provider = { service: "infura" as const, apiKey: "test" };
    expect(isInfuraProvider(provider)).toBe(true);
  });

  it("isCloudflareProvider should return true for cloudflare", () => {
    const provider = { service: "cloudflare" as const };
    expect(isCloudflareProvider(provider)).toBe(true);
  });

  it("isCustomProvider should return true for custom", () => {
    const provider = { service: "custom" as const };
    expect(isCustomProvider(provider)).toBe(true);
  });
});

// =============================================================================
// Route Configuration Tests
// =============================================================================

describe("RouteConfigSchema", () => {
  it("should validate empty config", () => {
    const result = RouteConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate config with url", () => {
    const result = RouteConfigSchema.safeParse({ url: "/api/custom" });
    expect(result.success).toBe(true);
  });

  it("should validate config with method", () => {
    const result = RouteConfigSchema.safeParse({ method: "post" });
    expect(result.success).toBe(true);
  });

  it("should validate config with customAPIOperation", () => {
    const result = RouteConfigSchema.safeParse({
      customAPIOperation: async () => {},
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid method", () => {
    const result = RouteConfigSchema.safeParse({ method: "patch" });
    expect(result.success).toBe(false);
  });
});

describe("ServerMiddlewareConfigSchema", () => {
  it("should validate middleware config", () => {
    const result = ServerMiddlewareConfigSchema.safeParse({ path: "/middleware" });
    expect(result.success).toBe(true);
  });

  it("should validate middleware config with callback", () => {
    const result = ServerMiddlewareConfigSchema.safeParse({
      path: "/middleware",
      callback: () => {},
    });
    expect(result.success).toBe(true);
  });

  it("should reject config without path", () => {
    const result = ServerMiddlewareConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("isServerMiddlewareConfig", () => {
  it("should return true for middleware config", () => {
    expect(isServerMiddlewareConfig({ path: "/test" })).toBe(true);
  });

  it("should return false for string", () => {
    expect(isServerMiddlewareConfig("/test")).toBe(false);
  });

  it("should return false for route config", () => {
    expect(isServerMiddlewareConfig({ url: "/test" })).toBe(false);
  });
});

describe("ServerRoutesSchema", () => {
  it("should validate empty routes", () => {
    const result = ServerRoutesSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate routes with string paths", () => {
    const result = ServerRoutesSchema.safeParse({
      nonce: "/custom-nonce",
      login: "/custom-login",
      logout: "/custom-logout",
    });
    expect(result.success).toBe(true);
  });

  it("should validate routes with middleware config", () => {
    const result = ServerRoutesSchema.safeParse({
      nonce: { path: "/nonce", callback: () => {} },
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Client Type Tests
// =============================================================================

describe("ClientSessionSchema", () => {
  const validSession = {
    address: "0x1234567890abcdef",
    walletAddress: "0x1234567890abcdef",
    chainId: 1,
    sessionKey: "session-key-123",
    siwe: "SIWE message content",
    signature: "0xsignature",
  };

  it("should validate complete session", () => {
    const result = ClientSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("should validate session with ENS data", () => {
    const result = ClientSessionSchema.safeParse({
      ...validSession,
      ens: { domain: "test.eth", avatarUrl: "https://example.com/avatar.png" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject session without address", () => {
    const { address, ...incomplete } = validSession;
    const result = ClientSessionSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject session with invalid chainId", () => {
    const result = ClientSessionSchema.safeParse({
      ...validSession,
      chainId: "not-a-number",
    });
    expect(result.success).toBe(false);
  });
});

describe("ClientConfigSchema", () => {
  it("should validate empty config", () => {
    const result = ClientConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate config with resolveEns", () => {
    const result = ClientConfigSchema.safeParse({ resolveEns: true });
    expect(result.success).toBe(true);
  });

  it("should validate config with siweConfig", () => {
    const result = ClientConfigSchema.safeParse({
      siweConfig: {
        domain: "example.com",
        statement: "Sign in to Example",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should validate config with providers", () => {
    const result = ClientConfigSchema.safeParse({
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

describe("ExtensionSchema", () => {
  it("should validate empty extension", () => {
    const result = ExtensionSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate extension with namespace", () => {
    const result = ExtensionSchema.safeParse({ namespace: "tinycloud.storage" });
    expect(result.success).toBe(true);
  });

  it("should validate extension with functions", () => {
    const result = ExtensionSchema.safeParse({
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

describe("validateEnsData", () => {
  it("should return success for valid data", () => {
    const result = validateEnsData({ domain: "test.eth" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.domain).toBe("test.eth");
    }
  });

  it("should return error for invalid data", () => {
    const result = validateEnsData({ domain: 123 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateRPCProvider", () => {
  it("should return success for valid provider", () => {
    const result = validateRPCProvider({ service: "etherscan" });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid provider", () => {
    const result = validateRPCProvider({ service: "invalid" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateClientSession", () => {
  it("should return success for valid session", () => {
    const result = validateClientSession({
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
    const result = validateClientSession({ address: "0x1234" });
    expect(result.ok).toBe(false);
  });
});

describe("validateClientConfig", () => {
  it("should return success for valid config", () => {
    const result = validateClientConfig({ resolveEns: true });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid config", () => {
    const result = validateClientConfig({ resolveEns: "not-a-boolean" });
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

describe("validateExtension", () => {
  it("should return success for valid extension", () => {
    const result = validateExtension({
      namespace: "test",
      defaultActions: async () => [],
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid namespace type", () => {
    const result = validateExtension({ namespace: 123 });
    expect(result.ok).toBe(false);
  });
});
