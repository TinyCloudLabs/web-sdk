#!/usr/bin/env bun
/**
 * TinyCloud Key Generator
 *
 * Generates a new Ed25519 session key and outputs it as a base64-encoded JWK.
 * Use this to create keys for environment variables.
 *
 * Usage:
 *   bun run keygen            # Generate a new key
 *   bun run keygen alice      # Generate with custom key ID
 *
 * Output can be used directly as an environment variable:
 *   export TINYCLOUD_KEY_ALICE=$(bun run keygen alice)
 */

import {
  TCWSessionManager,
  exportKeyAsBase64,
  initPanicHook,
} from "@tinycloudlabs/node-sdk-wasm";

initPanicHook();

const keyId = process.argv[2] || "default";

const manager = new TCWSessionManager();
// The constructor creates a "default" key
// If a different key ID is requested, create a new key with that ID
// and remove the default one for cleaner output
if (keyId !== "default") {
  manager.createSessionKey(keyId);
}

const base64Key = exportKeyAsBase64(manager, keyId);
const did = manager.getDID(keyId);

// Parse the JWK to show details
const jwk = JSON.parse(Buffer.from(base64Key, "base64").toString("utf-8"));

console.log("=".repeat(60));
console.log("TinyCloud Session Key Generated");
console.log("=".repeat(60));
console.log();
console.log(`Key ID:  ${keyId}`);
console.log(`DID:     ${did}`);
console.log(`Curve:   ${jwk.crv}`);
console.log();
console.log("Base64-encoded JWK (for environment variables):");
console.log("-".repeat(60));
console.log(base64Key);
console.log("-".repeat(60));
console.log();
console.log("Example usage:");
console.log(`  export TINYCLOUD_KEY_${keyId.toUpperCase().replace(/-/g, "_")}="${base64Key}"`);
console.log();
