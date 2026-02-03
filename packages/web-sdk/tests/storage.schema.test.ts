/**
 * Tests for storage type Zod schemas.
 */

import { describe, it, expect } from "bun:test";
import {
  SessionConfigSchema,
  SessionSchema,
  HostConfigSchema,
  validateSessionConfig,
  validateSession,
  validateHostConfig,
} from "../src/modules/Storage/tinycloud/types.schema.js";

// =============================================================================
// SessionConfig Tests
// =============================================================================

describe("SessionConfigSchema", () => {
  const validSessionConfig = {
    actions: {
      "tinycloud.kv": {
        "/kv/*": ["read", "write"],
      },
    },
    address: "0x1234567890abcdef",
    chainId: 1,
    domain: "example.com",
    issuedAt: "2025-01-01T00:00:00Z",
    spaceId: "space-123",
    expirationTime: "2025-12-31T23:59:59Z",
  };

  it("should validate minimal session config", () => {
    const result = SessionConfigSchema.safeParse(validSessionConfig);
    expect(result.success).toBe(true);
  });

  it("should validate config with notBefore", () => {
    const result = SessionConfigSchema.safeParse({
      ...validSessionConfig,
      notBefore: "2025-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("should validate config with parents", () => {
    const result = SessionConfigSchema.safeParse({
      ...validSessionConfig,
      parents: ["parent-delegation-cid-1", "parent-delegation-cid-2"],
    });
    expect(result.success).toBe(true);
  });

  it("should validate config with jwk", () => {
    const result = SessionConfigSchema.safeParse({
      ...validSessionConfig,
      jwk: {
        kty: "EC",
        crv: "P-256",
        x: "test-x",
        y: "test-y",
      },
    });
    expect(result.success).toBe(true);
  });

  it("should validate config with all optional fields", () => {
    const result = SessionConfigSchema.safeParse({
      ...validSessionConfig,
      notBefore: "2025-01-01T00:00:00Z",
      parents: ["parent-cid"],
      jwk: { kty: "EC" },
    });
    expect(result.success).toBe(true);
  });

  it("should reject config without actions", () => {
    const { actions, ...incomplete } = validSessionConfig;
    const result = SessionConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject config without address", () => {
    const { address, ...incomplete } = validSessionConfig;
    const result = SessionConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject config without chainId", () => {
    const { chainId, ...incomplete } = validSessionConfig;
    const result = SessionConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject config with invalid chainId", () => {
    const result = SessionConfigSchema.safeParse({
      ...validSessionConfig,
      chainId: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("should reject config without domain", () => {
    const { domain, ...incomplete } = validSessionConfig;
    const result = SessionConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject config without issuedAt", () => {
    const { issuedAt, ...incomplete } = validSessionConfig;
    const result = SessionConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject config without spaceId", () => {
    const { spaceId, ...incomplete } = validSessionConfig;
    const result = SessionConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject config without expirationTime", () => {
    const { expirationTime, ...incomplete } = validSessionConfig;
    const result = SessionConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should validate nested actions structure", () => {
    const result = SessionConfigSchema.safeParse({
      ...validSessionConfig,
      actions: {
        "tinycloud.kv": {
          "/kv/public/*": ["read"],
          "/kv/private/*": ["read", "write", "delete"],
        },
        "tinycloud.space": {
          "/": ["host"],
        },
      },
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// Session Tests
// =============================================================================

describe("SessionSchema", () => {
  const validSession = {
    delegationHeader: {
      Authorization: "Bearer eyJhbGciOiJFZERTQSJ9...",
    },
    delegationCid: "bafyrei1234567890",
    jwk: {
      kty: "EC",
      crv: "P-256",
      x: "test-x-coord",
      y: "test-y-coord",
    },
    spaceId: "space-123",
    verificationMethod: "did:key:z6Mk...",
  };

  it("should validate complete session", () => {
    const result = SessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("should reject session without delegationHeader", () => {
    const { delegationHeader, ...incomplete } = validSession;
    const result = SessionSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject session with invalid delegationHeader", () => {
    const result = SessionSchema.safeParse({
      ...validSession,
      delegationHeader: {},
    });
    expect(result.success).toBe(false);
  });

  it("should reject session without delegationCid", () => {
    const { delegationCid, ...incomplete } = validSession;
    const result = SessionSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject session without jwk", () => {
    const { jwk, ...incomplete } = validSession;
    const result = SessionSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject session without spaceId", () => {
    const { spaceId, ...incomplete } = validSession;
    const result = SessionSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject session without verificationMethod", () => {
    const { verificationMethod, ...incomplete } = validSession;
    const result = SessionSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should validate session with additional jwk fields", () => {
    const result = SessionSchema.safeParse({
      ...validSession,
      jwk: {
        kty: "EC",
        crv: "P-256",
        x: "test-x",
        y: "test-y",
        d: "private-key",
        kid: "key-id",
      },
    });
    expect(result.success).toBe(true);
  });
});

// =============================================================================
// HostConfig Tests
// =============================================================================

describe("HostConfigSchema", () => {
  const validHostConfig = {
    address: "0x1234567890abcdef",
    chainId: 1,
    domain: "example.com",
    issuedAt: "2025-01-01T00:00:00Z",
    spaceId: "space-123",
    peerId: "12D3KooW...",
  };

  it("should validate complete host config", () => {
    const result = HostConfigSchema.safeParse(validHostConfig);
    expect(result.success).toBe(true);
  });

  it("should reject host config without address", () => {
    const { address, ...incomplete } = validHostConfig;
    const result = HostConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject host config without chainId", () => {
    const { chainId, ...incomplete } = validHostConfig;
    const result = HostConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject host config with invalid chainId", () => {
    const result = HostConfigSchema.safeParse({
      ...validHostConfig,
      chainId: "not-a-number",
    });
    expect(result.success).toBe(false);
  });

  it("should reject host config without domain", () => {
    const { domain, ...incomplete } = validHostConfig;
    const result = HostConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject host config without issuedAt", () => {
    const { issuedAt, ...incomplete } = validHostConfig;
    const result = HostConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject host config without spaceId", () => {
    const { spaceId, ...incomplete } = validHostConfig;
    const result = HostConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject host config without peerId", () => {
    const { peerId, ...incomplete } = validHostConfig;
    const result = HostConfigSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Validation Helper Tests
// =============================================================================

describe("validateSessionConfig", () => {
  it("should return success for valid config", () => {
    const result = validateSessionConfig({
      actions: { "tinycloud.kv": { "/*": ["read"] } },
      address: "0x1234",
      chainId: 1,
      domain: "example.com",
      issuedAt: "2025-01-01T00:00:00Z",
      spaceId: "space-123",
      expirationTime: "2025-12-31T23:59:59Z",
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for incomplete config", () => {
    const result = validateSessionConfig({
      address: "0x1234",
      chainId: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateSession", () => {
  it("should return success for valid session", () => {
    const result = validateSession({
      delegationHeader: { Authorization: "Bearer token" },
      delegationCid: "bafyrei...",
      jwk: { kty: "EC" },
      spaceId: "space-123",
      verificationMethod: "did:key:z6Mk...",
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for incomplete session", () => {
    const result = validateSession({
      delegationCid: "bafyrei...",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateHostConfig", () => {
  it("should return success for valid config", () => {
    const result = validateHostConfig({
      address: "0x1234",
      chainId: 1,
      domain: "example.com",
      issuedAt: "2025-01-01T00:00:00Z",
      spaceId: "space-123",
      peerId: "12D3KooW...",
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for incomplete config", () => {
    const result = validateHostConfig({
      address: "0x1234",
      chainId: 1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
