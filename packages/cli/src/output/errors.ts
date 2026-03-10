import { ExitCode } from "../config/constants.js";
import { outputError } from "./formatter.js";

export class CLIError extends Error {
  constructor(
    public code: string,
    message: string,
    public exitCode: number = ExitCode.ERROR,
    public suggestion?: string
  ) {
    super(message);
    this.name = "CLIError";
  }
}

/**
 * Map known error patterns to structured CLIErrors with appropriate
 * exit codes and actionable suggestions.
 */
export function wrapError(error: unknown): CLIError {
  if (error instanceof CLIError) return error;

  const message = error instanceof Error ? error.message : String(error);

  // Auth / session errors
  if (message.includes("Not signed in") || message.includes("AUTH_EXPIRED") || message.includes("Session expired")) {
    return new CLIError("AUTH_REQUIRED", message, ExitCode.AUTH_REQUIRED,
      "Run `tc auth login` or provide --private-key to re-authenticate.");
  }

  // Vault errors
  if (message.includes("VAULT_LOCKED") || message.includes("vault is locked")) {
    return new CLIError("VAULT_LOCKED", "The vault is locked.", ExitCode.VAULT_LOCKED,
      "Unlock the vault first with `tc vault unlock`.");
  }
  if (message.includes("VAULT_UNLOCK_FAILED") || message.includes("Failed to unlock vault")) {
    return new CLIError("VAULT_LOCKED", message, ExitCode.VAULT_LOCKED,
      "Check that your private key is correct (--private-key or TC_PRIVATE_KEY).");
  }

  // Not found
  if (message.includes("NOT_FOUND") || message.includes("KV_NOT_FOUND") || message.includes("KEY_NOT_FOUND")) {
    return new CLIError("NOT_FOUND", message, ExitCode.NOT_FOUND);
  }

  // Permission
  if (message.includes("PERMISSION_DENIED") || message.includes("Unauthorized Action")) {
    return new CLIError("PERMISSION_DENIED", message, ExitCode.PERMISSION_DENIED,
      "You may not have the required capabilities. Check your delegation scope.");
  }

  // Timeout
  if (message.includes("timed out") || message.includes("ETIMEDOUT") || message.includes("AbortError")) {
    return new CLIError("TIMEOUT", message, ExitCode.TIMEOUT,
      "The operation timed out. Check your network connection or try again.");
  }

  // Network errors (expanded patterns)
  if (
    message.includes("ECONNREFUSED") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNRESET") ||
    message.includes("socket hang up") ||
    message.includes("fetch failed") ||
    message.includes("certificate") ||
    message.includes("ERR_INVALID_URL") ||
    message.includes("Failed to check version") ||
    message.includes("Ensure the node is running")
  ) {
    const suggestion = message.includes("ECONNREFUSED")
      ? "Is the TinyCloud node running? Check --host or start the node."
      : message.includes("ENOTFOUND")
      ? "Could not resolve the host. Check your --host URL and network connection."
      : message.includes("certificate")
      ? "SSL/TLS certificate error. Check the node URL or try with http://."
      : "Check your network connection and try again.";
    return new CLIError("NETWORK_ERROR", message, ExitCode.NETWORK_ERROR, suggestion);
  }

  // Invalid private key format
  if (message.includes("Invalid private key") || message.includes("Expected 64 hex")) {
    return new CLIError("INVALID_INPUT", message, ExitCode.INVALID_INPUT,
      "Private key must be a 64-character hex string (without 0x prefix).");
  }

  // Config / profile errors
  if (message.includes("Profile") && (message.includes("does not exist") || message.includes("not found"))) {
    return new CLIError("CONFIG_ERROR", message, ExitCode.CONFIG_ERROR,
      "Run `tc profile list` to see available profiles, or `tc init` to create one.");
  }

  return new CLIError("ERROR", message, ExitCode.ERROR);
}

export function handleError(error: unknown): never {
  const cliError = wrapError(error);
  outputError(cliError.code, cliError.message, cliError.exitCode, cliError.suggestion);
  process.exit(cliError.exitCode);
}
