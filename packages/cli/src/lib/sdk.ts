import { TinyCloudNode } from "@tinycloud/node-sdk";
import { ProfileManager } from "../config/profiles.js";
import type { CLIContext } from "../config/types.js";
import { CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";

/**
 * Create a TinyCloudNode instance from the current CLI context.
 * Uses the profile's persisted session and key.
 */
export async function createSDKInstance(ctx: CLIContext): Promise<TinyCloudNode> {
  const profile = await ProfileManager.getProfile(ctx.profile);
  const session = await ProfileManager.getSession(ctx.profile);
  const key = await ProfileManager.getKey(ctx.profile);

  if (!key) {
    throw new CLIError(
      "AUTH_REQUIRED",
      `No key found for profile "${ctx.profile}". Run \`tc init\` first.`,
      ExitCode.AUTH_REQUIRED,
    );
  }

  const node = new TinyCloudNode({
    host: ctx.host,
  });

  return node;
}

/**
 * Ensure the user is authenticated.
 * Throws AUTH_REQUIRED if no session exists.
 */
export async function ensureAuthenticated(ctx: CLIContext): Promise<TinyCloudNode> {
  const session = await ProfileManager.getSession(ctx.profile);

  if (!session) {
    throw new CLIError(
      "AUTH_REQUIRED",
      `Not authenticated. Run \`tc auth login\` or \`tc init\` first.`,
      ExitCode.AUTH_REQUIRED,
    );
  }

  // TODO: Check session expiry and prompt for re-auth if interactive

  return createSDKInstance(ctx);
}
