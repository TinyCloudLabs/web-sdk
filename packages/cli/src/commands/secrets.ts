import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { ProfileManager } from "../config/profiles.js";
import { outputJson, withSpinner } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";
import { ensureAuthenticated } from "../lib/sdk.js";
import { PrivateKeySigner } from "@tinycloud/node-sdk";

const SECRETS_PREFIX = "secrets/";

/**
 * Read all data from stdin.
 */
async function readStdin(): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Resolve and validate private key from CLI options or environment variable.
 */
function resolvePrivateKey(options: { privateKey?: string }): string {
  const key = options.privateKey || process.env.TC_PRIVATE_KEY;
  if (!key) {
    throw new CLIError(
      "AUTH_REQUIRED",
      "Private key required.",
      ExitCode.AUTH_REQUIRED,
      "Use --private-key <hex> or set the TC_PRIVATE_KEY environment variable.",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new CLIError(
      "INVALID_INPUT",
      "Invalid private key format.",
      ExitCode.INVALID_INPUT,
      "Private key must be a 64-character hex string (without 0x prefix).",
    );
  }
  return key;
}

/**
 * Unlock the vault on a TinyCloudNode instance.
 */
async function unlockVault(
  node: { vault: { unlock(signer: { signMessage(message: string): Promise<string> }): Promise<any> } },
  privateKey: string,
): Promise<void> {
  const signer = new PrivateKeySigner(privateKey);
  const result = await node.vault.unlock(signer);
  if (result && !result.ok) {
    const code = result.error.code;
    if (code === "VAULT_LOCKED" || code === "UNLOCK_FAILED") {
      throw new CLIError("VAULT_LOCKED", "Failed to unlock vault.", ExitCode.VAULT_LOCKED,
        "Check that your private key is correct (--private-key or TC_PRIVATE_KEY).");
    }
    throw new CLIError(code, result.error.message, ExitCode.ERROR);
  }
}

export function registerSecretsCommand(program: Command): void {
  const secrets = program.command("secrets").description("Encrypted secrets management");

  // tc secrets list
  secrets
    .command("list")
    .description("List secrets")
    .option("--space <spaceId>", "Space to list secrets from (for delegated access)")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        // TODO: SDK-level support for targeting a specific space via vault.list().
        // The vault service currently operates on the space bound to the session.
        // When --space is provided, we would need the SDK to accept a spaceId
        // parameter on vault operations or support switching the active space.
        if (options.space) {
          throw new CLIError(
            "NOT_IMPLEMENTED",
            `Listing secrets from a delegated space (${options.space}) is not yet supported at the SDK level. ` +
            "The vault service currently operates on the space bound to the active session. " +
            "SDK support for cross-space vault operations is planned.",
            ExitCode.ERROR,
          );
        }

        const result = await withSpinner("Listing secrets...", () => node.vault.list({ prefix: SECRETS_PREFIX })) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const keys = result.data.data ?? result.data;
        const keyList = Array.isArray(keys) ? keys : [];

        // Strip the secrets/ prefix from key names
        const secretNames = keyList.map((k: string) =>
          typeof k === "string" && k.startsWith(SECRETS_PREFIX) ? k.slice(SECRETS_PREFIX.length) : k
        );

        outputJson({
          secrets: secretNames,
          count: secretNames.length,
          ...(options.space ? { space: options.space } : {}),
        });
      } catch (error) {
        handleError(error);
      }
    });

  // tc secrets get <name>
  secrets
    .command("get <name>")
    .description("Get a secret value")
    .option("--raw", "Output raw value (no JSON wrapping)")
    .option("-o, --output <file>", "Write value to file")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (name: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const vaultKey = `${SECRETS_PREFIX}${name}`;
        const result = await withSpinner(`Getting secret ${name}...`, () => node.vault.get(vaultKey)) as any;

        if (!result.ok) {
          if (result.error.code === "NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `Secret "${name}" not found`, ExitCode.NOT_FOUND);
          }
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const data = result.data.data ?? result.data;

        // Parse the stored payload to extract the value
        let value: string;
        if (typeof data === "string") {
          try {
            const parsed = JSON.parse(data);
            value = parsed.value;
          } catch {
            value = data;
          }
        } else if (data instanceof Uint8Array) {
          try {
            const parsed = JSON.parse(Buffer.from(data).toString("utf-8"));
            value = parsed.value;
          } catch {
            value = Buffer.from(data).toString("utf-8");
          }
        } else {
          value = data.value ?? data;
        }

        if (options.output) {
          await writeFile(options.output, value);
          outputJson({ name, written: options.output });
          return;
        }

        if (options.raw) {
          process.stdout.write(value);
          return;
        }

        outputJson({ name, value });
      } catch (error) {
        handleError(error);
      }
    });

  // tc secrets put <name> [value]
  secrets
    .command("put <name> [value]")
    .description("Store a secret")
    .option("--file <path>", "Read value from file")
    .option("--stdin", "Read value from stdin")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (name: string, value: string | undefined, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        // Determine value source
        let secretValue: string;
        const sources = [value !== undefined, !!options.file, !!options.stdin].filter(Boolean);

        if (sources.length === 0) {
          throw new CLIError("USAGE_ERROR", "Must provide a value, --file, or --stdin", ExitCode.USAGE_ERROR);
        }
        if (sources.length > 1) {
          throw new CLIError("USAGE_ERROR", "Provide only one of: value argument, --file, or --stdin", ExitCode.USAGE_ERROR);
        }

        if (options.file) {
          secretValue = (await readFile(options.file, "utf-8")) as string;
        } else if (options.stdin) {
          secretValue = (await readStdin()).toString("utf-8");
        } else {
          secretValue = value!;
        }

        const payload = JSON.stringify({
          value: secretValue,
          createdAt: new Date().toISOString(),
        });

        const vaultKey = `${SECRETS_PREFIX}${name}`;
        const result = await withSpinner(`Storing secret ${name}...`, () => node.vault.put(vaultKey, payload)) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ name, written: true });
      } catch (error) {
        handleError(error);
      }
    });

  // tc secrets delete <name>
  secrets
    .command("delete <name>")
    .description("Delete a secret")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (name: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const vaultKey = `${SECRETS_PREFIX}${name}`;
        const result = await withSpinner(`Deleting secret ${name}...`, () => node.vault.delete(vaultKey)) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ name, deleted: true });
      } catch (error) {
        handleError(error);
      }
    });

  // tc secrets manage
  secrets
    .command("manage")
    .description("Open the TinyCloud Secrets Manager in your browser")
    .action(async () => {
      try {
        const open = (await import("open")).default;
        await open("https://secrets.tinycloud.xyz");
        outputJson({ opened: "https://secrets.tinycloud.xyz" });
      } catch (error) {
        handleError(error);
      }
    });
}
