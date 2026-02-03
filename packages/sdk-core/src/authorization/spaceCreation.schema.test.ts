/**
 * Tests for space creation schemas.
 */

import { describe, it, expect } from "bun:test";
import {
  SpaceCreationContextSchema,
  SpaceCreationHandlerSchema,
  validateSpaceCreationContext,
  validateSpaceCreationHandler,
} from "./spaceCreation.schema";

describe("SpaceCreationContextSchema", () => {
  const validContext = {
    spaceId: "space-123",
    address: "0x1234567890123456789012345678901234567890",
    chainId: 1,
    host: "https://node.tinycloud.xyz",
  };

  it("should accept valid context", () => {
    const result = SpaceCreationContextSchema.safeParse(validContext);
    expect(result.success).toBe(true);
  });

  it("should accept lowercase address", () => {
    const result = SpaceCreationContextSchema.safeParse({
      ...validContext,
      address: "0xabcdef1234567890123456789012345678901234",
    });
    expect(result.success).toBe(true);
  });

  it("should accept uppercase address", () => {
    const result = SpaceCreationContextSchema.safeParse({
      ...validContext,
      address: "0xABCDEF1234567890123456789012345678901234",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid Ethereum address", () => {
    const result = SpaceCreationContextSchema.safeParse({
      ...validContext,
      address: "not-an-address",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short address", () => {
    const result = SpaceCreationContextSchema.safeParse({
      ...validContext,
      address: "0x1234",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing spaceId", () => {
    const { spaceId, ...rest } = validContext;
    expect(SpaceCreationContextSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing address", () => {
    const { address, ...rest } = validContext;
    expect(SpaceCreationContextSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing chainId", () => {
    const { chainId, ...rest } = validContext;
    expect(SpaceCreationContextSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing host", () => {
    const { host, ...rest } = validContext;
    expect(SpaceCreationContextSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject negative chainId", () => {
    const result = SpaceCreationContextSchema.safeParse({
      ...validContext,
      chainId: -1,
    });
    expect(result.success).toBe(false);
  });

  it("should reject zero chainId", () => {
    const result = SpaceCreationContextSchema.safeParse({
      ...validContext,
      chainId: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid host URL", () => {
    const result = SpaceCreationContextSchema.safeParse({
      ...validContext,
      host: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("SpaceCreationHandlerSchema", () => {
  it("should accept handler with only confirmSpaceCreation", () => {
    const handler = {
      confirmSpaceCreation: async () => true,
    };
    const result = SpaceCreationHandlerSchema.safeParse(handler);
    expect(result.success).toBe(true);
  });

  it("should accept handler with all methods", () => {
    const handler = {
      confirmSpaceCreation: async () => true,
      onSpaceCreated: () => {},
      onSpaceCreationFailed: () => {},
    };
    const result = SpaceCreationHandlerSchema.safeParse(handler);
    expect(result.success).toBe(true);
  });

  it("should reject non-function confirmSpaceCreation", () => {
    const handler = {
      confirmSpaceCreation: "not a function",
    };
    const result = SpaceCreationHandlerSchema.safeParse(handler);
    expect(result.success).toBe(false);
  });

  it("should reject missing confirmSpaceCreation", () => {
    const handler = {
      onSpaceCreated: () => {},
    };
    const result = SpaceCreationHandlerSchema.safeParse(handler);
    expect(result.success).toBe(false);
  });

  it("should reject non-function onSpaceCreated", () => {
    const handler = {
      confirmSpaceCreation: async () => true,
      onSpaceCreated: "not a function",
    };
    const result = SpaceCreationHandlerSchema.safeParse(handler);
    expect(result.success).toBe(false);
  });

  it("should reject non-function onSpaceCreationFailed", () => {
    const handler = {
      confirmSpaceCreation: async () => true,
      onSpaceCreationFailed: "not a function",
    };
    const result = SpaceCreationHandlerSchema.safeParse(handler);
    expect(result.success).toBe(false);
  });
});

describe("validateSpaceCreationContext", () => {
  it("should return ok result for valid context", () => {
    const result = validateSpaceCreationContext({
      spaceId: "space-123",
      address: "0x1234567890123456789012345678901234567890",
      chainId: 1,
      host: "https://node.tinycloud.xyz",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.spaceId).toBe("space-123");
    }
  });

  it("should return error result for invalid context", () => {
    const result = validateSpaceCreationContext({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.service).toBe("authorization");
    }
  });
});

describe("validateSpaceCreationHandler", () => {
  it("should return ok result for valid handler", () => {
    const result = validateSpaceCreationHandler({
      confirmSpaceCreation: async () => true,
    });
    expect(result.ok).toBe(true);
  });

  it("should return error result for invalid handler", () => {
    const result = validateSpaceCreationHandler({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
