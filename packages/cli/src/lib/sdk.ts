import { TinyCloudNode } from "@tinycloud/node-sdk";
import { ProfileManager } from "../config/profiles.js";
import type { CLIContext } from "../config/types.js";
import { CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";

/**
 * Create a TinyCloudNode instance from the current CLI context.
 * Uses the profile's persisted session and key.
 */
export async function createSDKInstance(
  ctx: CLIContext,
  options?: { privateKey?: string }
): Promise<TinyCloudNode> {
  const profile = await ProfileManager.getProfile(ctx.profile);
  const session = await ProfileManager.getSession(ctx.profile) as Record<string, unknown> | null;
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
    privateKey: options?.privateKey,
  });

  if (options?.privateKey) {
    // Sign in with private key (existing behavior)
    await node.signIn();
  } else if (session && session.delegationHeader && session.delegationCid && session.spaceId) {
    // Restore session from stored delegation data (browser auth flow)
    await node.restoreSession({
      delegationHeader: session.delegationHeader as { Authorization: string },
      delegationCid: session.delegationCid as string,
      spaceId: session.spaceId as string,
      jwk: (session.jwk as object) ?? key,
      verificationMethod: (session.verificationMethod as string) ?? profile.did,
      address: session.address as string | undefined,
      chainId: session.chainId as number | undefined,
    });
  }

  return node;
}

/**
 * Ensure the user is authenticated.
 * Throws AUTH_REQUIRED if no session exists.
 */
export async function ensureAuthenticated(
  ctx: CLIContext,
  options?: { privateKey?: string }
): Promise<TinyCloudNode> {
  const session = await ProfileManager.getSession(ctx.profile);

  if (!session) {
    throw new CLIError(
      "AUTH_REQUIRED",
      `Not authenticated. Run \`tc auth login\` or \`tc init\` first.`,
      ExitCode.AUTH_REQUIRED,
    );
  }

  return createSDKInstance(ctx, options);
}
