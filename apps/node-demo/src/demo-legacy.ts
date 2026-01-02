#!/usr/bin/env bun
/**
 * TinyCloud Node.js SDK Demo
 *
 * Demonstrates the full TinyCloud flow:
 * 1. Alice creates a namespace and stores data
 * 2. Alice delegates access to Bob
 * 3. Bob invokes actions on Alice's namespace
 *
 * Prerequisites:
 * - A running TinyCloud server (default: http://localhost:4000)
 * - Optional: Pre-generated keys via environment variables
 *
 * Environment Variables:
 *   TINYCLOUD_URL              - TinyCloud server URL (default: http://localhost:4000)
 *   TINYCLOUD_DEMO_KEY_ALICE   - Alice's base64-encoded JWK (optional, generates if not set)
 *   TINYCLOUD_DEMO_KEY_BOB     - Bob's base64-encoded JWK (optional, generates if not set)
 *   TINYCLOUD_ETH_PRIVATE_KEY  - Ethereum private key for signing (base64, 32 bytes)
 *
 * Usage:
 *   bun run demo
 */

import {
  TCWSessionManager,
  exportKeyAsBase64,
  importKeyFromBase64,
  loadKeyFromEnv,
  prepareSession,
  completeSessionSetup,
  invoke,
  makeNamespaceId,
  ensureEip55,
  signEthereumMessage,
  initPanicHook,
} from "@tinycloudlabs/node-sdk-wasm";

initPanicHook();

// ============================================================================
// Configuration
// ============================================================================

const TINYCLOUD_URL = process.env.TINYCLOUD_URL || "http://localhost:8000";
const CHAIN_ID = 1; // Ethereum mainnet
const DOMAIN = "demo.tinycloud.xyz";

// Demo Ethereum address (DO NOT USE IN PRODUCTION)
// This is derived from a well-known test private key
const DEMO_ETH_ADDRESS = "0x1234567890123456789012345678901234567890";

// Demo Ethereum private key (DO NOT USE IN PRODUCTION)
// 32 bytes of deterministic test data, base64 encoded
const DEMO_ETH_PRIVATE_KEY = Buffer.from(
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  "hex"
).toString("base64");

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

/**
 * Simulated wallet provider for demo purposes.
 * In production, this would be connected to an actual Ethereum wallet.
 */
class DemoWallet {
  constructor(
    private address: string,
    private privateKey: string
  ) {}

  async getAddress(): Promise<string> {
    return this.address;
  }

  async getChainId(): Promise<number> {
    return CHAIN_ID;
  }

  async signMessage(message: string): Promise<string> {
    // Sign with Ethereum message prefix
    return signEthereumMessage(message, this.privateKey);
  }
}

/**
 * Create or load a session key.
 */
function getOrCreateSessionKey(
  envVar: string,
  keyId: string
): { manager: TCWSessionManager; isNew: boolean } {
  const manager = new TCWSessionManager();

  if (process.env[envVar]) {
    try {
      const envValue = process.env[envVar]!;
      importKeyFromBase64(manager, envValue, keyId);
      log(keyId, `Loaded key from ${envVar}`);
      return { manager, isNew: false };
    } catch (e) {
      log(keyId, `Failed to load from ${envVar}, generating new key`);
    }
  }

  // Rename default key to our key ID
  manager.renameSessionKeyId("default", keyId);
  log(keyId, `Generated new session key`);
  return { manager, isNew: true };
}

/**
 * Start a session with the TinyCloud server.
 */
async function startSession(
  wallet: DemoWallet,
  manager: TCWSessionManager,
  keyId: string,
  namespaceId: string,
  actions: { [service: string]: { [path: string]: string[] } }
): Promise<{ session: any; delegationHeader: { Authorization: string } }> {
  const address = await wallet.getAddress();
  const chainId = await wallet.getChainId();
  const now = new Date();
  const expiration = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour

  // Get the JWK for the session key
  const jwkString = manager.jwk(keyId);
  if (!jwkString) {
    throw new Error(`No JWK found for key ${keyId}`);
  }
  const jwk = JSON.parse(jwkString);

  // Prepare the session configuration
  const sessionConfig = {
    abilities: actions,
    address: ensureEip55(address),
    chainId,
    domain: DOMAIN,
    issuedAt: now.toISOString(),
    expirationTime: expiration.toISOString(),
    namespaceId,
    jwk,
  };

  log(keyId, `Preparing session for namespace: ${namespaceId}`);

  // Prepare session (generates SIWE message)
  const prepared = prepareSession(sessionConfig);
  log(keyId, `SIWE message prepared, requesting signature...`);

  // Sign the SIWE message
  const signature = await wallet.signMessage(prepared.siwe);
  log(keyId, `Message signed`);

  // Complete session setup
  const session = completeSessionSetup({
    ...prepared,
    signature,
  });

  log(keyId, `Session created with delegation CID: ${session.delegationCid}`);

  return {
    session,
    delegationHeader: session.delegationHeader,
  };
}

/**
 * Activate a session with the TinyCloud server.
 */
async function activateSession(
  delegationHeader: { Authorization: string }
): Promise<boolean> {
  try {
    const response = await fetch(`${TINYCLOUD_URL}/delegate`, {
      method: "POST",
      headers: delegationHeader,
    });

    if (response.ok) {
      return true;
    } else if (response.status === 404) {
      // Namespace doesn't exist, need to create it
      return false;
    } else {
      throw new Error(`Failed to activate session: ${response.status}`);
    }
  } catch (error: any) {
    if (error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to TinyCloud server at ${TINYCLOUD_URL}. Is it running?`
      );
    }
    throw error;
  }
}

/**
 * Invoke a KV operation.
 */
async function kvOperation(
  session: any,
  action: string,
  path: string,
  body?: Blob
): Promise<Response> {
  const headers = invoke(session, "kv", path, action);

  const response = await fetch(`${TINYCLOUD_URL}/invoke`, {
    method: "POST",
    headers,
    body,
  });

  return response;
}

// ============================================================================
// Demo Flow
// ============================================================================

async function runDemo() {
  console.log();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║            TinyCloud Node.js SDK Demo                      ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log(`TinyCloud URL: ${TINYCLOUD_URL}`);
  console.log(`Chain ID: ${CHAIN_ID}`);
  console.log(`Domain: ${DOMAIN}`);

  // Create wallet
  const wallet = new DemoWallet(
    DEMO_ETH_ADDRESS,
    process.env.TINYCLOUD_ETH_PRIVATE_KEY || DEMO_ETH_PRIVATE_KEY
  );

  // ========================================================================
  // Step 1: Setup Alice's session key
  // ========================================================================
  logStep(1, "Setup Alice's Session Key");

  const { manager: aliceManager } = getOrCreateSessionKey(
    "TINYCLOUD_DEMO_KEY_ALICE",
    "alice"
  );
  const aliceDid = aliceManager.getDID("alice");
  log("Alice", `DID: ${aliceDid}`);

  // Export for reference
  const aliceKey = exportKeyAsBase64(aliceManager, "alice");
  log("Alice", `Key exported (${aliceKey.length} chars)`);

  // ========================================================================
  // Step 2: Setup Bob's session key
  // ========================================================================
  logStep(2, "Setup Bob's Session Key");

  const { manager: bobManager } = getOrCreateSessionKey(
    "TINYCLOUD_DEMO_KEY_BOB",
    "bob"
  );
  const bobDid = bobManager.getDID("bob");
  log("Bob", `DID: ${bobDid}`);

  // ========================================================================
  // Step 3: Create Alice's namespace
  // ========================================================================
  logStep(3, "Create Alice's Namespace");

  const namespaceId = makeNamespaceId(
    ensureEip55(await wallet.getAddress()),
    await wallet.getChainId(),
    "demo"
  );
  log("Namespace", `ID: ${namespaceId}`);

  // Define Alice's full access
  const aliceActions = {
    kv: {
      "": [
        "tinycloud.kv/put",
        "tinycloud.kv/get",
        "tinycloud.kv/del",
        "tinycloud.kv/list",
        "tinycloud.kv/metadata",
      ],
    },
  };

  // Start Alice's session
  const { session: aliceSession, delegationHeader: aliceDelegation } =
    await startSession(wallet, aliceManager, "alice", namespaceId, aliceActions);

  // Try to activate the session
  log("Alice", "Activating session...");
  try {
    const activated = await activateSession(aliceDelegation);
    if (activated) {
      log("Alice", "Session activated successfully!");
    } else {
      log("Alice", "Namespace not found - would need to create it");
      log("Alice", "(Namespace creation requires additional server interaction)");
    }
  } catch (error: any) {
    log("Alice", `Session activation: ${error.message}`);
    log("Alice", "Continuing with demo simulation...");
  }

  // ========================================================================
  // Step 4: Alice stores data
  // ========================================================================
  logStep(4, "Alice Stores Data");

  const testData = {
    message: "Hello from Alice!",
    timestamp: new Date().toISOString(),
    sharedWith: ["bob"],
  };

  log("Alice", `Storing data: ${JSON.stringify(testData)}`);

  try {
    const putResponse = await kvOperation(
      aliceSession,
      "tinycloud.kv/put",
      "shared/greeting",
      new Blob([JSON.stringify(testData)], { type: "application/json" })
    );
    log("Alice", `PUT response: ${putResponse.status} ${putResponse.statusText}`);
  } catch (error: any) {
    log("Alice", `PUT simulated (server unavailable): ${error.message}`);
  }

  // ========================================================================
  // Step 5: Alice delegates to Bob (read-only)
  // ========================================================================
  logStep(5, "Alice Delegates to Bob (Read-Only)");

  // Bob only gets read access to the shared/ prefix
  const bobActions = {
    kv: {
      "shared/": ["tinycloud.kv/get", "tinycloud.kv/list", "tinycloud.kv/metadata"],
    },
  };

  log("Bob", "Requesting delegated access from Alice...");

  // Get Bob's JWK to include in the delegation
  const bobJwkString = bobManager.jwk("bob");
  if (!bobJwkString) {
    throw new Error("No JWK found for Bob");
  }
  const bobJwk = JSON.parse(bobJwkString);

  // Create delegation config (Alice delegates to Bob's key)
  const now = new Date();
  const delegationConfig = {
    abilities: bobActions,
    address: ensureEip55(await wallet.getAddress()),
    chainId: await wallet.getChainId(),
    domain: DOMAIN,
    issuedAt: now.toISOString(),
    expirationTime: new Date(now.getTime() + 30 * 60 * 1000).toISOString(), // 30 min
    namespaceId,
    jwk: bobJwk, // Delegate to Bob's key
    parents: [aliceSession.delegationCid], // Chain from Alice's delegation
  };

  log("Bob", `Delegation prepared with parent CID: ${aliceSession.delegationCid}`);
  log("Bob", `Bob can access: ${JSON.stringify(bobActions.kv)}`);

  // In a real scenario, Alice would sign this delegation
  const preparedBobSession = prepareSession(delegationConfig);
  log("Bob", "Delegation SIWE message prepared");

  // Alice signs the delegation to Bob
  const bobDelegationSignature = await wallet.signMessage(preparedBobSession.siwe);
  const bobSession = completeSessionSetup({
    ...preparedBobSession,
    signature: bobDelegationSignature,
  });

  log("Bob", `Session created with delegation CID: ${bobSession.delegationCid}`);

  // ========================================================================
  // Step 6: Bob reads Alice's data
  // ========================================================================
  logStep(6, "Bob Reads Alice's Data");

  log("Bob", "Attempting to read shared/greeting...");

  try {
    const getResponse = await kvOperation(
      bobSession,
      "tinycloud.kv/get",
      "shared/greeting"
    );
    log("Bob", `GET response: ${getResponse.status} ${getResponse.statusText}`);

    if (getResponse.ok) {
      const data = await getResponse.json();
      log("Bob", `Data received: ${JSON.stringify(data)}`);
    }
  } catch (error: any) {
    log("Bob", `GET simulated (server unavailable): ${error.message}`);
  }

  // ========================================================================
  // Step 7: Bob tries to write (should fail)
  // ========================================================================
  logStep(7, "Bob Tries to Write (Should Fail)");

  log("Bob", "Attempting to write to shared/unauthorized...");

  try {
    const putResponse = await kvOperation(
      bobSession,
      "tinycloud.kv/put",
      "shared/unauthorized",
      new Blob(["Bob was here"], { type: "text/plain" })
    );
    log("Bob", `PUT response: ${putResponse.status} ${putResponse.statusText}`);

    if (putResponse.status === 403) {
      log("Bob", "Access denied as expected - Bob only has read access!");
    }
  } catch (error: any) {
    log("Bob", `PUT simulated (server unavailable): ${error.message}`);
    log("Bob", "In production, this would return 403 Forbidden");
  }

  // ========================================================================
  // Summary
  // ========================================================================
  console.log();
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                      Demo Complete                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log();
  console.log("Summary:");
  console.log(`  - Alice's namespace: ${namespaceId}`);
  console.log(`  - Alice's DID: ${aliceDid}`);
  console.log(`  - Bob's DID: ${bobDid}`);
  console.log(`  - Delegation chain: wallet -> Alice -> Bob`);
  console.log();
  console.log("To run with a live server:");
  console.log(`  TINYCLOUD_URL=http://your-server:4000 bun run demo`);
  console.log();
  console.log("To use pre-generated keys:");
  console.log(`  export TINYCLOUD_DEMO_KEY_ALICE=$(bun run keygen alice)`);
  console.log(`  export TINYCLOUD_DEMO_KEY_BOB=$(bun run keygen bob)`);
  console.log(`  bun run demo`);
  console.log();
}

// Run the demo
runDemo().catch((error) => {
  console.error("Demo failed:", error);
  process.exit(1);
});
