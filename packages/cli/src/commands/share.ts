import { Command } from "commander";
import { ProfileManager } from "../config/profiles.js";
import { outputJson } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";
import { ensureAuthenticated } from "../lib/sdk.js";
import { parseExpiry } from "../lib/duration.js";

export function registerShareCommand(program: Command): void {
  const share = program.command("share").description("Share data with others");

  share
    .command("create")
    .description("Create a share link")
    .requiredOption("--path <path>", "KV path scope")
    .option("--actions <actions>", "Comma-separated actions", "kv/get")
    .option("--expiry <duration>", "Expiry duration", "7d")
    .option("--web-link", "Generate a web UI link for non-technical recipients")
    .action(async (options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const actions = options.actions.split(",").map((a: string) => {
          const trimmed = a.trim();
          return trimmed.startsWith("tinycloud.") ? trimmed : `tinycloud.${trimmed}`;
        });

        const expiry = parseExpiry(options.expiry);

        const result = await node.sharing.generate({
          path: options.path,
          actions,
          expiry,
        });

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const output: Record<string, unknown> = {
          token: result.data.token ?? result.data.cid,
          shareData: result.data.encodedData ?? result.data.url,
          path: options.path,
          actions,
          expiry: expiry.toISOString(),
        };

        if (options.webLink) {
          const shareData = result.data.encodedData ?? result.data.url ?? "";
          output.webLink = `https://openkey.cloud/share?data=${encodeURIComponent(shareData)}`;
        }

        outputJson(output);
      } catch (error) {
        handleError(error);
      }
    });

  share
    .command("receive [data]")
    .description("Receive a share")
    .option("--stdin", "Read share data from stdin")
    .action(async (data: string | undefined, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        let shareData: string;
        if (options.stdin) {
          const chunks: Buffer[] = [];
          for await (const chunk of process.stdin) {
            chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
          }
          shareData = Buffer.concat(chunks).toString("utf-8").trim();
        } else if (data) {
          shareData = data;
        } else {
          throw new CLIError("USAGE_ERROR", "Must provide share data or use --stdin", ExitCode.USAGE_ERROR);
        }

        const result = await node.sharing.receive(shareData);
        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({
          received: true,
          spaceId: result.data.spaceId,
          path: result.data.path,
          actions: result.data.actions,
        });
      } catch (error) {
        handleError(error);
      }
    });

  share
    .command("list")
    .description("List active shares")
    .action(async (_options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const result = await node.sharing.list();
        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ shares: result.data, count: result.data.length });
      } catch (error) {
        handleError(error);
      }
    });

  share
    .command("revoke <token>")
    .description("Revoke a share")
    .action(async (token: string, _options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const node = await ensureAuthenticated(ctx);

        const result = await node.sharing.revoke(token);
        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ token, revoked: true });
      } catch (error) {
        handleError(error);
      }
    });
}
