import { Command } from "commander";
import { ProfileManager } from "../config/profiles.js";
import { outputJson } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";
import { startAuthFlow } from "../auth/browser-auth.js";

export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Authentication management");

  auth
    .command("login")
    .description("Authenticate with OpenKey")
    .option("--paste", "Use manual paste mode instead of browser callback")
    .action(async (options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);

        const key = await ProfileManager.getKey(ctx.profile);
        if (!key) {
          throw new CLIError(
            "NO_KEY",
            `No key found for profile "${ctx.profile}". Run \`tc init\` first.`,
            ExitCode.AUTH_REQUIRED,
          );
        }

        // Get DID from profile
        const profile = await ProfileManager.getProfile(ctx.profile);

        // Start browser auth flow
        const delegationData = await startAuthFlow(profile.did, {
          paste: options.paste,
        });

        // Store session
        await ProfileManager.setSession(ctx.profile, delegationData);

        // Update profile with primary DID if present
        if (delegationData.spaceId) {
          await ProfileManager.setProfile(ctx.profile, {
            ...profile,
            spaceId: delegationData.spaceId,
            primaryDid: delegationData.primaryDid as string | undefined,
          });
        }

        outputJson({
          authenticated: true,
          profile: ctx.profile,
          did: profile.did,
          spaceId: delegationData.spaceId,
        });
      } catch (error) {
        handleError(error);
      }
    });

  auth
    .command("logout")
    .description("Clear session (keep key)")
    .action(async (_options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        await ProfileManager.clearSession(ctx.profile);
        outputJson({ profile: ctx.profile, authenticated: false });
      } catch (error) {
        handleError(error);
      }
    });

  auth
    .command("status")
    .description("Show current authentication state")
    .action(async (_options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);

        const hasKey = await ProfileManager.getKey(ctx.profile);
        const session = await ProfileManager.getSession(ctx.profile);
        let profile;
        try {
          profile = await ProfileManager.getProfile(ctx.profile);
        } catch {
          profile = null;
        }

        outputJson({
          authenticated: session !== null,
          did: profile?.did ?? null,
          primaryDid: profile?.primaryDid ?? null,
          spaceId: profile?.spaceId ?? null,
          host: ctx.host,
          profile: ctx.profile,
          hasKey: hasKey !== null,
        });
      } catch (error) {
        handleError(error);
      }
    });

  auth
    .command("whoami")
    .description("Show identity information")
    .action(async (_options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);

        const profile = await ProfileManager.getProfile(ctx.profile);
        const session = await ProfileManager.getSession(ctx.profile);

        outputJson({
          profile: ctx.profile,
          did: profile.did,
          primaryDid: profile.primaryDid ?? null,
          spaceId: profile.spaceId ?? null,
          host: profile.host,
          authenticated: session !== null,
        });
      } catch (error) {
        handleError(error);
      }
    });
}
