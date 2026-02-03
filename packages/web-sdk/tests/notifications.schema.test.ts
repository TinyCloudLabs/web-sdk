/**
 * Tests for notification type Zod schemas.
 */

import { describe, it, expect } from "bun:test";
import {
  ToastTypeSchema,
  ToastPositionSchema,
  ToastActionSchema,
  ToastSchema,
  ToastConfigSchema,
  NotificationConfigSchema,
  SDKErrorDetailSchema,
  SDKEventDetailSchema,
  SpaceCreationModalOptionsSchema,
  SpaceCreationResultSchema,
  validateToast,
  validateToastConfig,
  validateNotificationConfig,
  validateSpaceCreationModalOptions,
  validateSpaceCreationResult,
  validateSDKErrorDetail,
} from "../src/notifications/types.schema.js";

// =============================================================================
// ToastType Tests
// =============================================================================

describe("ToastTypeSchema", () => {
  it("should validate success type", () => {
    const result = ToastTypeSchema.safeParse("success");
    expect(result.success).toBe(true);
  });

  it("should validate error type", () => {
    const result = ToastTypeSchema.safeParse("error");
    expect(result.success).toBe(true);
  });

  it("should validate warning type", () => {
    const result = ToastTypeSchema.safeParse("warning");
    expect(result.success).toBe(true);
  });

  it("should validate info type", () => {
    const result = ToastTypeSchema.safeParse("info");
    expect(result.success).toBe(true);
  });

  it("should validate loading type", () => {
    const result = ToastTypeSchema.safeParse("loading");
    expect(result.success).toBe(true);
  });

  it("should reject invalid type", () => {
    const result = ToastTypeSchema.safeParse("invalid");
    expect(result.success).toBe(false);
  });

  it("should reject non-string", () => {
    const result = ToastTypeSchema.safeParse(123);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// ToastPosition Tests
// =============================================================================

describe("ToastPositionSchema", () => {
  const positions = [
    "top-left",
    "top-center",
    "top-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ];

  positions.forEach((position) => {
    it(`should validate ${position}`, () => {
      const result = ToastPositionSchema.safeParse(position);
      expect(result.success).toBe(true);
    });
  });

  it("should reject invalid position", () => {
    const result = ToastPositionSchema.safeParse("middle");
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// ToastAction Tests
// =============================================================================

describe("ToastActionSchema", () => {
  it("should validate action with label and onClick", () => {
    const result = ToastActionSchema.safeParse({
      label: "Retry",
      onClick: () => {},
    });
    expect(result.success).toBe(true);
  });

  it("should reject action without label", () => {
    const result = ToastActionSchema.safeParse({
      onClick: () => {},
    });
    expect(result.success).toBe(false);
  });

  it("should reject action without onClick", () => {
    const result = ToastActionSchema.safeParse({
      label: "Retry",
    });
    expect(result.success).toBe(false);
  });

  it("should reject action with non-function onClick", () => {
    const result = ToastActionSchema.safeParse({
      label: "Retry",
      onClick: "not-a-function",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Toast Tests
// =============================================================================

describe("ToastSchema", () => {
  const validToast = {
    id: "toast-1",
    type: "success",
    title: "Operation completed",
    timestamp: Date.now(),
  };

  it("should validate minimal toast", () => {
    const result = ToastSchema.safeParse(validToast);
    expect(result.success).toBe(true);
  });

  it("should validate toast with description", () => {
    const result = ToastSchema.safeParse({
      ...validToast,
      description: "Your file has been saved.",
    });
    expect(result.success).toBe(true);
  });

  it("should validate toast with duration", () => {
    const result = ToastSchema.safeParse({
      ...validToast,
      duration: 5000,
    });
    expect(result.success).toBe(true);
  });

  it("should validate toast with action", () => {
    const result = ToastSchema.safeParse({
      ...validToast,
      action: {
        label: "Undo",
        onClick: () => {},
      },
    });
    expect(result.success).toBe(true);
  });

  it("should validate toast with all fields", () => {
    const result = ToastSchema.safeParse({
      id: "toast-1",
      type: "error",
      title: "Operation failed",
      description: "Something went wrong.",
      duration: 10000,
      action: {
        label: "Retry",
        onClick: () => {},
      },
      timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it("should reject toast without id", () => {
    const { id, ...incomplete } = validToast;
    const result = ToastSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject toast without type", () => {
    const { type, ...incomplete } = validToast;
    const result = ToastSchema.safeParse(incomplete);
    expect(result.success).toBe(false);
  });

  it("should reject toast with invalid type", () => {
    const result = ToastSchema.safeParse({
      ...validToast,
      type: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// ToastConfig Tests
// =============================================================================

describe("ToastConfigSchema", () => {
  it("should validate empty config", () => {
    const result = ToastConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate config with position", () => {
    const result = ToastConfigSchema.safeParse({ position: "top-right" });
    expect(result.success).toBe(true);
  });

  it("should validate config with duration", () => {
    const result = ToastConfigSchema.safeParse({ duration: 3000 });
    expect(result.success).toBe(true);
  });

  it("should validate config with maxVisible", () => {
    const result = ToastConfigSchema.safeParse({ maxVisible: 5 });
    expect(result.success).toBe(true);
  });

  it("should validate full config", () => {
    const result = ToastConfigSchema.safeParse({
      position: "bottom-center",
      duration: 5000,
      maxVisible: 3,
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid position", () => {
    const result = ToastConfigSchema.safeParse({ position: "invalid" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// NotificationConfig Tests
// =============================================================================

describe("NotificationConfigSchema", () => {
  it("should validate empty config", () => {
    const result = NotificationConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("should validate config with popups", () => {
    const result = NotificationConfigSchema.safeParse({ popups: true });
    expect(result.success).toBe(true);
  });

  it("should validate config with throwErrors", () => {
    const result = NotificationConfigSchema.safeParse({ throwErrors: false });
    expect(result.success).toBe(true);
  });

  it("should validate full config", () => {
    const result = NotificationConfigSchema.safeParse({
      popups: true,
      throwErrors: true,
      position: "top-right",
      duration: 4000,
      maxVisible: 5,
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-boolean popups", () => {
    const result = NotificationConfigSchema.safeParse({ popups: "true" });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SDKErrorDetail Tests
// =============================================================================

describe("SDKErrorDetailSchema", () => {
  it("should validate minimal error detail", () => {
    const result = SDKErrorDetailSchema.safeParse({
      category: "storage",
      message: "Failed to save",
    });
    expect(result.success).toBe(true);
  });

  it("should validate error detail with description", () => {
    const result = SDKErrorDetailSchema.safeParse({
      category: "auth",
      message: "Session expired",
      description: "Please sign in again.",
    });
    expect(result.success).toBe(true);
  });

  it("should reject error without category", () => {
    const result = SDKErrorDetailSchema.safeParse({
      message: "Error",
    });
    expect(result.success).toBe(false);
  });

  it("should reject error without message", () => {
    const result = SDKErrorDetailSchema.safeParse({
      category: "unknown",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SDKEventDetail Tests
// =============================================================================

describe("SDKEventDetailSchema", () => {
  it("should validate minimal event detail", () => {
    const result = SDKEventDetailSchema.safeParse({
      message: "File saved",
    });
    expect(result.success).toBe(true);
  });

  it("should validate event detail with description", () => {
    const result = SDKEventDetailSchema.safeParse({
      message: "Upload complete",
      description: "Your file is now available.",
    });
    expect(result.success).toBe(true);
  });

  it("should reject event without message", () => {
    const result = SDKEventDetailSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SpaceCreationModalOptions Tests
// =============================================================================

describe("SpaceCreationModalOptionsSchema", () => {
  it("should validate options with onCreateSpace", () => {
    const result = SpaceCreationModalOptionsSchema.safeParse({
      onCreateSpace: async () => {},
    });
    expect(result.success).toBe(true);
  });

  it("should validate options with onDismiss", () => {
    const result = SpaceCreationModalOptionsSchema.safeParse({
      onCreateSpace: async () => {},
      onDismiss: () => {},
    });
    expect(result.success).toBe(true);
  });

  it("should reject options without onCreateSpace", () => {
    const result = SpaceCreationModalOptionsSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("should reject non-function onCreateSpace", () => {
    const result = SpaceCreationModalOptionsSchema.safeParse({
      onCreateSpace: "not-a-function",
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// SpaceCreationResult Tests
// =============================================================================

describe("SpaceCreationResultSchema", () => {
  it("should validate success result", () => {
    const result = SpaceCreationResultSchema.safeParse({
      success: true,
      dismissed: false,
    });
    expect(result.success).toBe(true);
  });

  it("should validate dismissed result", () => {
    const result = SpaceCreationResultSchema.safeParse({
      success: false,
      dismissed: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject result without success", () => {
    const result = SpaceCreationResultSchema.safeParse({
      dismissed: false,
    });
    expect(result.success).toBe(false);
  });

  it("should reject result without dismissed", () => {
    const result = SpaceCreationResultSchema.safeParse({
      success: true,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// Validation Helper Tests
// =============================================================================

describe("validateToast", () => {
  it("should return success for valid toast", () => {
    const result = validateToast({
      id: "toast-1",
      type: "success",
      title: "Done",
      timestamp: Date.now(),
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid toast", () => {
    const result = validateToast({ id: "toast-1" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("validateToastConfig", () => {
  it("should return success for valid config", () => {
    const result = validateToastConfig({ position: "top-right" });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid config", () => {
    const result = validateToastConfig({ position: "invalid" });
    expect(result.ok).toBe(false);
  });
});

describe("validateNotificationConfig", () => {
  it("should return success for valid config", () => {
    const result = validateNotificationConfig({ popups: true });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid config", () => {
    const result = validateNotificationConfig({ popups: "not-boolean" });
    expect(result.ok).toBe(false);
  });
});

describe("validateSpaceCreationModalOptions", () => {
  it("should return success for valid options", () => {
    const result = validateSpaceCreationModalOptions({
      onCreateSpace: async () => {},
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid options", () => {
    const result = validateSpaceCreationModalOptions({});
    expect(result.ok).toBe(false);
  });
});

describe("validateSpaceCreationResult", () => {
  it("should return success for valid result", () => {
    const result = validateSpaceCreationResult({
      success: true,
      dismissed: false,
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid result", () => {
    const result = validateSpaceCreationResult({ success: true });
    expect(result.ok).toBe(false);
  });
});

describe("validateSDKErrorDetail", () => {
  it("should return success for valid error detail", () => {
    const result = validateSDKErrorDetail({
      category: "storage",
      message: "Error",
    });
    expect(result.ok).toBe(true);
  });

  it("should return error for invalid error detail", () => {
    const result = validateSDKErrorDetail({ category: "storage" });
    expect(result.ok).toBe(false);
  });
});
