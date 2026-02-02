/**
 * Zod schemas for TinyCloud notification and modal types.
 *
 * These schemas provide runtime validation for toast notifications,
 * notification configuration, and modal types. Types are derived from
 * schemas using z.infer<>.
 *
 * @packageDocumentation
 */

import { z } from "zod";

// =============================================================================
// Toast Types
// =============================================================================

/**
 * Toast notification type.
 */
export const ToastTypeSchema = z.enum(["success", "error", "warning", "info", "loading"]);
export type ToastType = z.infer<typeof ToastTypeSchema>;

/**
 * Toast position on screen.
 */
export const ToastPositionSchema = z.enum([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
export type ToastPosition = z.infer<typeof ToastPositionSchema>;

/**
 * Action button for a toast notification.
 */
export const ToastActionSchema = z.object({
  label: z.string(),
  onClick: z.function(),
});
export type ToastAction = z.infer<typeof ToastActionSchema>;

/**
 * Toast notification.
 */
export const ToastSchema = z.object({
  id: z.string(),
  type: ToastTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  duration: z.number().optional(),
  action: ToastActionSchema.optional(),
  timestamp: z.number(),
});
export type Toast = z.infer<typeof ToastSchema>;

/**
 * Toast configuration.
 */
export const ToastConfigSchema = z.object({
  position: ToastPositionSchema.optional(),
  duration: z.number().optional(),
  maxVisible: z.number().optional(),
});
export type ToastConfig = z.infer<typeof ToastConfigSchema>;

/**
 * Notification configuration.
 */
export const NotificationConfigSchema = z.object({
  popups: z.boolean().optional(),
  throwErrors: z.boolean().optional(),
  position: ToastPositionSchema.optional(),
  duration: z.number().optional(),
  maxVisible: z.number().optional(),
});
export type NotificationConfig = z.infer<typeof NotificationConfigSchema>;

// =============================================================================
// SDK Event Types
// =============================================================================

/**
 * SDK error detail.
 */
export const SDKErrorDetailSchema = z.object({
  category: z.string(),
  message: z.string(),
  description: z.string().optional(),
});
export type SDKErrorDetail = z.infer<typeof SDKErrorDetailSchema>;

/**
 * SDK event detail.
 */
export const SDKEventDetailSchema = z.object({
  message: z.string(),
  description: z.string().optional(),
});
export type SDKEventDetail = z.infer<typeof SDKEventDetailSchema>;

// =============================================================================
// Modal Types
// =============================================================================

/**
 * Options for the space creation modal.
 */
export const SpaceCreationModalOptionsSchema = z.object({
  /** Async function called when user clicks "Create Space" */
  onCreateSpace: z.function(),
  /** Optional callback when modal is dismissed */
  onDismiss: z.function().optional(),
});
export type SpaceCreationModalOptions = z.infer<typeof SpaceCreationModalOptionsSchema>;

/**
 * Result from the space creation modal.
 */
export const SpaceCreationResultSchema = z.object({
  /** Whether space creation was successful */
  success: z.boolean(),
  /** Whether the modal was dismissed without creating */
  dismissed: z.boolean(),
});
export type SpaceCreationResult = z.infer<typeof SpaceCreationResultSchema>;

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
 * Validates Toast.
 */
export function validateToast(data: unknown): ValidationResult<Toast> {
  const result = ToastSchema.safeParse(data);
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
 * Validates ToastConfig.
 */
export function validateToastConfig(data: unknown): ValidationResult<ToastConfig> {
  const result = ToastConfigSchema.safeParse(data);
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
 * Validates NotificationConfig.
 */
export function validateNotificationConfig(data: unknown): ValidationResult<NotificationConfig> {
  const result = NotificationConfigSchema.safeParse(data);
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
 * Validates SpaceCreationModalOptions.
 */
export function validateSpaceCreationModalOptions(
  data: unknown
): ValidationResult<SpaceCreationModalOptions> {
  const result = SpaceCreationModalOptionsSchema.safeParse(data);
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
 * Validates SpaceCreationResult.
 */
export function validateSpaceCreationResult(data: unknown): ValidationResult<SpaceCreationResult> {
  const result = SpaceCreationResultSchema.safeParse(data);
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
 * Validates SDKErrorDetail.
 */
export function validateSDKErrorDetail(data: unknown): ValidationResult<SDKErrorDetail> {
  const result = SDKErrorDetailSchema.safeParse(data);
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
