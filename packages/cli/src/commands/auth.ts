import { Command } from "commander";
import { createInterface } from "node:readline";
import { ProfileManager } from "../config/profiles.js";
import { outputJson, shouldOutputJson, formatField, isInteractive, withSpinner } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode, DEFAULT_CHAIN_ID } from "../config/constants.js";
import { startAuthFlow } from "../auth/browser-auth.js";
import {
  generateLocalIdentity,
  deriveAddress,
  addressToDID,
  localKeySignIn,
  generateKey,
} from "../auth/local-key.js";
import { theme } from "../output/theme.js";
import type { AuthMethod } from "../config/types.js";

/**
 * Prompt user to choose an auth method interactively.
 * Returns "local" for non-interactive (CI/headless) environments.
 */
async function promptAuthMethod(): Promise<AuthMethod> {
  if (!isInteractive()) {
    return "local";
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stderr,
  });

  return new Promise<AuthMethod>((resolve) => {
    process.stderr.write("\n" + theme.heading("Choose authentication method:") + "\n");
    process.stderr.write(`  ${theme.accent("1)")} OpenKey ${theme.muted("(browser-based, for interactive use)")}\n`);
    process.stderr.write(`  ${theme.accent("2)")} Local key ${theme.muted("(Ethereum private key, for agents/CI)")}\n\n`);

    rl.question("Enter choice (1 or 2): ", (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (trimmed === "2" || trimmed.toLowerCase() === "local") {
        resolve("local");
      } else {
        resolve("openkey");
      }
    });
  });
}

export function registerAuthCommand(program: Command): void {
  const auth = program.command("auth").description("Authentication management");

  auth
    .command("login")
    .description("Authenticate with TinyCloud")
    .option("--paste", "Use manual paste mode instead of browser callback")
    .option("--method <method>", "Authentication method: local or openkey")
    .action(async (options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);

        // Determine auth method
        let method: AuthMethod;
        if (options.method) {
          if (options.method !== "local" && options.method !== "openkey") {
            throw new CLIError(
              "INVALID_METHOD",
              `Invalid auth method "${options.method}". Use "local" or "openkey".`,
              ExitCode.USAGE_ERROR,
            );
          }
          method = options.method;
        } else {
          method = await promptAuthMethod();
        }

        if (method === "local") {
          await handleLocalAuth(ctx.profile, ctx.host);
        } else {
          await handleOpenKeyAuth(ctx.profile, ctx.host, options.paste);
        }
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

        const authenticated = session !== null;

        if (shouldOutputJson()) {
          outputJson({
            authenticated,
            did: profile?.did ?? null,
            primaryDid: profile?.primaryDid ?? null,
            spaceId: profile?.spaceId ?? null,
            host: ctx.host,
            profile: ctx.profile,
            hasKey: hasKey !== null,
            authMethod: profile?.authMethod ?? null,
            address: profile?.address ?? null,
          });
        } else {
          process.stdout.write(theme.heading("Authentication Status") + "\n");
          process.stdout.write(formatField("Profile", ctx.profile) + "\n");
          process.stdout.write(formatField("Authenticated", authenticated) + "\n");
          process.stdout.write(formatField("Auth Method", profile?.authMethod ?? null) + "\n");
          process.stdout.write(formatField("Host", ctx.host) + "\n");
          process.stdout.write(formatField("DID", profile?.did ?? null) + "\n");
          process.stdout.write(formatField("Primary DID", profile?.primaryDid ?? null) + "\n");
          process.stdout.write(formatField("Address", profile?.address ?? null) + "\n");
          process.stdout.write(formatField("Space ID", profile?.spaceId ?? null) + "\n");
          process.stdout.write(formatField("Has Key", hasKey !== null) + "\n");
        }
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
        const authenticated = session !== null;

        if (shouldOutputJson()) {
          outputJson({
            profile: ctx.profile,
            did: profile.did,
            primaryDid: profile.primaryDid ?? null,
            spaceId: profile.spaceId ?? null,
            host: profile.host,
            authenticated,
            authMethod: profile.authMethod ?? null,
            address: profile.address ?? null,
          });
        } else {
          process.stdout.write(theme.heading("Identity") + "\n");
          process.stdout.write(formatField("Profile", ctx.profile) + "\n");
          process.stdout.write(formatField("DID", profile.did) + "\n");
          process.stdout.write(formatField("Primary DID", profile.primaryDid ?? null) + "\n");
          process.stdout.write(formatField("Auth Method", profile.authMethod ?? null) + "\n");
          process.stdout.write(formatField("Address", profile.address ?? null) + "\n");
          process.stdout.write(formatField("Space ID", profile.spaceId ?? null) + "\n");
          process.stdout.write(formatField("Host", profile.host) + "\n");
          process.stdout.write(formatField("Authenticated", authenticated) + "\n");
        }
      } catch (error) {
        handleError(error);
      }
    });
}

/**
 * Handle local Ethereum key authentication.
 * Generates or reuses a local private key, creates a did:pkh identity,
 * and signs in to TinyCloud directly (no browser needed).
 */
async function handleLocalAuth(profileName: string, host: string): Promise<void> {
  const profile = await ProfileManager.getProfile(profileName).catch(() => null);

  let privateKey: string;
  let address: string;
  let did: string;

  if (profile?.authMethod === "local" && profile.privateKey && profile.address) {
    // Reuse existing local key
    privateKey = profile.privateKey;
    address = profile.address;
    did = profile.did;

    if (isInteractive()) {
      process.stderr.write(theme.muted("Using existing local key") + "\n");
      process.stderr.write(formatField("Address", address) + "\n");
    }
  } else {
    // Generate new local identity
    const identity = await withSpinner("Generating Ethereum key...", async () => {
      return generateLocalIdentity(DEFAULT_CHAIN_ID);
    });

    privateKey = identity.privateKey;
    address = identity.address;
    did = identity.did;

    if (isInteractive()) {
      process.stderr.write("\n" + theme.heading("Local Key Generated") + "\n");
      process.stderr.write(formatField("Address", address) + "\n");
      process.stderr.write(formatField("DID", did) + "\n\n");
    }
  }

  // We also need a session key (Ed25519 JWK) for the profile
  const hasKey = await ProfileManager.getKey(profileName);
  if (!hasKey) {
    const { jwk } = await withSpinner("Generating session key...", async () => {
      return generateKey();
    });
    await ProfileManager.setKey(profileName, jwk);
  }

  // Sign in using the private key
  const sessionResult = await withSpinner("Signing in...", async () => {
    return localKeySignIn({ privateKey, host });
  });

  // Store session data
  await ProfileManager.setSession(profileName, {
    authMethod: "local",
    address,
    chainId: DEFAULT_CHAIN_ID,
    spaceId: sessionResult.spaceId,
  });

  // Update profile
  await ProfileManager.setProfile(profileName, {
    name: profileName,
    host,
    chainId: DEFAULT_CHAIN_ID,
    spaceName: "default",
    did,
    primaryDid: did,
    spaceId: sessionResult.spaceId,
    createdAt: profile?.createdAt ?? new Date().toISOString(),
    authMethod: "local",
    privateKey,
    address,
  });

  outputJson({
    authenticated: true,
    profile: profileName,
    did,
    address,
    spaceId: sessionResult.spaceId,
    authMethod: "local",
  });
}

/**
 * Handle OpenKey (browser-based) authentication.
 * This is the original auth flow.
 */
async function handleOpenKeyAuth(profileName: string, host: string, paste?: boolean): Promise<void> {
  const key = await ProfileManager.getKey(profileName);
  if (!key) {
    throw new CLIError(
      "NO_KEY",
      `No key found for profile "${profileName}". Run \`tc init\` first.`,
      ExitCode.AUTH_REQUIRED,
    );
  }

  // Get DID from profile
  const profile = await ProfileManager.getProfile(profileName);

  // Start browser auth flow
  const delegationData = await startAuthFlow(profile.did, {
    paste,
    jwk: key,
    host,
  });

  // Store session
  await ProfileManager.setSession(profileName, delegationData);

  // Update profile with primary DID if present
  const updatedProfile = {
    ...profile,
    authMethod: "openkey" as const,
  };

  if (delegationData.spaceId) {
    updatedProfile.spaceId = delegationData.spaceId;
    updatedProfile.primaryDid = delegationData.primaryDid as string | undefined;
  }

  await ProfileManager.setProfile(profileName, updatedProfile);

  outputJson({
    authenticated: true,
    profile: profileName,
    did: profile.did,
    spaceId: delegationData.spaceId,
    authMethod: "openkey",
  });
}
