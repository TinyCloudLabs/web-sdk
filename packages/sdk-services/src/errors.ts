/**
 * SDK Services - Error Utilities
 *
 * Utilities for creating and handling service errors.
 */

import { ServiceError, ErrorCodes, err } from "./types";

/**
 * Create a service error for authentication required.
 */
export function authRequiredError(service: string): ServiceError {
  return {
    code: ErrorCodes.AUTH_REQUIRED,
    message: "Authentication required. Please sign in first.",
    service,
  };
}

/**
 * Create a service error for expired authentication.
 */
export function authExpiredError(service: string): ServiceError {
  return {
    code: ErrorCodes.AUTH_EXPIRED,
    message: "Session has expired. Please sign in again.",
    service,
  };
}

/**
 * Create a service error for network issues.
 */
export function networkError(
  service: string,
  message: string,
  cause?: Error
): ServiceError {
  return {
    code: ErrorCodes.NETWORK_ERROR,
    message,
    service,
    cause,
  };
}

/**
 * Create a service error for timeouts.
 */
export function timeoutError(service: string): ServiceError {
  return {
    code: ErrorCodes.TIMEOUT,
    message: "Request timed out.",
    service,
  };
}

/**
 * Create a service error for aborted requests.
 */
export function abortedError(service: string): ServiceError {
  return {
    code: ErrorCodes.ABORTED,
    message: "Request was aborted.",
    service,
  };
}

/**
 * Create a service error for not found resources.
 */
export function notFoundError(
  service: string,
  resource: string
): ServiceError {
  return {
    code: ErrorCodes.NOT_FOUND,
    message: `Resource not found: ${resource}`,
    service,
  };
}

/**
 * Create a service error for permission denied.
 */
export function permissionDeniedError(
  service: string,
  action: string
): ServiceError {
  return {
    code: ErrorCodes.PERMISSION_DENIED,
    message: `Permission denied for action: ${action}`,
    service,
  };
}

/**
 * Wrap an unknown error in a ServiceError.
 */
export function wrapError(
  service: string,
  error: unknown,
  defaultCode: string = ErrorCodes.NETWORK_ERROR
): ServiceError {
  if (error instanceof Error) {
    // Check for abort errors
    if (error.name === "AbortError") {
      return abortedError(service);
    }

    // Check for timeout errors (varies by platform)
    if (
      error.name === "TimeoutError" ||
      error.message.toLowerCase().includes("timeout")
    ) {
      return timeoutError(service);
    }

    return {
      code: defaultCode,
      message: error.message,
      service,
      cause: error,
    };
  }

  return {
    code: defaultCode,
    message: String(error),
    service,
  };
}

/**
 * Create an error Result from a ServiceError.
 */
export function errorResult(error: ServiceError) {
  return err(error);
}
