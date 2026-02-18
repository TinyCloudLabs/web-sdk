import { Command } from "commander";
import { createInterface } from "node:readline";
import { ProfileManager } from "../config/profiles.js";
import { outputJson, isInteractive } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";
import { generateKey } from "../auth/local-key.js";

export function registerProfileCommand(program: Command): void {
  const profile = program.command("profile").description("Profile management");

  profile
    .command("list")
    .description("List all profiles")
    .action(async (_options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const config = await ProfileManager.getConfig();
        const names = await ProfileManager.listProfiles();

        const profiles = await Promise.all(
          names.map(async (name) => {
            try {
              const p = await ProfileManager.getProfile(name);
              return {
                name: p.name,
                host: p.host,
                did: p.did,
                active: name === config.defaultProfile,
              };
            } catch {
              return { name, host: null, did: null, active: name === config.defaultProfile };
            }
          })
        );

        outputJson({
          profiles,
          defaultProfile: config.defaultProfile,
        });
      } catch (error) {
        handleError(error);
      }
    });

  profile
    .command("create <name>")
    .description("Create a new profile")
    .option("--host <url>", "TinyCloud node URL")
    .action(async (name: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const host = options.host ?? globalOpts.host ?? "https://node.tinycloud.xyz";

        if (await ProfileManager.profileExists(name)) {
          throw new CLIError("PROFILE_EXISTS", `Profile "${name}" already exists`, ExitCode.ERROR);
        }

        await ProfileManager.ensureConfigDir();
        const { jwk, did } = generateKey();
        await ProfileManager.setKey(name, jwk);
        await ProfileManager.setProfile(name, {
          name,
          host,
          chainId: 1,
          spaceName: "default",
          did,
          createdAt: new Date().toISOString(),
        });

        outputJson({ profile: name, did, host, created: true });
      } catch (error) {
        handleError(error);
      }
    });

  profile
    .command("show [name]")
    .description("Show profile details")
    .action(async (name: string | undefined, _options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const profileName = name ?? ctx.profile;

        const p = await ProfileManager.getProfile(profileName);
        const hasKey = (await ProfileManager.getKey(profileName)) !== null;
        const hasSession = (await ProfileManager.getSession(profileName)) !== null;
        const config = await ProfileManager.getConfig();

        outputJson({
          ...p,
          hasKey,
          hasSession,
          isDefault: profileName === config.defaultProfile,
        });
      } catch (error) {
        handleError(error);
      }
    });

  profile
    .command("switch <name>")
    .description("Set default profile")
    .action(async (name: string, _options, cmd) => {
      try {
        if (!(await ProfileManager.profileExists(name))) {
          throw new CLIError("PROFILE_NOT_FOUND", `Profile "${name}" does not exist`, ExitCode.NOT_FOUND);
        }

        const config = await ProfileManager.getConfig();
        await ProfileManager.setConfig({ ...config, defaultProfile: name });

        outputJson({ defaultProfile: name, switched: true });
      } catch (error) {
        handleError(error);
      }
    });

  profile
    .command("delete <name>")
    .description("Delete a profile")
    .action(async (name: string, _options, cmd) => {
      try {
        // Confirmation prompt if interactive
        if (isInteractive()) {
          const rl = createInterface({ input: process.stdin, output: process.stderr });
          const answer = await new Promise<string>((resolve) => {
            rl.question(`Delete profile "${name}"? This cannot be undone. [y/N] `, resolve);
          });
          rl.close();
          if (answer.toLowerCase() !== "y") {
            outputJson({ profile: name, deleted: false, reason: "Cancelled by user" });
            return;
          }
        }

        await ProfileManager.deleteProfile(name);
        outputJson({ profile: name, deleted: true });
      } catch (error) {
        handleError(error);
      }
    });
}
