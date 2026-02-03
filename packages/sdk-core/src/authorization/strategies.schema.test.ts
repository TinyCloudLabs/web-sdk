/**
 * Tests for SignStrategy schemas.
 */

import { describe, it, expect } from "bun:test";
import {
  SignRequestSchema,
  SignResponseSchema,
  SignRequestTypeSchema,
  AutoSignStrategySchema,
  AutoRejectStrategySchema,
  CallbackStrategySchema,
  EventEmitterStrategySchema,
  SignStrategySchema,
  validateSignStrategy,
  validateSignRequest,
  validateSignResponse,
} from "./strategies.schema";

describe("SignRequestTypeSchema", () => {
  it("should accept valid sign request types", () => {
    expect(SignRequestTypeSchema.safeParse("siwe").success).toBe(true);
    expect(SignRequestTypeSchema.safeParse("message").success).toBe(true);
  });

  it("should reject invalid sign request types", () => {
    expect(SignRequestTypeSchema.safeParse("invalid").success).toBe(false);
    expect(SignRequestTypeSchema.safeParse("").success).toBe(false);
    expect(SignRequestTypeSchema.safeParse(123).success).toBe(false);
  });
});

describe("SignRequestSchema", () => {
  const validRequest = {
    address: "0x1234567890123456789012345678901234567890",
    chainId: 1,
    message: "Sign this message",
    type: "siwe" as const,
  };

  it("should accept valid sign request", () => {
    const result = SignRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
  });

  it("should accept message type", () => {
    const result = SignRequestSchema.safeParse({
      ...validRequest,
      type: "message",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing address", () => {
    const { address, ...rest } = validRequest;
    expect(SignRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing chainId", () => {
    const { chainId, ...rest } = validRequest;
    expect(SignRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing message", () => {
    const { message, ...rest } = validRequest;
    expect(SignRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject missing type", () => {
    const { type, ...rest } = validRequest;
    expect(SignRequestSchema.safeParse(rest).success).toBe(false);
  });

  it("should reject invalid type", () => {
    const result = SignRequestSchema.safeParse({
      ...validRequest,
      type: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("SignResponseSchema", () => {
  it("should accept approved response with signature", () => {
    const result = SignResponseSchema.safeParse({
      approved: true,
      signature: "0xabcdef",
    });
    expect(result.success).toBe(true);
  });

  it("should accept rejected response with reason", () => {
    const result = SignResponseSchema.safeParse({
      approved: false,
      reason: "User cancelled",
    });
    expect(result.success).toBe(true);
  });

  it("should accept minimal response", () => {
    const result = SignResponseSchema.safeParse({
      approved: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing approved field", () => {
    const result = SignResponseSchema.safeParse({
      signature: "0xabcdef",
    });
    expect(result.success).toBe(false);
  });
});

describe("AutoSignStrategySchema", () => {
  it("should accept valid auto-sign strategy", () => {
    const result = AutoSignStrategySchema.safeParse({ type: "auto-sign" });
    expect(result.success).toBe(true);
  });

  it("should reject wrong type", () => {
    const result = AutoSignStrategySchema.safeParse({ type: "auto-reject" });
    expect(result.success).toBe(false);
  });

  it("should reject missing type", () => {
    const result = AutoSignStrategySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("AutoRejectStrategySchema", () => {
  it("should accept valid auto-reject strategy", () => {
    const result = AutoRejectStrategySchema.safeParse({ type: "auto-reject" });
    expect(result.success).toBe(true);
  });

  it("should reject wrong type", () => {
    const result = AutoRejectStrategySchema.safeParse({ type: "auto-sign" });
    expect(result.success).toBe(false);
  });
});

describe("CallbackStrategySchema", () => {
  it("should accept valid callback strategy", () => {
    const handler = async () => ({ approved: true, signature: "0x123" });
    const result = CallbackStrategySchema.safeParse({
      type: "callback",
      handler,
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-function handler", () => {
    const result = CallbackStrategySchema.safeParse({
      type: "callback",
      handler: "not a function",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing handler", () => {
    const result = CallbackStrategySchema.safeParse({
      type: "callback",
    });
    expect(result.success).toBe(false);
  });
});

describe("EventEmitterStrategySchema", () => {
  it("should accept valid event emitter strategy", () => {
    const emitter = new EventTarget();
    const result = EventEmitterStrategySchema.safeParse({
      type: "event-emitter",
      emitter,
    });
    expect(result.success).toBe(true);
  });

  it("should accept with optional timeout", () => {
    const emitter = new EventTarget();
    const result = EventEmitterStrategySchema.safeParse({
      type: "event-emitter",
      emitter,
      timeout: 30000,
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-EventTarget emitter", () => {
    const result = EventEmitterStrategySchema.safeParse({
      type: "event-emitter",
      emitter: "not an event target",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing emitter", () => {
    const result = EventEmitterStrategySchema.safeParse({
      type: "event-emitter",
    });
    expect(result.success).toBe(false);
  });
});

describe("SignStrategySchema", () => {
  it("should accept auto-sign strategy", () => {
    const result = SignStrategySchema.safeParse({ type: "auto-sign" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("auto-sign");
    }
  });

  it("should accept auto-reject strategy", () => {
    const result = SignStrategySchema.safeParse({ type: "auto-reject" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("auto-reject");
    }
  });

  it("should accept callback strategy", () => {
    const handler = async () => ({ approved: true });
    const result = SignStrategySchema.safeParse({ type: "callback", handler });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("callback");
    }
  });

  it("should accept event-emitter strategy", () => {
    const emitter = new EventTarget();
    const result = SignStrategySchema.safeParse({
      type: "event-emitter",
      emitter,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("event-emitter");
    }
  });

  it("should reject unknown strategy type", () => {
    const result = SignStrategySchema.safeParse({ type: "unknown" });
    expect(result.success).toBe(false);
  });
});

describe("validateSignStrategy", () => {
  it("should return ok result for valid strategy", () => {
    const result = validateSignStrategy({ type: "auto-sign" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.type).toBe("auto-sign");
    }
  });

  it("should return error result for invalid strategy", () => {
    const result = validateSignStrategy({ type: "invalid" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.error.service).toBe("authorization");
    }
  });
});

describe("validateSignRequest", () => {
  it("should return ok result for valid request", () => {
    const result = validateSignRequest({
      address: "0x1234567890123456789012345678901234567890",
      chainId: 1,
      message: "Test",
      type: "siwe",
    });
    expect(result.ok).toBe(true);
  });

  it("should return error result for invalid request", () => {
    const result = validateSignRequest({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateSignResponse", () => {
  it("should return ok result for valid response", () => {
    const result = validateSignResponse({ approved: true });
    expect(result.ok).toBe(true);
  });

  it("should return error result for invalid response", () => {
    const result = validateSignResponse({});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});
