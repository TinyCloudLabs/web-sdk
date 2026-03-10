import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { writeFile } from "node:fs/promises";
import { ProfileManager } from "../config/profiles.js";
import { outputJson, withSpinner } from "../output/formatter.js";
import { handleError, CLIError } from "../output/errors.js";
import { ExitCode } from "../config/constants.js";
import { ensureAuthenticated } from "../lib/sdk.js";
import { PrivateKeySigner, deserializeDelegation } from "@tinycloud/node-sdk";

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

export function registerVaultCommand(program: Command): void {
  const vault = program.command("vault").description("Encrypted vault operations");

  // tc vault unlock
  vault
    .command("unlock")
    .description("Verify vault unlock works")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        outputJson({ unlocked: true });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault put <key> [value]
  vault
    .command("put <key> [value]")
    .description("Encrypt and store a value")
    .option("--file <path>", "Read value from file")
    .option("--stdin", "Read value from stdin")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (key: string, value: string | undefined, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        // Determine value source
        let putValue: string | Uint8Array;
        const sources = [value !== undefined, !!options.file, !!options.stdin].filter(Boolean);

        if (sources.length === 0) {
          throw new CLIError("USAGE_ERROR", "Must provide a value, --file, or --stdin", ExitCode.USAGE_ERROR);
        }
        if (sources.length > 1) {
          throw new CLIError("USAGE_ERROR", "Provide only one of: value argument, --file, or --stdin", ExitCode.USAGE_ERROR);
        }

        if (options.file) {
          putValue = new Uint8Array(await readFile(options.file));
        } else if (options.stdin) {
          putValue = new Uint8Array(await readStdin());
        } else {
          putValue = value!;
        }

        const result = await withSpinner(`Writing ${key}...`, () => node.vault.put(key, putValue)) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ key, written: true });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault get <key>
  vault
    .command("get <key>")
    .description("Decrypt and retrieve a value")
    .option("--raw", "Output raw value (no JSON wrapping)")
    .option("-o, --output <file>", "Write value to file")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (key: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const result = await withSpinner(`Getting ${key}...`, () => node.vault.get(key)) as any;

        if (!result.ok) {
          if (result.error.code === "NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `Key "${key}" not found`, ExitCode.NOT_FOUND);
          }
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const data = result.data.data ?? result.data;

        if (options.output) {
          const content = data instanceof Uint8Array ? Buffer.from(data) : typeof data === "string" ? data : JSON.stringify(data);
          await writeFile(options.output, content);
          outputJson({ key, written: options.output });
          return;
        }

        if (options.raw) {
          const content = data instanceof Uint8Array ? Buffer.from(data) : typeof data === "string" ? data : JSON.stringify(data);
          process.stdout.write(content);
          return;
        }

        outputJson({
          key,
          data: data instanceof Uint8Array ? Buffer.from(data).toString("base64") : data,
        });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault delete <key>
  vault
    .command("delete <key>")
    .description("Delete an encrypted key")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (key: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const result = await withSpinner(`Deleting ${key}...`, () => node.vault.delete(key)) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ key, deleted: true });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault list
  vault
    .command("list")
    .description("List vault keys")
    .option("--prefix <prefix>", "Filter by key prefix")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const listOptions = options.prefix ? { prefix: options.prefix } : undefined;
        const result = await withSpinner("Listing vault keys...", () => node.vault.list(listOptions)) as any;

        if (!result.ok) {
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const keys = result.data.data ?? result.data;
        const keyList = Array.isArray(keys) ? keys : [];

        outputJson({
          keys: keyList,
          count: keyList.length,
          prefix: options.prefix ?? null,
        });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault head <key>
  vault
    .command("head <key>")
    .description("Get metadata for a vault key")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (key: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const result = await withSpinner(`Checking ${key}...`, () => node.vault.head(key)) as any;

        if (!result.ok) {
          if (result.error.code === "NOT_FOUND" || result.error.code === "KEY_NOT_FOUND" || result.error.code === "KV_NOT_FOUND") {
            outputJson({ key, exists: false, metadata: {} });
            return;
          }
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({
          key,
          exists: true,
          metadata: result.data.headers ?? result.data,
        });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault grant <key> --to <did>
  vault
    .command("grant <key>")
    .description("Grant access to a vault key for another user")
    .requiredOption("--to <did>", "Recipient DID (did:pkh:...)")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (key: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const result = await withSpinner(`Granting access to ${key}...`, () =>
          node.vault.grant(key, options.to)
        ) as any;

        if (!result.ok) {
          if (result.error.code === "KEY_NOT_FOUND" || result.error.code === "NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `Key "${key}" not found`, ExitCode.NOT_FOUND);
          }
          if (result.error.code === "PUBLIC_KEY_NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `Could not resolve public key for ${options.to}`, ExitCode.NOT_FOUND,
              "The recipient must have unlocked their vault at least once to publish their public key.");
          }
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ key, grantedTo: options.to, granted: true });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault revoke <key> --from <did>
  vault
    .command("revoke <key>")
    .description("Revoke access to a vault key (rotates key, re-grants remaining)")
    .requiredOption("--from <did>", "DID to revoke (did:pkh:...)")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (key: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const result = await withSpinner(`Revoking access to ${key}...`, () =>
          node.vault.revoke(key, options.from)
        ) as any;

        if (!result.ok) {
          if (result.error.code === "KEY_NOT_FOUND" || result.error.code === "NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `Key "${key}" not found`, ExitCode.NOT_FOUND);
          }
          if (result.error.code === "GRANT_NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `No grant found for ${options.from} on key "${key}"`, ExitCode.NOT_FOUND);
          }
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        outputJson({ key, revokedFrom: options.from, revoked: true });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault list-grants <key>
  vault
    .command("list-grants <key>")
    .description("List DIDs that have been granted access to a key")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (key: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        const result = await withSpinner(`Listing grants for ${key}...`, () =>
          node.vault.listGrants(key)
        ) as any;

        if (!result.ok) {
          if (result.error.code === "KEY_NOT_FOUND" || result.error.code === "NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `Key "${key}" not found`, ExitCode.NOT_FOUND);
          }
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const grants = result.data ?? [];
        outputJson({ key, grants, count: grants.length });
      } catch (error) {
        handleError(error);
      }
    });

  // tc vault get-shared <grantor-did> <key>
  vault
    .command("get-shared <grantor-did> <key>")
    .description("Decrypt a value shared by another user")
    .option("--delegation <json>", "Serialized delegation token (JSON)")
    .option("--delegation-file <path>", "Read delegation token from file")
    .option("--raw", "Output raw value (no JSON wrapping)")
    .option("-o, --output <file>", "Write value to file")
    .option("--private-key <hex>", "Ethereum private key (or set TC_PRIVATE_KEY)")
    .action(async (grantorDid: string, key: string, options, cmd) => {
      try {
        const globalOpts = cmd.optsWithGlobals();
        const ctx = await ProfileManager.resolveContext(globalOpts);
        const privateKey = resolvePrivateKey(options);
        const node = await ensureAuthenticated(ctx, { privateKey });

        await withSpinner("Unlocking vault...", () => unlockVault(node, privateKey));

        // Resolve delegation token
        let delegationJson: string;
        if (options.delegation) {
          delegationJson = options.delegation;
        } else if (options.delegationFile) {
          delegationJson = await readFile(options.delegationFile, "utf-8");
        } else {
          throw new CLIError("USAGE_ERROR",
            "A delegation token is required to access shared data.",
            ExitCode.USAGE_ERROR,
            "Use --delegation <json> or --delegation-file <path>. The grantor must provide a serialized delegation.");
        }

        const delegation = deserializeDelegation(delegationJson.trim());
        const access = await withSpinner("Applying delegation...", () =>
          node.useDelegation(delegation)
        );

        const result = await withSpinner(`Getting shared ${key}...`, () =>
          node.vault.getShared(grantorDid, key, { kv: access.kv })
        ) as any;

        if (!result.ok) {
          if (result.error.code === "NOT_FOUND" || result.error.code === "KEY_NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `Shared key "${key}" not found from ${grantorDid}`, ExitCode.NOT_FOUND);
          }
          if (result.error.code === "GRANT_NOT_FOUND") {
            throw new CLIError("NOT_FOUND", `No grant found for key "${key}" from ${grantorDid}`, ExitCode.NOT_FOUND,
              "The grantor must run `tc vault grant <key> --to <your-did>` first.");
          }
          if (result.error.code === "DECRYPTION_FAILED") {
            throw new CLIError("ERROR", `Failed to decrypt shared key "${key}"`, ExitCode.ERROR,
              "The grant may be stale (key was rotated). Ask the grantor to re-grant access.");
          }
          throw new CLIError(result.error.code, result.error.message, ExitCode.ERROR);
        }

        const data = result.data.value ?? result.data;

        if (options.output) {
          const content = data instanceof Uint8Array ? Buffer.from(data) : typeof data === "string" ? data : JSON.stringify(data);
          await writeFile(options.output, content);
          outputJson({ key, grantor: grantorDid, written: options.output });
          return;
        }

        if (options.raw) {
          const content = data instanceof Uint8Array ? Buffer.from(data) : typeof data === "string" ? data : JSON.stringify(data);
          process.stdout.write(content);
          return;
        }

        outputJson({
          key,
          grantor: grantorDid,
          data: data instanceof Uint8Array ? Buffer.from(data).toString("base64") : data,
        });
      } catch (error) {
        handleError(error);
      }
    });
}
