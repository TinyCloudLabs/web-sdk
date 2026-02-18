import { Command } from "commander";
import { ProfileManager } from "../config/profiles.js";
import { outputJson } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";
import { ensureAuthenticated } from "../lib/sdk.js";

export function registerSpaceCommand(program: Command): void {
  const space = program.command("space").description("Space management");

  space
    .command("list")
    .description("List spaces")
    .action(async (_options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const result = await node.spaces.list();
        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }
        outputJson({ spaces: result.data, count: result.data.length });
      } catch (error) {
        handleError(error);
      }
    });

  space
    .command("create <name>")
    .description("Create a new space")
    .action(async (name: string, _options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const result = await node.spaces.create(name);
        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }
        outputJson({ spaceId: result.data.id, name });
      } catch (error) {
        handleError(error);
      }
    });

  space
    .command("info [space-id]")
    .description("Get space info")
    .action(async (spaceId: string | undefined, _options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const targetId = spaceId ?? node.spaceId;
        if (!targetId) {
          throw new CLIError("NO_SPACE", "No space ID specified and no active space", ExitCode.ERROR);
        }

        const profile = await ProfileManager.getProfile(ctx.profile);
        outputJson({
          spaceId: targetId,
          name: profile.spaceName,
          owner: node.did,
          host: ctx.host,
        });
      } catch (error) {
        handleError(error);
      }
    });

  space
    .command("switch <name>")
    .description("Switch active space")
    .action(async (name: string, _options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);

        const profile = await ProfileManager.getProfile(ctx.profile);
        await ProfileManager.setProfile(ctx.profile, { ...profile, spaceName: name });

        outputJson({ profile: ctx.profile, spaceName: name, switched: true });
      } catch (error) {
        handleError(error);
      }
    });
}
