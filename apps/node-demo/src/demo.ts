#!/usr/bin/env bun
/**
 * TinyCloud Node.js SDK Demo (using node-sdk)
 *
 * Demonstrates the TinyCloud flow using the new node-sdk package:
 * 1. Sign in with NodeUserAuthorization
 * 2. Use TinyCloud for storage operations
 *
 * Prerequisites:
 * - A running TinyCloud server (default: http://localhost:8000)
 * - Optional: Private key via environment variable
 *
 * Environment Variables:
 *   TINYCLOUD_URL              - TinyCloud server URL (default: http://localhost:8000)
 *   TINYCLOUD_PRIVATE_KEY      - Ethereum private key (hex string)
 *
 * Usage:
 *   bun run demo
 */

import { TinyCloud } from "@tinycloudlabs/sdk-core";
import {
  NodeUserAuthorization,
  PrivateKeySigner,
  FileSessionStorage,
} from "@tinycloudlabs/node-sdk";
import { initPanicHook } from "@tinycloudlabs/node-sdk-wasm";

// Initialize WASM panic hook for better error messages
initPanicHook();

// ============================================================================
// Configuration
// ============================================================================

const TINYCLOUD_URL = process.env.TINYCLOUD_URL || "http://localhost:8000";
const DOMAIN = "demo.tinycloud.xyz";

// Demo Ethereum private key (DO NOT USE IN PRODUCTION)
// 32 bytes of deterministic test data
const DEMO_PRIVATE_KEY =
  process.env.TINYCLOUD_PRIVATE_KEY ||
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// ============================================================================
// Helpers
// ============================================================================

function log(section: string, message: string) {
  console.log(`[${section}] ${message}`);
}

function logStep(step: number, title: string) {
  console.log();
  console.log("=".repeat(60));
  console.log(`Step ${step}: ${title}`);
  console.log("=".repeat(60));
}

// ============================================================================
// Demo Flow
// ============================================================================

async function runDemo() {
  console.log();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║        TinyCloud Node.js SDK Demo (node-sdk)               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`TinyCloud URL: ${TINYCLOUD_URL}`);
  console.log(`Domain: ${DOMAIN}`);

  // ========================================================================
  // Step 1: Initialize SDK components
  // ========================================================================
  logStep(1, "Initialize SDK Components");

  // Create signer from private key
  const signer = new PrivateKeySigner(DEMO_PRIVATE_KEY);
  const address = await signer.getAddress();
  log("Signer", `Address: ${address}`);

  // Create session storage (persists to ~/.tinycloud/sessions)
  const sessionStorage = new FileSessionStorage();
  log("Storage", `Session storage initialized`);

  // Create authorization with auto-sign strategy
  const auth = new NodeUserAuthorization({
    signer,
    signStrategy: { type: "auto-sign" },
    sessionStorage,
    domain: DOMAIN,
    namespacePrefix: "demo",
  });
  log("Auth", `NodeUserAuthorization created with auto-sign strategy`);

  // Create TinyCloud instance
  const tc = new TinyCloud({ userAuthorization: auth });
  log("TinyCloud", `Instance created`);

  // ========================================================================
  // Step 2: Check for existing session
  // ========================================================================
  logStep(2, "Check for Existing Session");

  const hasExistingSession = auth.isSessionPersisted(address);
  log("Session", `Existing session found: ${hasExistingSession}`);

  if (hasExistingSession) {
    log("Session", "Attempting to resume existing session...");
    const resumed = await auth.tryResumeSession(address);
    if (resumed) {
      log("Session", `Session resumed! Namespace: ${resumed.namespaceId}`);
    } else {
      log("Session", "Resume failed, will create new session");
    }
  }

  // ========================================================================
  // Step 3: Sign In
  // ========================================================================
  logStep(3, "Sign In");

  if (!auth.session) {
    log("Auth", "Signing in...");
    const session = await tc.signIn();
    log("Auth", `Signed in! Address: ${session.address}`);
    log("Auth", `Namespace: ${session.namespaceId}`);
    log("Auth", `Delegation CID: ${session.delegationCid}`);
  } else {
    log("Auth", "Already signed in from resumed session");
  }

  // ========================================================================
  // Step 4: Display Session Info
  // ========================================================================
  logStep(4, "Session Information");

  const session = auth.session;
  if (session) {
    log("Session", `Address: ${session.address}`);
    log("Session", `Chain ID: ${session.chainId}`);
    log("Session", `Namespace: ${session.namespaceId || "N/A"}`);
    log("Session", `Session Key: ${session.sessionKey}`);
    log(
      "Session",
      `Verification Method: ${session.verificationMethod || "N/A"}`
    );
  }

  // ========================================================================
  // Step 5: Demonstrate Sign Strategies
  // ========================================================================
  logStep(5, "Sign Strategies Demo");

  // Auto-sign strategy (already demonstrated above)
  log("Strategy", "auto-sign: Automatically approved sign-in");

  // Callback strategy example (not executed, just shown)
  log("Strategy", "callback: Would prompt user for approval");
  log("Strategy", "  Example: const approved = await promptUser('Sign?')");

  // Event emitter strategy example (not executed, just shown)
  log("Strategy", "event-emitter: Would emit 'sign-request' event");
  log(
    "Strategy",
    "  Example: emitter.on('sign-request', (req, respond) => ...)"
  );

  // Auto-reject strategy example (not executed, just shown)
  log("Strategy", "auto-reject: Would reject all sign requests");

  // ========================================================================
  // Summary
  // ========================================================================
  console.log();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                      Demo Complete                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("Summary:");
  console.log(`  - Signer address: ${address}`);
  console.log(`  - Namespace: ${session?.namespaceId || "N/A"}`);
  console.log(`  - Sign strategy: auto-sign`);
  console.log(`  - Session persisted: Yes (FileSessionStorage)`);
  console.log();
  console.log("Available sign strategies:");
  console.log("  - auto-sign: Automatic approval (trusted backends)");
  console.log("  - auto-reject: Reject all requests (read-only mode)");
  console.log("  - callback: Custom approval function (CLI prompts)");
  console.log("  - event-emitter: Async approval (external workflows)");
  console.log();
  console.log("To run with a live server:");
  console.log(`  TINYCLOUD_URL=http://your-server:8000 bun run demo`);
  console.log();
  console.log("To use a custom private key:");
  console.log(`  TINYCLOUD_PRIVATE_KEY=your_hex_key bun run demo`);
  console.log();
}

// Run the demo
runDemo().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
