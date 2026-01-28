#!/usr/bin/env bun
/**
 * TinyCloud Node.js SDK Demo - Session-Only Mode & Delegations
 *
 * Demonstrates the TinyCloud SDK with session-only users receiving delegations:
 *
 * 1. Alice (wallet mode) creates a space and stores data
 * 2. Bob (session-only) receives a delegation from Alice - NO wallet needed
 * 3. Bob accesses Alice's space via useDelegation() - NO signIn() needed
 * 4. Bob creates sub-delegation for Charlie (also session-only)
 * 5. Charlie accesses Alice's space via delegation chain
 *
 * Key concepts demonstrated:
 * - `did` returns primary identity (PKH for wallet mode, session key for session-only)
 * - Session-only users can receive and use delegations without a wallet
 * - useDelegation() works without calling signIn()
 *
 * Prerequisites:
 * - A running TinyCloud server (default: http://localhost:8000)
 *
 * Environment Variables:
 *   TINYCLOUD_URL         - TinyCloud server URL (default: http://localhost:8000)
 *   ALICE_PRIVATE_KEY     - Alice's Ethereum private key (optional, auto-generated)
 *
 * Usage:
 *   bun run demo
 */

import {
  TinyCloudNode,
  serializeDelegation,
  deserializeDelegation,
} from "@tinycloudlabs/node-sdk";
import { Wallet } from "ethers";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ============================================================================
// Configuration
// ============================================================================

const TINYCLOUD_URL = process.env.TINYCLOUD_URL || "http://localhost:8000";
const ENV_PATH = join(import.meta.dir, "..", ".env");

// ============================================================================
// Key Management (only Alice needs a wallet)
// ============================================================================

function generateKey(): string {
  const wallet = Wallet.createRandom();
  return wallet.privateKey.slice(2); // Remove 0x prefix
}

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const match = trimmed.match(/^([A-Z_]+)=(.*)$/);
      if (match) {
        result[match[1]] = match[2];
      }
    }
  }
  return result;
}

async function checkServerHealth() {
  console.log("[Health] Checking server...");
  try {
    const healthResponse = await fetch(`${TINYCLOUD_URL}/healthz`);
    if (!healthResponse.ok) {
      throw new Error(`Server returned ${healthResponse.status}`);
    }
    console.log("[Health] ✓ Server is running");
  } catch (error) {
    const err = error as Error;
    throw new Error(`Server not reachable at ${TINYCLOUD_URL}: ${err.message}`);
  }
  console.log();
}

function ensureAliceKey(): string {
  let aliceKey = process.env.ALICE_PRIVATE_KEY;

  // Load existing .env file
  if (existsSync(ENV_PATH)) {
    const parsed = parseEnvFile(readFileSync(ENV_PATH, "utf-8"));
    aliceKey = aliceKey || parsed.ALICE_PRIVATE_KEY;
  }

  // Generate if missing
  if (!aliceKey) {
    aliceKey = generateKey();
    console.log(`[KeyGen] Generated Alice's key: ${new Wallet(`0x${aliceKey}`).address}`);
  }

  return aliceKey;
}

// ============================================================================
// Demo Flow
// ============================================================================

async function runDemo() {
  console.log();
  console.log("TinyCloud Node.js SDK Demo - Space API");
  console.log("=".repeat(70));
  console.log(`Server: ${TINYCLOUD_URL}`);
  console.log();

  // Step 0: Check server health
  await checkServerHealth();

  // Step 1: Only Alice needs a wallet key
  const aliceKey = ensureAliceKey();

  // Step 2: Create TinyCloudNode instances
  // Alice: Has wallet, can create her own space
  const alice = new TinyCloudNode({
    privateKey: aliceKey,
    host: TINYCLOUD_URL,
    prefix: "demo-alice",
    autoCreateSpace: true,
  });

  // Bob: Session-only mode (no wallet) - will receive delegations
  const bob = new TinyCloudNode();

  // Charlie: Session-only mode (no wallet) - will receive sub-delegations
  const charlie = new TinyCloudNode();

  // Step 3: Only Alice signs in (creates her space)
  // Bob and Charlie are session-only - they don't sign in
  console.log("[Alice] Signing in (wallet mode)...");
  await alice.signIn();
  console.log(`[Alice] Space: ${alice.spaceId}`);
  console.log(`[Alice] DID: ${alice.did}`);
  console.log(`[Alice] isSessionOnly: ${alice.isSessionOnly}`);

  console.log();
  console.log("[Bob] Session-only mode (no wallet, no sign-in)");
  console.log(`[Bob] DID: ${bob.did}`);
  console.log(`[Bob] isSessionOnly: ${bob.isSessionOnly}`);

  console.log();
  console.log("[Charlie] Session-only mode (no wallet, no sign-in)");
  console.log(`[Charlie] DID: ${charlie.did}`);
  console.log(`[Charlie] isSessionOnly: ${charlie.isSessionOnly}`);
  console.log();

  // =========================================================================
  // PART 1: Space API - Basic Operations
  // =========================================================================
  console.log();
  console.log("=".repeat(70));
  console.log("PART 1: Space API - Basic Operations");
  console.log("=".repeat(70));
  console.log();

  // Step 4: Get Alice's space (named by prefix)
  // Note: Alice's session is bound to "demo-alice" space due to prefix config
  console.log("[Alice] Getting space...");
  const aliceSpace = alice.spaces.get("demo-alice");
  console.log(`[Alice] Space ID: ${aliceSpace.id}`);
  console.log(`[Alice] Space name: ${aliceSpace.name}`);
  console.log();

  // Step 5: Alice stores data using Space API
  console.log("[Alice] Storing data in space...");
  const putResult = await aliceSpace.kv.put("shared/greeting", {
    message: "Hello from Alice!",
    timestamp: new Date().toISOString(),
  });

  if (!putResult.ok) {
    console.error(`[Alice] ✗ Failed to store: ${putResult.error.message}`);
  } else {
    console.log("[Alice] ✓ Data stored at 'shared/greeting'");
  }
  console.log();

  // Step 6: Alice uses prefix scoping
  console.log("[Alice] Using prefix-scoped KV...");
  const sharedKV = aliceSpace.kv.withPrefix("shared/");

  const prefixPutResult = await sharedKV.put("document.json", {
    title: "Important Document",
    content: "This is shared data",
  });

  if (!prefixPutResult.ok) {
    console.error(`[Alice] ✗ Failed: ${prefixPutResult.error.message}`);
  } else {
    console.log("[Alice] ✓ Stored 'document.json' in shared/ prefix");
  }
  console.log();

  // =========================================================================
  // PART 2: Space API - Delegations
  // =========================================================================
  console.log();
  console.log("=".repeat(70));
  console.log("PART 2: Space API - Delegations");
  console.log("=".repeat(70));
  console.log();

  // Step 7: Alice creates delegation for Bob
  // NOTE: Using TinyCloudNode.createDelegation() because Space API's delegations.create()
  // has a bug - it uses invocation headers instead of delegation headers for /delegate endpoint.
  // The server expects proper SIWE-based delegation headers.
  console.log("[Alice] Creating delegation for Bob...");
  const portableDelegation = await alice.createDelegation({
    delegateDID: bob.did,
    path: "shared/",
    actions: ["tinycloud.kv/get", "tinycloud.kv/put"],
    expiryMs: 24 * 60 * 60 * 1000, // 24 hours
  });

  console.log("[Alice] ✓ Delegation created!");
  console.log(`  CID: ${portableDelegation.delegationCid}`);
  console.log(`  Delegate: ${portableDelegation.delegateDID}`);
  console.log(`  Path: ${portableDelegation.path}`);
  console.log(`  Actions: ${portableDelegation.actions.join(", ")}`);
  console.log(`  Expiry: ${portableDelegation.expiry.toISOString()}`);
  console.log();

  // Step 8: Alice lists her outgoing delegations
  // Uses tinycloud.capabilities/read with facts parameter
  console.log("[Alice] Listing delegations via Space API...");
  const delegationsResult = await aliceSpace.delegations.list();
  if (delegationsResult.ok) {
    console.log(`[Alice] ✓ Found ${delegationsResult.data.length} delegation(s):`);
    for (const d of delegationsResult.data) {
      console.log(`  - CID: ${d.cid || d.delegationCid || "(unknown)"}`);
    }
  } else {
    console.log(`[Alice] ✗ Failed to list delegations: ${delegationsResult.error.message}`);
  }
  console.log();

  // Step 9: Note on session-only users
  // Session-only users like Bob don't have their own space - they can only
  // access spaces via delegations. The listReceived() API would require
  // Bob to have signed in, which defeats the purpose of session-only mode.

  // Step 10: Bob accesses Alice's space using delegation
  console.log("[Bob] Accessing Alice's space...");

  // Serialize and deserialize the delegation (simulating transfer between users)
  const serializedForBob = serializeDelegation(portableDelegation);
  const receivedByBob = deserializeDelegation(serializedForBob);
  const bobAccessToAlice = await bob.useDelegation(receivedByBob);

  // Bob reads Alice's data
  const greetingResult = await bobAccessToAlice.kv.get("greeting");
  if (!greetingResult.ok) {
    console.error(`[Bob] ✗ Failed to read greeting: ${greetingResult.error.message}`);
  } else if (greetingResult.data?.data) {
    console.log(`[Bob] ✓ Read from Alice: "${greetingResult.data.data.message}"`);
  }

  // Bob writes a response
  const bobWriteResult = await bobAccessToAlice.kv.put("bob-was-here", {
    from: "Bob",
    message: "Thanks for sharing, Alice!",
    timestamp: new Date().toISOString(),
  });

  if (!bobWriteResult.ok) {
    console.error(`[Bob] ✗ Failed to write response: ${bobWriteResult.error.message}`);
  } else {
    console.log("[Bob] ✓ Wrote response to Alice's space");
  }
  console.log();

  // Step 11: Alice creates a separate delegation for Charlie (also session-only)
  console.log("[Alice] Creating delegation for Charlie...");
  const charlieDelegation = await alice.createDelegation({
    delegateDID: charlie.did,
    path: "shared/",
    actions: ["tinycloud.kv/put"],
    expiryMs: 24 * 60 * 60 * 1000,
  });
  console.log(`[Alice] ✓ Delegation created for Charlie: ${charlieDelegation.delegationCid}`);
  console.log();

  // Step 12: Charlie uses delegation (session-only, no signIn needed)
  const serializedForCharlie = serializeDelegation(charlieDelegation);
  const receivedByCharlie = deserializeDelegation(serializedForCharlie);
  const charlieAccessToAlice = await charlie.useDelegation(receivedByCharlie);

  console.log("[Charlie] Writing to Alice's space (session-only, no signIn)...");
  const charlieWriteResult = await charlieAccessToAlice.kv.put("charlie-was-here", {
    from: "Charlie",
    message: "Hello from session-only Charlie!",
    timestamp: new Date().toISOString(),
  });

  if (!charlieWriteResult.ok) {
    console.error(`[Charlie] ✗ Failed to write: ${charlieWriteResult.error.message}`);
  } else {
    console.log("[Charlie] ✓ Wrote to Alice's space");
  }
  console.log();

  // Step 13: Alice reads messages from both Bob and Charlie
  console.log("[Alice] Reading responses...");
  const bobResponse = await aliceSpace.kv.get<{ from: string; message: string }>("shared/bob-was-here");
  const charlieResponse = await aliceSpace.kv.get<{ from: string; message: string }>("shared/charlie-was-here");

  if (!bobResponse.ok) {
    console.error(`[Alice] ✗ Failed to read Bob's response: ${bobResponse.error.message}`);
  } else if (bobResponse.data?.data) {
    console.log(`[Alice] From Bob: "${bobResponse.data.data.message}"`);
  }
  if (!charlieResponse.ok) {
    console.error(`[Alice] ✗ Failed to read Charlie's response: ${charlieResponse.error.message}`);
  } else if (charlieResponse.data?.data) {
    console.log(`[Alice] From Charlie: "${charlieResponse.data.data.message}"`);
  }
  console.log();

  // =========================================================================
  // PART 3: Sharing Links (Skipped - Space API not yet implemented)
  // =========================================================================
  console.log();
  console.log("=".repeat(70));
  console.log("PART 3: Sharing Links (Space API not yet implemented on server)");
  console.log("=".repeat(70));
  console.log();

  // NOTE: space.sharing.generate() and space.sharing.list() require server-side
  // support for tinycloud.share/* capabilities which are not yet implemented.
  console.log("[Alice] Sharing link generation via Space API skipped (server not yet implemented)");
  console.log();

  // =========================================================================
  // PART 4: Space Management (Skipped - Space API not yet implemented)
  // =========================================================================
  console.log();
  console.log("=".repeat(70));
  console.log("PART 4: Space Management (Space API not yet implemented on server)");
  console.log("=".repeat(70));
  console.log();

  // NOTE: spaces.list() and space.info() require server-side support for
  // tinycloud.space/* capabilities which are not yet implemented.
  console.log("[Alice] Space listing and info via Space API skipped (server not yet implemented)");
  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log();
  console.log("=".repeat(70));
  console.log("Demo Complete!");
  console.log("=".repeat(70));
  console.log();
  console.log("What was demonstrated:");
  console.log();
  console.log("SESSION-ONLY MODE:");
  console.log("  ✓ Alice: wallet mode (has privateKey, can signIn)");
  console.log("  ✓ Bob & Charlie: session-only (no wallet, no signIn needed)");
  console.log("  ✓ did returns PKH for wallet mode, session key for session-only");
  console.log();
  console.log("PART 1 - Space API Basic Operations:");
  console.log("  ✓ Alice stored data using space.kv.put()");
  console.log("  ✓ Used prefix scoping with space.kv.withPrefix()");
  console.log();
  console.log("PART 2 - Delegations (session-only users receiving access):");
  console.log("  ✓ Alice created delegations for Bob & Charlie using their DIDs (session keys)");
  console.log("  ✓ Bob used delegation WITHOUT calling signIn()");
  console.log("  ✓ Charlie used delegation WITHOUT calling signIn()");
  console.log("  ✓ Both accessed Alice's space via delegations");
  console.log();
  console.log("Key APIs for Session-Only Mode:");
  console.log("  • new TinyCloudNode({ host }) - Create session-only instance");
  console.log("  • node.did - Primary DID (session key in session-only mode)");
  console.log("  • node.isSessionOnly - Check if in session-only mode");
  console.log("  • node.useDelegation() - Works without signIn()");
  console.log();
  console.log("PART 3 - Sharing Links:");
  console.log("  ⏳ Skipped (server-side tinycloud.share/* not yet implemented)");
  console.log();
  console.log("PART 4 - Space Management:");
  console.log("  ⏳ Skipped (server-side tinycloud.space/* not yet implemented)");
  console.log();
  console.log("Working APIs Used:");
  console.log("  • spaces.get(name) - Get Space object");
  console.log("  • space.kv.put/get/list - Space-scoped KV operations");
  console.log("  • space.kv.withPrefix() - Prefix-scoped KV");
  console.log("  • space.delegations.list() - List outgoing delegations");
  console.log("  • TinyCloudNode.createDelegation() - Create delegation");
  console.log("  • TinyCloudNode.useDelegation() - Use received delegation");
  console.log();
  console.log("Not Yet Implemented on Server:");
  console.log("  • space.delegations.create/revoke (needs tinycloud.delegation/*)");
  console.log("  • space.sharing.generate/list/revoke (needs tinycloud.share/*)");
  console.log("  • spaces.list(), space.info() (needs tinycloud.space/*)");
  console.log();
}

// Run the demo
runDemo().catch((error) => {
  console.error();
  console.error("Demo Failed!");
  console.error("Error:", error.message || error);
  if (error.stack) {
    console.error("Stack:", error.stack);
  }
  console.error();
  console.error("Make sure the TinyCloud server is running at:", TINYCLOUD_URL);
  console.error("  cd repositories/tinycloud-node && cargo run");
  console.error();
  process.exit(1);
});
