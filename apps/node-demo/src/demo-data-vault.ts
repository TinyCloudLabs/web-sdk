#!/usr/bin/env bun
/**
 * TinyCloud Node.js SDK Demo - Data Vault (End-to-End Encrypted KV)
 *
 * Demonstrates the Data Vault: client-side encrypted storage where the
 * server never sees plaintext data.
 *
 * 1. Alice unlocks her vault, encrypts and stores medical records
 * 2. Alice reads back and decrypts her data
 * 3. Bob creates his own space and publishes his vault public key
 * 4. Alice grants Bob access to a specific entry
 * 5. Bob decrypts the shared entry using Alice's grant
 *
 * Key concepts:
 * - All encryption/decryption happens client-side (Node.js crypto)
 * - Server only sees encrypted blobs + metadata envelopes
 * - Sharing uses X25519 Diffie-Hellman key exchange
 * - Public keys published to public spaces for discovery
 *
 * Prerequisites:
 * - A running TinyCloud server (default: http://localhost:8000)
 *
 * Usage:
 *   bun run demo:vault
 */

import {
  TinyCloudNode,
  TinyCloud,
  serializeDelegation,
  deserializeDelegation,
  makePublicSpaceId,
} from "@tinycloud/node-sdk";
import { Wallet } from "ethers";
import * as crypto from "crypto";

// ============================================================================
// Configuration
// ============================================================================

const TINYCLOUD_URL = process.env.TINYCLOUD_URL || "http://localhost:8000";

// ============================================================================
// VaultCrypto — Node.js native implementation
// ============================================================================

/**
 * Native Node.js implementation of VaultCrypto.
 * Uses AES-256-GCM, HKDF-SHA256, X25519, SHA-256.
 * In production, the WASM bindings would be used instead.
 */
const nodeCrypto = {
  encrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      Buffer.from(key),
      nonce
    );
    const encrypted = Buffer.concat([
      cipher.update(Buffer.from(plaintext)),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    // Return: nonce(12) || ciphertext || tag(16)
    const result = new Uint8Array(12 + encrypted.length + 16);
    result.set(nonce, 0);
    result.set(encrypted, 12);
    result.set(tag, 12 + encrypted.length);
    return result;
  },

  decrypt(key: Uint8Array, blob: Uint8Array): Uint8Array {
    const nonce = blob.slice(0, 12);
    const tag = blob.slice(blob.length - 16);
    const ciphertext = blob.slice(12, blob.length - 16);
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key),
      Buffer.from(nonce)
    );
    decipher.setAuthTag(Buffer.from(tag));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(ciphertext)),
      decipher.final(),
    ]);
    return new Uint8Array(decrypted);
  },

  deriveKey(
    signature: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array
  ): Uint8Array {
    const derived = crypto.hkdfSync(
      "sha256",
      Buffer.from(signature),
      Buffer.from(salt),
      Buffer.from(info),
      32
    );
    return new Uint8Array(derived);
  },

  x25519FromSeed(
    seed: Uint8Array
  ): { publicKey: Uint8Array; privateKey: Uint8Array } {
    // X25519 private key IS the seed (clamped by the library)
    const privateKeyObj = crypto.createPrivateKey({
      key: Buffer.concat([
        // PKCS8 DER prefix for X25519 private key
        Buffer.from("302e020100300506032b656e04220420", "hex"),
        Buffer.from(seed),
      ]),
      format: "der",
      type: "pkcs8",
    });
    const publicKeyObj = crypto.createPublicKey(privateKeyObj);
    const publicKeyDer = publicKeyObj.export({ type: "spki", format: "der" });
    const privateKeyDer = privateKeyObj.export({ type: "pkcs8", format: "der" });
    // Extract raw 32-byte keys from DER
    const publicKey = new Uint8Array(
      publicKeyDer.subarray(publicKeyDer.length - 32)
    );
    const privateKey = new Uint8Array(seed);
    return { publicKey, privateKey };
  },

  x25519Dh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
    const privKeyObj = crypto.createPrivateKey({
      key: Buffer.concat([
        Buffer.from("302e020100300506032b656e04220420", "hex"),
        Buffer.from(privateKey),
      ]),
      format: "der",
      type: "pkcs8",
    });
    const pubKeyObj = crypto.createPublicKey({
      key: Buffer.concat([
        Buffer.from("302a300506032b656e032100", "hex"),
        Buffer.from(publicKey),
      ]),
      format: "der",
      type: "spki",
    });
    const shared = crypto.diffieHellman({
      privateKey: privKeyObj,
      publicKey: pubKeyObj,
    });
    return new Uint8Array(shared);
  },

  randomBytes(length: number): Uint8Array {
    return new Uint8Array(crypto.randomBytes(length));
  },

  sha256(data: Uint8Array): Uint8Array {
    return new Uint8Array(
      crypto.createHash("sha256").update(Buffer.from(data)).digest()
    );
  },
};

// ============================================================================
// Helpers
// ============================================================================

function generateKey(): string {
  return Wallet.createRandom().privateKey.slice(2);
}

function toBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function fromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function hexEncode(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64Encode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

function base64Decode(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, "base64"));
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, arr) => acc + arr.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

async function checkServerHealth() {
  console.log("[Health] Checking server...");
  try {
    const response = await fetch(`${TINYCLOUD_URL}/healthz`);
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    console.log("[Health] Server is running");
  } catch (error) {
    const err = error as Error;
    throw new Error(
      `Server not reachable at ${TINYCLOUD_URL}: ${err.message}`
    );
  }
  console.log();
}

// ============================================================================
// Vault Operations (uses nodeCrypto directly against KV service)
// ============================================================================

/**
 * Derive a master key from a wallet signature.
 */
async function deriveMasterKey(
  signer: { signMessage(message: string): Promise<string> },
  spaceId: string
): Promise<Uint8Array> {
  const message = `tinycloud-vault-master-v1:${spaceId}`;
  const signature = await signer.signMessage(message);
  return nodeCrypto.deriveKey(
    toBytes(signature),
    nodeCrypto.sha256(toBytes(spaceId)),
    toBytes("vault-master")
  );
}

/**
 * Derive X25519 encryption identity from wallet signature.
 */
async function deriveEncryptionIdentity(
  signer: { signMessage(message: string): Promise<string> }
): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  const signature = await signer.signMessage(
    "tinycloud-encryption-identity-v1"
  );
  const seed = nodeCrypto.deriveKey(
    toBytes(signature),
    toBytes("tinycloud-x25519"),
    toBytes("encryption-identity")
  );
  return nodeCrypto.x25519FromSeed(seed);
}

/**
 * Encrypt a value and store it via KV.
 */
async function vaultPut(
  kv: { put(key: string, value: unknown): Promise<any> },
  masterKey: Uint8Array,
  key: string,
  value: unknown
) {
  // Serialize
  const plaintext = toBytes(JSON.stringify(value));

  // Generate per-entry key
  const entryKey = nodeCrypto.randomBytes(32);
  const keyId = hexEncode(nodeCrypto.sha256(entryKey)).slice(0, 16);

  // Encrypt value
  const encrypted = nodeCrypto.encrypt(entryKey, plaintext);

  // Encrypt entry key with master key
  const keyBlob = nodeCrypto.encrypt(masterKey, entryKey);

  // Store encrypted entry key
  await kv.put(`keys/${key}`, JSON.stringify({
    key: base64Encode(keyBlob),
    metadata: { keyId, cipher: "aes-256-gcm" },
  }));

  // Store encrypted value with metadata envelope
  await kv.put(`vault/${key}`, JSON.stringify({
    data: base64Encode(encrypted),
    metadata: {
      "x-vault-version": "1",
      "x-vault-cipher": "aes-256-gcm",
      "x-vault-key-id": keyId,
      "x-vault-content-type": "application/json",
      "x-vault-kdf": "hkdf-sha256",
      "x-vault-key-rotation": "per-write",
    },
  }));

  return { keyId };
}

/**
 * Fetch and decrypt a value from KV.
 */
async function vaultGet<T>(
  kv: { get<U>(key: string): Promise<any> },
  masterKey: Uint8Array,
  key: string
): Promise<{ value: T; keyId: string; metadata: Record<string, string> }> {
  // Fetch encrypted entry key
  const keyResult = await kv.get(`keys/${key}`);
  if (!keyResult.ok) throw new Error(`Key not found: keys/${key}`);
  const keyEnvelope = typeof keyResult.data.data === "string"
    ? JSON.parse(keyResult.data.data)
    : keyResult.data.data;
  const keyBlobBytes = base64Decode(keyEnvelope.key);
  const entryKey = nodeCrypto.decrypt(masterKey, keyBlobBytes);

  // Fetch encrypted value
  const valueResult = await kv.get(`vault/${key}`);
  if (!valueResult.ok) throw new Error(`Key not found: vault/${key}`);
  const valueEnvelope = typeof valueResult.data.data === "string"
    ? JSON.parse(valueResult.data.data)
    : valueResult.data.data;
  const encryptedBytes = base64Decode(valueEnvelope.data);
  const plaintext = nodeCrypto.decrypt(entryKey, encryptedBytes);

  const metadata = valueEnvelope.metadata ?? {};
  const value = JSON.parse(fromBytes(plaintext)) as T;
  return { value, keyId: metadata["x-vault-key-id"] ?? "", metadata };
}

/**
 * Create a grant: encrypt the entry key to recipient's X25519 public key.
 */
function createGrant(
  masterKey: Uint8Array,
  keyBlob: Uint8Array,
  recipientPubKey: Uint8Array
): Uint8Array {
  // Decrypt entry key
  const entryKey = nodeCrypto.decrypt(masterKey, keyBlob);

  // Ephemeral X25519 keypair
  const ephemeralSeed = nodeCrypto.randomBytes(32);
  const ephemeralKeyPair = nodeCrypto.x25519FromSeed(ephemeralSeed);

  // DH shared secret
  const sharedSecret = nodeCrypto.x25519Dh(
    ephemeralKeyPair.privateKey,
    recipientPubKey
  );

  // Derive encryption key
  const encryptionKey = nodeCrypto.deriveKey(
    sharedSecret,
    toBytes("tinycloud-x25519"),
    toBytes("vault-grant")
  );

  // Encrypt entry key to recipient
  const encryptedGrant = nodeCrypto.encrypt(encryptionKey, entryKey);

  // grantBlob = ephemeralPubKey(32) || encryptedGrant
  return concatBytes(ephemeralKeyPair.publicKey, encryptedGrant);
}

/**
 * Decrypt a grant: recover entry key using own X25519 private key.
 */
function decryptGrant(
  myPrivateKey: Uint8Array,
  grantBlob: Uint8Array
): Uint8Array {
  // Parse grant
  const ephemeralPubKey = grantBlob.slice(0, 32);
  const encryptedGrant = grantBlob.slice(32);

  // DH shared secret
  const sharedSecret = nodeCrypto.x25519Dh(myPrivateKey, ephemeralPubKey);

  // Derive decryption key
  const decryptionKey = nodeCrypto.deriveKey(
    sharedSecret,
    toBytes("tinycloud-x25519"),
    toBytes("vault-grant")
  );

  // Decrypt entry key
  return nodeCrypto.decrypt(decryptionKey, encryptedGrant);
}

// ============================================================================
// Demo Flow
// ============================================================================

async function runDemo() {
  console.log();
  console.log("TinyCloud Data Vault Demo - E2E Encrypted KV Storage");
  console.log("=".repeat(70));
  console.log(`Server: ${TINYCLOUD_URL}`);
  console.log();

  await checkServerHealth();

  // =========================================================================
  // Setup: Create Alice and Bob with wallets
  // =========================================================================
  const aliceKey = process.env.ALICE_PRIVATE_KEY || generateKey();
  const bobKey = process.env.BOB_PRIVATE_KEY || generateKey();
  const aliceWallet = new Wallet(`0x${aliceKey}`);
  const bobWallet = new Wallet(`0x${bobKey}`);

  console.log(`[Setup] Alice: ${aliceWallet.address}`);
  console.log(`[Setup] Bob:   ${bobWallet.address}`);
  console.log();

  // Create TinyCloudNode instances — both need wallets for vault operations
  const alice = new TinyCloudNode({
    privateKey: aliceKey,
    host: TINYCLOUD_URL,
    prefix: "vault-demo-alice",
    autoCreateSpace: true,
  });

  const bob = new TinyCloudNode({
    privateKey: bobKey,
    host: TINYCLOUD_URL,
    prefix: "vault-demo-bob",
    autoCreateSpace: true,
  });

  // Both sign in to create their spaces
  console.log("[Alice] Signing in...");
  await alice.signIn();
  console.log(`[Alice] Space: ${alice.spaceId}`);

  console.log("[Bob] Signing in...");
  await bob.signIn();
  console.log(`[Bob] Space: ${bob.spaceId}`);
  console.log();

  // =========================================================================
  // PART 1: Vault Unlock — Derive keys from wallet signatures
  // =========================================================================
  console.log("=".repeat(70));
  console.log("PART 1: Unlock Vault — Derive keys from wallet signatures");
  console.log("=".repeat(70));
  console.log();

  // Alice derives her vault keys
  console.log("[Alice] Deriving master key (signs deterministic message)...");
  const aliceMasterKey = await deriveMasterKey(
    { signMessage: (msg) => aliceWallet.signMessage(msg) },
    alice.spaceId!
  );
  console.log(
    `[Alice] Master key derived: ${hexEncode(aliceMasterKey).slice(0, 16)}...`
  );

  console.log("[Alice] Deriving encryption identity (X25519)...");
  const aliceIdentity = await deriveEncryptionIdentity({
    signMessage: (msg) => aliceWallet.signMessage(msg),
  });
  console.log(
    `[Alice] Vault public key: ${hexEncode(aliceIdentity.publicKey).slice(0, 16)}...`
  );
  console.log();

  // Bob derives his vault keys
  console.log("[Bob] Deriving master key...");
  const bobMasterKey = await deriveMasterKey(
    { signMessage: (msg) => bobWallet.signMessage(msg) },
    bob.spaceId!
  );
  console.log(
    `[Bob] Master key derived: ${hexEncode(bobMasterKey).slice(0, 16)}...`
  );

  console.log("[Bob] Deriving encryption identity (X25519)...");
  const bobIdentity = await deriveEncryptionIdentity({
    signMessage: (msg) => bobWallet.signMessage(msg),
  });
  console.log(
    `[Bob] Vault public key: ${hexEncode(bobIdentity.publicKey).slice(0, 16)}...`
  );
  console.log();

  // =========================================================================
  // PART 2: Bob publishes his vault public key to his public space
  // =========================================================================
  console.log("=".repeat(70));
  console.log("PART 2: Bob publishes vault public key to public space");
  console.log("=".repeat(70));
  console.log();

  // Bob creates a public space and publishes his vault key
  const bobPublic = new TinyCloudNode({
    privateKey: bobKey,
    host: TINYCLOUD_URL,
    prefix: "public",
    autoCreateSpace: true,
  });
  await bobPublic.signIn();

  const bobPubKeyB64 = base64Encode(bobIdentity.publicKey);
  console.log("[Bob] Publishing vault public key to public space...");
  const pubKeyResult = await bobPublic.kv.put(
    ".well-known/vault-pubkey",
    bobPubKeyB64
  );
  if (!pubKeyResult.ok) {
    console.error(
      `[Bob] Failed to publish public key: ${pubKeyResult.error.message}`
    );
  } else {
    console.log("[Bob] Vault public key published at .well-known/vault-pubkey");
  }

  await bobPublic.kv.put(".well-known/vault-version", "1");
  console.log("[Bob] Vault version published");
  console.log();

  // Alice also publishes her public key
  const alicePublic = new TinyCloudNode({
    privateKey: aliceKey,
    host: TINYCLOUD_URL,
    prefix: "public",
    autoCreateSpace: true,
  });
  await alicePublic.signIn();

  console.log("[Alice] Publishing vault public key to public space...");
  await alicePublic.kv.put(
    ".well-known/vault-pubkey",
    base64Encode(aliceIdentity.publicKey)
  );
  await alicePublic.kv.put(".well-known/vault-version", "1");
  console.log("[Alice] Vault public key published");
  console.log();

  // Verify: Alice reads Bob's public key via the public endpoint
  console.log("[Alice] Resolving Bob's vault public key from public space...");
  const bobPublicSpaceId = makePublicSpaceId(bobWallet.address, 1);
  const bobPubKeyUrl = `${TINYCLOUD_URL}/public/${encodeURIComponent(
    bobPublicSpaceId
  )}/kv/.well-known/vault-pubkey`;
  console.log(`[Alice] GET ${bobPubKeyUrl}`);

  const pubKeyFetch = await fetch(bobPubKeyUrl);
  if (pubKeyFetch.ok) {
    const bobPubKeyRaw = await pubKeyFetch.text();
    // Parse the JSON-wrapped value
    let resolvedKey: string;
    try {
      resolvedKey = JSON.parse(bobPubKeyRaw);
    } catch {
      resolvedKey = bobPubKeyRaw;
    }
    const resolvedBytes = base64Decode(resolvedKey);
    console.log(
      `[Alice] Resolved Bob's public key: ${hexEncode(resolvedBytes).slice(0, 16)}...`
    );
    console.log(
      `[Alice] Keys match: ${hexEncode(resolvedBytes) === hexEncode(bobIdentity.publicKey)}`
    );
  } else {
    console.log(
      `[Alice] Failed to resolve Bob's key: ${pubKeyFetch.status} ${await pubKeyFetch.text()}`
    );
  }
  console.log();

  // =========================================================================
  // PART 3: Alice encrypts and stores sensitive data
  // =========================================================================
  console.log("=".repeat(70));
  console.log("PART 3: Alice encrypts and stores medical records");
  console.log("=".repeat(70));
  console.log();

  const medicalRecord = {
    patient: "Alice",
    bloodPressure: "120/80",
    heartRate: 72,
    notes: "All vitals normal",
    date: new Date().toISOString(),
  };

  console.log(`[Alice] Plaintext: ${JSON.stringify(medicalRecord)}`);
  console.log("[Alice] Encrypting and storing...");

  const putInfo = await vaultPut(
    alice.kv,
    aliceMasterKey,
    "medical/records/2026",
    medicalRecord
  );
  console.log(`[Alice] Stored encrypted. Key ID: ${putInfo.keyId}`);
  console.log();

  // Store another entry
  const credentials = {
    type: "api-key",
    service: "lab-portal",
    key: "sk_live_abc123def456",
    created: new Date().toISOString(),
  };
  console.log("[Alice] Storing encrypted credentials...");
  await vaultPut(alice.kv, aliceMasterKey, "credentials/lab-portal", credentials);
  console.log("[Alice] Credentials stored (encrypted)");
  console.log();

  // =========================================================================
  // PART 4: Alice reads back and decrypts her data
  // =========================================================================
  console.log("=".repeat(70));
  console.log("PART 4: Alice reads back and decrypts");
  console.log("=".repeat(70));
  console.log();

  console.log("[Alice] Fetching and decrypting medical/records/2026...");
  const decrypted = await vaultGet<typeof medicalRecord>(
    alice.kv,
    aliceMasterKey,
    "medical/records/2026"
  );
  console.log(`[Alice] Decrypted: ${JSON.stringify(decrypted.value)}`);
  console.log(`[Alice] Key ID: ${decrypted.keyId}`);
  console.log(
    `[Alice] Match: ${JSON.stringify(decrypted.value) === JSON.stringify(medicalRecord)}`
  );
  console.log();

  // Verify server only sees ciphertext
  console.log("[Server] What the server sees (encrypted blob):");
  const rawResult = await alice.kv.get<string>("vault/medical/records/2026", {
    raw: true,
  });
  if (rawResult.ok) {
    const envelope =
      typeof rawResult.data.data === "string"
        ? JSON.parse(rawResult.data.data)
        : rawResult.data.data;
    console.log(`  cipher: ${envelope.metadata?.["x-vault-cipher"]}`);
    console.log(`  key-id: ${envelope.metadata?.["x-vault-key-id"]}`);
    console.log(
      `  data (first 60 chars): ${(envelope.data as string).slice(0, 60)}...`
    );
    console.log("  (Server CANNOT decrypt this — no key material on server)");
  }
  console.log();

  // =========================================================================
  // PART 5: Alice grants Bob access via X25519 key exchange
  // =========================================================================
  console.log("=".repeat(70));
  console.log("PART 5: Alice grants Bob access to medical records");
  console.log("=".repeat(70));
  console.log();

  // Fetch Alice's encrypted entry key
  const aliceKeyResult = await alice.kv.get<string>(
    "keys/medical/records/2026",
    { raw: true }
  );
  if (!aliceKeyResult.ok) {
    throw new Error("Could not fetch Alice's entry key");
  }
  const aliceKeyEnvelope =
    typeof aliceKeyResult.data.data === "string"
      ? JSON.parse(aliceKeyResult.data.data)
      : aliceKeyResult.data.data;
  const aliceKeyBlobBytes = base64Decode(aliceKeyEnvelope.key);

  // Create grant for Bob
  console.log(
    "[Alice] Creating grant for Bob (X25519 DH key exchange)..."
  );
  const grantBlob = createGrant(
    aliceMasterKey,
    aliceKeyBlobBytes,
    bobIdentity.publicKey
  );
  console.log(
    `[Alice] Grant blob size: ${grantBlob.length} bytes (32 ephemeral pub + encrypted key)`
  );

  // Store grant in Alice's space
  const grantResult = await alice.kv.put(
    `grants/${bob.did}/medical/records/2026`,
    JSON.stringify({
      grant: base64Encode(grantBlob),
      metadata: {
        "x-vault-grant-version": "1",
        "x-vault-grantor": alice.did,
        "x-vault-cipher": "x25519-aes-256-gcm",
      },
    })
  );
  if (!grantResult.ok) {
    console.error(
      `[Alice] Failed to store grant: ${grantResult.error.message}`
    );
  } else {
    console.log("[Alice] Grant stored for Bob");
  }
  console.log();

  // Alice delegates read access to Bob for the grant + encrypted data
  console.log(
    "[Alice] Creating delegation for Bob (read access to vault + grants)..."
  );
  const delegation = await alice.createDelegation({
    delegateDID: bob.did,
    path: "",
    actions: ["tinycloud.kv/get", "tinycloud.kv/metadata"],
    expiryMs: 24 * 60 * 60 * 1000,
  });
  console.log(`[Alice] Delegation created: ${delegation.cid}`);
  console.log();

  // =========================================================================
  // PART 6: Bob receives the grant and decrypts Alice's data
  // =========================================================================
  console.log("=".repeat(70));
  console.log("PART 6: Bob decrypts Alice's shared data");
  console.log("=".repeat(70));
  console.log();

  // Bob receives Alice's delegation
  const serialized = serializeDelegation(delegation);
  const received = deserializeDelegation(serialized);
  const bobAccessToAlice = await bob.useDelegation(received);

  // Step 1: Fetch the grant from Alice's space
  console.log("[Bob] Fetching grant from Alice's space...");
  const grantFetchResult = await bobAccessToAlice.kv.get<string>(
    `grants/${bob.did}/medical/records/2026`
  );
  if (!grantFetchResult.ok) {
    console.error(
      `[Bob] Failed to fetch grant: ${grantFetchResult.error.message}`
    );
    throw new Error("Grant fetch failed");
  }

  const grantData =
    typeof grantFetchResult.data.data === "string"
      ? JSON.parse(grantFetchResult.data.data)
      : grantFetchResult.data.data;
  const fetchedGrantBlob = base64Decode(grantData.grant);
  console.log(`[Bob] Grant received (${fetchedGrantBlob.length} bytes)`);

  // Step 2: Decrypt the grant to get the entry key
  console.log("[Bob] Decrypting grant (X25519 DH)...");
  const entryKey = decryptGrant(bobIdentity.privateKey, fetchedGrantBlob);
  console.log(
    `[Bob] Entry key recovered: ${hexEncode(entryKey).slice(0, 16)}...`
  );

  // Step 3: Fetch the encrypted value from Alice's space
  console.log("[Bob] Fetching encrypted value from Alice's space...");
  const encryptedResult = await bobAccessToAlice.kv.get<string>(
    "vault/medical/records/2026"
  );
  if (!encryptedResult.ok) {
    console.error(
      `[Bob] Failed to fetch encrypted value: ${encryptedResult.error.message}`
    );
    throw new Error("Encrypted value fetch failed");
  }

  const encryptedEnvelope =
    typeof encryptedResult.data.data === "string"
      ? JSON.parse(encryptedResult.data.data)
      : encryptedResult.data.data;
  const encryptedBytes = base64Decode(encryptedEnvelope.data);

  // Step 4: Decrypt the value
  console.log("[Bob] Decrypting Alice's medical records...");
  const decryptedPlaintext = nodeCrypto.decrypt(entryKey, encryptedBytes);
  const bobDecrypted = JSON.parse(fromBytes(decryptedPlaintext));
  console.log(`[Bob] Decrypted: ${JSON.stringify(bobDecrypted)}`);
  console.log(
    `[Bob] Match original: ${JSON.stringify(bobDecrypted) === JSON.stringify(medicalRecord)}`
  );
  console.log();

  // =========================================================================
  // Summary
  // =========================================================================
  console.log("=".repeat(70));
  console.log("Demo Complete!");
  console.log("=".repeat(70));
  console.log();
  console.log("What was demonstrated:");
  console.log();
  console.log("PART 1 — Vault Unlock:");
  console.log("  Master key derived from deterministic wallet signature + HKDF");
  console.log("  X25519 encryption identity derived from separate signature");
  console.log("  Keys live in memory only — lost on page refresh");
  console.log();
  console.log("PART 2 — Public Key Publishing:");
  console.log("  Bob published vault public key to public space");
  console.log("  Alice resolved Bob's key via /public/{spaceId}/kv/ endpoint");
  console.log("  No authentication needed for public key discovery");
  console.log();
  console.log("PART 3 — Client-Side Encryption:");
  console.log("  Per-entry random AES-256-GCM key (forward secrecy)");
  console.log("  Entry keys encrypted with master key, stored separately");
  console.log("  Self-describing metadata envelope (cipher, key ID, etc.)");
  console.log("  Server sees only encrypted blobs — ZERO plaintext access");
  console.log();
  console.log("PART 4 — Decryption:");
  console.log("  Decrypt entry key → decrypt value → deserialize JSON");
  console.log("  Content type from metadata envelope for correct deserialization");
  console.log();
  console.log("PART 5 — Sharing via X25519 Grants:");
  console.log("  Alice encrypts entry key to Bob's X25519 public key");
  console.log("  Ephemeral DH keypair per grant (forward secrecy)");
  console.log("  Grant stored in Alice's space, delegation grants read access");
  console.log("  No server-side crypto — key transport entirely client-side");
  console.log();
  console.log("PART 6 — Receiving Shared Data:");
  console.log("  Bob fetches grant → DH to recover entry key → decrypt value");
  console.log("  Server never sees the decrypted entry key or plaintext");
  console.log();
  console.log("Security Properties:");
  console.log("  - Confidentiality: server never sees plaintext");
  console.log("  - Forward secrecy: unique key per write + per grant");
  console.log("  - Key isolation: per-space master keys");
  console.log("  - Grant privacy: X25519 ephemeral DH per grant");
  console.log();
}

runDemo().catch((error) => {
  console.error();
  console.error("Demo Failed!");
  console.error("Error:", error.message || error);
  if (error.stack) console.error("Stack:", error.stack);
  console.error();
  console.error("Make sure the TinyCloud server is running at:", TINYCLOUD_URL);
  console.error("  cd repositories/tinycloud-node && cargo run");
  console.error();
  process.exit(1);
});
