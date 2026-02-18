import { ExitCode } from "../config/constants.js";
import { outputError } from "./formatter.js";

export class CLIError extends Error {
  constructor(
    public code: string,
    message: string,
    public exitCode: number = ExitCode.ERROR
  ) {
    super(message);
    this.name = "CLIError";
  }
}

export function wrapError(error: unknown): CLIError {
  if (error instanceof CLIError) return error;

  const message = error instanceof Error ? error.message : String(error);

  // Map known error patterns to exit codes
  if (message.includes("Not signed in") || message.includes("AUTH_EXPIRED") || message.includes("Session expired")) {
    return new CLIError("AUTH_REQUIRED", message, ExitCode.AUTH_REQUIRED);
  }
  if (message.includes("NOT_FOUND") || message.includes("KV_NOT_FOUND")) {
    return new CLIError("NOT_FOUND", message, ExitCode.NOT_FOUND);
  }
  if (message.includes("PERMISSION_DENIED")) {
    return new CLIError("PERMISSION_DENIED", message, ExitCode.PERMISSION_DENIED);
  }
  if (message.includes("ECONNREFUSED") || message.includes("ETIMEDOUT") || message.includes("fetch failed")) {
    return new CLIError("NETWORK_ERROR", message, ExitCode.NETWORK_ERROR);
  }

  return new CLIError("ERROR", message, ExitCode.ERROR);
}

export function handleError(error: unknown): never {
  const cliError = wrapError(error);
  outputError(cliError.code, cliError.message);
  process.exit(cliError.exitCode);
}
