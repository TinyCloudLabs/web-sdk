/**
 * DataVaultService unit tests.
 *
 * Tests the encrypted KV service using mock crypto and in-memory KV storage.
 * No WASM or network required — all dependencies are injected.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { DataVaultService, type VaultCrypto } from "./DataVaultService";
import type { IServiceContext, ServiceSession, Result } from "../types";

// =============================================================================
// Mock Crypto — simple reversible operations for testing
// =============================================================================

function createMockCrypto(): VaultCrypto {
  return {
    encrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array {
      // Format: 4-byte LE length + XOR with repeating key
      const result = new Uint8Array(4 + plaintext.length);
      new DataView(result.buffer).setUint32(0, plaintext.length, true);
      for (let i = 0; i < plaintext.length; i++) {
        result[4 + i] = plaintext[i] ^ key[i % key.length];
      }
      return result;
    },
    decrypt(key: Uint8Array, blob: Uint8Array): Uint8Array {
      const length = new DataView(
        blob.buffer,
        blob.byteOffset
      ).getUint32(0, true);
      const result = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        result[i] = blob[4 + i] ^ key[i % key.length];
      }
      return result;
    },
    deriveKey(
      signature: Uint8Array,
      salt: Uint8Array,
      info: Uint8Array
    ): Uint8Array {
      const result = new Uint8Array(32);
      for (let i = 0; i < signature.length; i++)
        result[i % 32] ^= signature[i];
      for (let i = 0; i < salt.length; i++)
        result[(i + 7) % 32] ^= salt[i];
      for (let i = 0; i < info.length; i++)
        result[(i + 13) % 32] ^= info[i];
      return result;
    },
    x25519FromSeed(
      seed: Uint8Array
    ): { publicKey: Uint8Array; privateKey: Uint8Array } {
      const privateKey = new Uint8Array(32);
      const publicKey = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        privateKey[i] = seed[i % seed.length];
        publicKey[i] = seed[i % seed.length] ^ 0xff;
      }
      return { publicKey, privateKey };
    },
    x25519Dh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
      // XOR is commutative: DH(aPriv, bPub) === DH(bPriv, aPub)
      // because aPriv ^ (bSeed ^ 0xFF) === bSeed ^ (aSeed ^ 0xFF)
      const result = new Uint8Array(32);
      for (let i = 0; i < 32; i++) {
        result[i] = privateKey[i] ^ publicKey[i];
      }
      return result;
    },
    randomBytes(length: number): Uint8Array {
      const result = new Uint8Array(length);
      crypto.getRandomValues(result);
      return result;
    },
    sha256(data: Uint8Array): Uint8Array {
      const result = new Uint8Array(32);
      for (let i = 0; i < data.length; i++) {
        result[i % 32] = (result[i % 32] + data[i]) & 0xff;
      }
      return result;
    },
  };
}

// =============================================================================
// In-memory KV store mock
// =============================================================================

function createMockKV() {
  const store = new Map<string, unknown>();

  return {
    store,
    async get<T>(key: string, _options?: { raw?: boolean }): Promise<Result<{ data: T }>> {
      if (!store.has(key)) {
        return {
          ok: false,
          error: { code: "KV_NOT_FOUND", message: `Not found: ${key}`, service: "kv" },
        } as any;
      }
      return { ok: true, data: { data: store.get(key) as T } };
    },
    async put(key: string, value: unknown): Promise<Result<{ data: void }>> {
      store.set(key, value);
      return { ok: true, data: { data: undefined } } as any;
    },
    async delete(key: string): Promise<Result<void>> {
      if (!store.has(key)) {
        return {
          ok: false,
          error: { code: "KV_NOT_FOUND", message: `Not found: ${key}`, service: "kv" },
        } as any;
      }
      store.delete(key);
      return { ok: true, data: undefined };
    },
    async list(options?: { prefix?: string; removePrefix?: boolean }): Promise<Result<{ keys: string[] }>> {
      const prefix = options?.prefix || "";
      const keys: string[] = [];
      for (const k of store.keys()) {
        if (k.startsWith(prefix)) {
          keys.push(options?.removePrefix ? k.slice(prefix.length) : k);
        }
      }
      return { ok: true, data: { keys } };
    },
    // Stubs for IKVService compliance
    initialize() {},
    onSessionChange() {},
    onSignOut() {},
    config: {},
    head: async () => ({ ok: true, data: { data: undefined } }),
    withPrefix: () => { throw new Error("not mocked"); },
  };
}

// =============================================================================
// Mock service context
// =============================================================================

function createMockContext(): IServiceContext {
  return {
    session: {
      delegationHeader: { Authorization: "test" },
      delegationCid: "test-cid",
      spaceId: "test-space",
      verificationMethod: "test-vm",
      jwk: {},
    },
    isAuthenticated: true,
    invoke: () => ({}),
    fetch: async () => ({ ok: true, status: 200, statusText: "OK", headers: { get: () => null }, json: async () => ({}), text: async () => "" }),
    hosts: ["http://localhost:8000"],
    getService: () => undefined,
    emit: () => {},
    on: () => () => {},
    abortSignal: new AbortController().signal,
    retryPolicy: { maxAttempts: 1, backoff: "none" as const, baseDelayMs: 0, maxDelayMs: 0, retryableErrors: [] },
  };
}

// =============================================================================
// Mock signer
// =============================================================================

function createMockSigner() {
  return {
    async signMessage(message: string): Promise<string> {
      return `sig:${message}`;
    },
  };
}

// =============================================================================
// Helper: create a configured vault service ready for testing
// =============================================================================

interface VaultSetup {
  vault: DataVaultService;
  kv: ReturnType<typeof createMockKV>;
  publicKV: ReturnType<typeof createMockKV>;
  crypto: VaultCrypto;
}

// Global registry of public KV stores keyed by publicSpaceId
// Allows readPublicSpace cross-user resolution
const publicKVRegistry = new Map<string, ReturnType<typeof createMockKV>>();

function createVault(options?: {
  spaceId?: string;
  did?: string;
  address?: string;
  chainId?: number;
}): VaultSetup {
  const crypto = createMockCrypto();
  const kv = createMockKV();
  const publicKV = createMockKV();
  const spaceId = options?.spaceId ?? "space-alice";
  const address = options?.address ?? "0xAlice";
  const chainId = options?.chainId ?? 1;
  const did = options?.did ?? `did:pkh:eip155:${chainId}:${address}`;

  const publicSpaceId = `public:${address}:${chainId}`;
  publicKVRegistry.set(publicSpaceId, publicKV);

  const vault = new DataVaultService({
    spaceId,
    crypto,
    tc: {
      kv: kv as any,
      publicKV: publicKV as any,
      ensurePublicSpace: async () => ({ ok: true, data: undefined }),
      readPublicSpace: async <T>(_host: string, sid: string, key: string): Promise<Result<T>> => {
        const store = publicKVRegistry.get(sid);
        if (!store) return { ok: false, error: { code: "NOT_FOUND", message: "Space not found", service: "kv" } } as any;
        const result = await store.get<T>(key);
        if (!result.ok) return { ok: false, error: { code: "NOT_FOUND", message: "Key not found", service: "kv" } } as any;
        return { ok: true, data: (result as any).data.data };
      },
      makePublicSpaceId: (addr: string, cid: number) => `public:${addr}:${cid}`,
      did,
      address,
      chainId,
      hosts: ["http://localhost:8000"],
    },
  });

  const ctx = createMockContext();
  vault.initialize(ctx);

  return { vault, kv, publicKV, crypto };
}

// =============================================================================
// Tests
// =============================================================================

describe("DataVaultService", () => {
  beforeEach(() => {
    publicKVRegistry.clear();
  });

  // ===========================================================================
  // Unlock / Lock lifecycle
  // ===========================================================================

  describe("unlock/lock lifecycle", () => {
    test("unlock sets isUnlocked and derives keys", async () => {
      const { vault } = createVault();
      expect(vault.isUnlocked).toBe(false);

      const result = await vault.unlock(createMockSigner());
      expect(result.ok).toBe(true);
      expect(vault.isUnlocked).toBe(true);
      expect(vault.publicKey).toBeInstanceOf(Uint8Array);
      expect(vault.publicKey.length).toBe(32);
    });

    test("lock clears key material", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());
      expect(vault.isUnlocked).toBe(true);

      vault.lock();
      expect(vault.isUnlocked).toBe(false);
      expect(() => vault.publicKey).toThrow("Vault is locked");
    });

    test("publicKey throws when locked", () => {
      const { vault } = createVault();
      expect(() => vault.publicKey).toThrow("Vault is locked");
    });

    test("unlock publishes metadata to public space", async () => {
      const { vault, publicKV } = createVault();
      await vault.unlock(createMockSigner());

      expect(publicKV.store.has(".well-known/vault-pubkey")).toBe(true);
      expect(publicKV.store.has(".well-known/vault-version")).toBe(true);
      expect(publicKV.store.get(".well-known/vault-version")).toBe("1");
      expect(publicKV.store.has(".well-known/vault-space")).toBe(true);
    });

    test("onSignOut locks the vault", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());
      expect(vault.isUnlocked).toBe(true);

      vault.onSignOut();
      expect(vault.isUnlocked).toBe(false);
    });
  });

  // ===========================================================================
  // CRUD operations
  // ===========================================================================

  describe("CRUD operations", () => {
    test("put/get round-trip with JSON object", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const data = { name: "Alice", age: 30, nested: { x: true } };
      const putResult = await vault.put("user/profile", data);
      expect(putResult.ok).toBe(true);

      const getResult = await vault.get<typeof data>("user/profile");
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.data.value).toEqual(data);
        expect(getResult.data.metadata["x-vault-cipher"]).toBe("aes-256-gcm");
        expect(getResult.data.keyId).toBeTruthy();
      }
    });

    test("put/get round-trip with string value (raw deserialization)", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      // String values are stored raw but contentType is "application/json",
      // so retrieve with raw: true to get the original bytes
      await vault.put("note", "hello world");
      const result = await vault.get("note", { raw: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        const text = new TextDecoder().decode(result.data.value as Uint8Array);
        expect(text).toBe("hello world");
      }
    });

    test("put/get round-trip with Uint8Array value", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const bytes = new Uint8Array([1, 2, 3, 4, 5]);
      await vault.put("binary", bytes);
      const result = await vault.get("binary", { raw: true });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(new Uint8Array(result.data.value as ArrayBuffer)).toEqual(bytes);
      }
    });

    test("get nonexistent key returns KEY_NOT_FOUND", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const result = await vault.get("nonexistent");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("KEY_NOT_FOUND");
      }
    });

    test("put overwrites existing value", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("key", { v: 1 });
      await vault.put("key", { v: 2 });
      const result = await vault.get<{ v: number }>("key");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.value).toEqual({ v: 2 });
      }
    });

    test("delete removes both key blob and encrypted value", async () => {
      const { vault, kv } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("to-delete", "gone");
      expect(kv.store.has("keys/to-delete")).toBe(true);
      expect(kv.store.has("vault/to-delete")).toBe(true);

      const delResult = await vault.delete("to-delete");
      expect(delResult.ok).toBe(true);
      expect(kv.store.has("keys/to-delete")).toBe(false);
      expect(kv.store.has("vault/to-delete")).toBe(false);
    });

    test("delete nonexistent key returns KEY_NOT_FOUND", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const result = await vault.delete("nope");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("KEY_NOT_FOUND");
      }
    });

    test("list returns all vault keys", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("a", "1");
      await vault.put("b", "2");
      await vault.put("c/d", "3");

      const result = await vault.list();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.sort()).toEqual(["a", "b", "c/d"]);
      }
    });

    test("list with prefix filters results", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("notes/a", "1");
      await vault.put("notes/b", "2");
      await vault.put("secrets/c", "3");

      const result = await vault.list({ prefix: "notes/" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        // removePrefix strips the full "vault/notes/" prefix, leaving just the key name
        expect(result.data.sort()).toEqual(["a", "b"]);
      }
    });

    test("head returns metadata without decrypting", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("doc", { x: 1 });
      const result = await vault.head("doc");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data["x-vault-cipher"]).toBe("aes-256-gcm");
        expect(result.data["x-vault-version"]).toBe("1");
        expect(result.data["x-vault-content-type"]).toBe("application/json");
        expect(result.data["x-vault-key-id"]).toBeTruthy();
      }
    });

    test("head nonexistent key returns KEY_NOT_FOUND", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const result = await vault.head("missing");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("KEY_NOT_FOUND");
      }
    });
  });

  // ===========================================================================
  // Locked vault errors
  // ===========================================================================

  describe("locked vault errors", () => {
    test("put returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.put("key", "value");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("get returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.get("key");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("delete returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.delete("key");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("list returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.list();
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("head returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.head("key");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("reencrypt returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.reencrypt("key", "did:pkh:eip155:1:0xBob");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("getShared returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.getShared("did:pkh:eip155:1:0xAlice", "key");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("listGrants returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.listGrants("key");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });

    test("revoke returns VAULT_LOCKED", async () => {
      const { vault } = createVault();
      const result = await vault.revoke("key", "did:pkh:eip155:1:0xBob");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("VAULT_LOCKED");
    });
  });

  // ===========================================================================
  // Batch operations
  // ===========================================================================

  describe("batch operations", () => {
    test("putMany stores multiple entries", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const results = await vault.putMany([
        { key: "a", value: "1" },
        { key: "b", value: "2" },
        { key: "c", value: "3" },
      ]);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.ok)).toBe(true);

      const listResult = await vault.list();
      if (listResult.ok) {
        expect(listResult.data.sort()).toEqual(["a", "b", "c"]);
      }
    });

    test("getMany retrieves multiple entries", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.putMany([
        { key: "x", value: { n: 10 } },
        { key: "y", value: { n: 20 } },
      ]);

      const results = await vault.getMany<{ n: number }>(["x", "y", "missing"]);
      expect(results).toHaveLength(3);
      expect(results[0].ok).toBe(true);
      expect(results[1].ok).toBe(true);
      expect(results[2].ok).toBe(false);
      if (results[0].ok) expect(results[0].data.value).toEqual({ n: 10 });
      if (results[1].ok) expect(results[1].data.value).toEqual({ n: 20 });
    });
  });

  // ===========================================================================
  // Sharing (grant / getShared / listGrants)
  // ===========================================================================

  describe("sharing", () => {
    test("grant/getShared round-trip between two users", async () => {
      // Alice: create vault and store data
      const alice = createVault({
        spaceId: "space-alice",
        did: "did:pkh:eip155:1:0xAlice",
        address: "0xAlice",
        chainId: 1,
      });
      await alice.vault.unlock(createMockSigner());

      const secret = { apiKey: "sk_live_abc123", service: "stripe" };
      await alice.vault.put("credentials/stripe", secret);

      // Bob: create vault, unlock to publish public key
      const bob = createVault({
        spaceId: "space-bob",
        did: "did:pkh:eip155:1:0xBob",
        address: "0xBob",
        chainId: 1,
      });
      await bob.vault.unlock(createMockSigner());

      // Alice grants Bob access
      const grantResult = await alice.vault.grant(
        "credentials/stripe",
        "did:pkh:eip155:1:0xBob"
      );
      expect(grantResult.ok).toBe(true);

      // Bob reads shared data using Alice's KV as the delegated access
      const sharedResult = await bob.vault.getShared<typeof secret>(
        "did:pkh:eip155:1:0xAlice",
        "credentials/stripe",
        { kv: alice.kv as any }
      );
      expect(sharedResult.ok).toBe(true);
      if (sharedResult.ok) {
        expect(sharedResult.data.value).toEqual(secret);
      }
    });

    test("listGrants returns all granted DIDs", async () => {
      const alice = createVault({
        spaceId: "space-alice",
        did: "did:pkh:eip155:1:0xAlice",
        address: "0xAlice",
        chainId: 1,
      });
      await alice.vault.unlock(createMockSigner());
      await alice.vault.put("doc", "data");

      // Grant to Bob and Charlie (using their public keys)
      const bob = createVault({ address: "0xBob", chainId: 1 });
      await bob.vault.unlock(createMockSigner());
      const charlie = createVault({ address: "0xCharlie", chainId: 1 });
      await charlie.vault.unlock(createMockSigner());

      await alice.vault.grant("doc", "did:pkh:eip155:1:0xBob");
      await alice.vault.grant("doc", "did:pkh:eip155:1:0xCharlie");

      const result = await alice.vault.listGrants("doc");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.sort()).toEqual([
          "did:pkh:eip155:1:0xBob",
          "did:pkh:eip155:1:0xCharlie",
        ]);
      }
    });

    test("grant to user without published key returns PUBLIC_KEY_NOT_FOUND", async () => {
      const alice = createVault({ address: "0xAlice", chainId: 1 });
      await alice.vault.unlock(createMockSigner());
      await alice.vault.put("doc", "data");

      // No vault created for 0xNobody — no public key published
      const result = await alice.vault.grant(
        "doc",
        "did:pkh:eip155:1:0xNobody"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PUBLIC_KEY_NOT_FOUND");
      }
    });

    test("grant to nonexistent key returns KEY_NOT_FOUND", async () => {
      const alice = createVault({ address: "0xAlice", chainId: 1 });
      await alice.vault.unlock(createMockSigner());

      const bob = createVault({ address: "0xBob", chainId: 1 });
      await bob.vault.unlock(createMockSigner());

      const result = await alice.vault.grant(
        "nonexistent",
        "did:pkh:eip155:1:0xBob"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("KEY_NOT_FOUND");
      }
    });

    test("getShared without kv option returns STORAGE_ERROR", async () => {
      const bob = createVault({ address: "0xBob", chainId: 1 });
      await bob.vault.unlock(createMockSigner());

      const result = await bob.vault.getShared(
        "did:pkh:eip155:1:0xAlice",
        "key"
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("STORAGE_ERROR");
        expect(result.error.message).toContain("delegated KV service");
      }
    });

    test("getShared with no grant returns GRANT_NOT_FOUND", async () => {
      const alice = createVault({
        spaceId: "space-alice",
        did: "did:pkh:eip155:1:0xAlice",
        address: "0xAlice",
        chainId: 1,
      });
      await alice.vault.unlock(createMockSigner());
      await alice.vault.put("doc", "data");

      const bob = createVault({
        did: "did:pkh:eip155:1:0xBob",
        address: "0xBob",
        chainId: 1,
      });
      await bob.vault.unlock(createMockSigner());

      const result = await bob.vault.getShared(
        "did:pkh:eip155:1:0xAlice",
        "doc",
        { kv: alice.kv as any }
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("GRANT_NOT_FOUND");
      }
    });

    test("grant (deprecated alias) delegates to reencrypt", async () => {
      const alice = createVault({ address: "0xAlice", chainId: 1 });
      await alice.vault.unlock(createMockSigner());
      await alice.vault.put("doc", "data");

      const bob = createVault({ address: "0xBob", chainId: 1 });
      await bob.vault.unlock(createMockSigner());

      // grant() and reencrypt() should produce the same result
      const result = await alice.vault.grant("doc", "did:pkh:eip155:1:0xBob");
      expect(result.ok).toBe(true);

      // Verify grant was stored
      const grants = await alice.vault.listGrants("doc");
      expect(grants.ok).toBe(true);
      if (grants.ok) {
        expect(grants.data).toContain("did:pkh:eip155:1:0xBob");
      }
    });
  });

  // ===========================================================================
  // Revocation
  // ===========================================================================

  describe("revocation", () => {
    test("revoke rotates key and re-grants remaining users", async () => {
      const alice = createVault({
        spaceId: "space-alice",
        did: "did:pkh:eip155:1:0xAlice",
        address: "0xAlice",
        chainId: 1,
      });
      await alice.vault.unlock(createMockSigner());
      await alice.vault.put("secret", { password: "hunter2" });

      // Grant to Bob and Charlie
      const bob = createVault({ address: "0xBob", chainId: 1 });
      await bob.vault.unlock(createMockSigner());
      const charlie = createVault({ address: "0xCharlie", chainId: 1 });
      await charlie.vault.unlock(createMockSigner());

      await alice.vault.grant("secret", "did:pkh:eip155:1:0xBob");
      await alice.vault.grant("secret", "did:pkh:eip155:1:0xCharlie");

      // Capture key ID before revoke
      const headBefore = await alice.vault.head("secret");
      const keyIdBefore = headBefore.ok ? headBefore.data["x-vault-key-id"] : "";

      // Revoke Bob
      const revokeResult = await alice.vault.revoke(
        "secret",
        "did:pkh:eip155:1:0xBob"
      );
      expect(revokeResult.ok).toBe(true);

      // Key ID should have changed (key rotation)
      const headAfter = await alice.vault.head("secret");
      const keyIdAfter = headAfter.ok ? headAfter.data["x-vault-key-id"] : "";
      expect(keyIdAfter).not.toBe(keyIdBefore);

      // Charlie should still be in grants
      const grants = await alice.vault.listGrants("secret");
      expect(grants.ok).toBe(true);
      if (grants.ok) {
        expect(grants.data).toContain("did:pkh:eip155:1:0xCharlie");
        expect(grants.data).not.toContain("did:pkh:eip155:1:0xBob");
      }

      // Data should still be readable by owner
      const getResult = await alice.vault.get<{ password: string }>("secret");
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.data.value.password).toBe("hunter2");
      }

      // Charlie can still read via getShared
      const charlieShared = await charlie.vault.getShared<{ password: string }>(
        "did:pkh:eip155:1:0xAlice",
        "secret",
        { kv: alice.kv as any }
      );
      expect(charlieShared.ok).toBe(true);
      if (charlieShared.ok) {
        expect(charlieShared.data.value.password).toBe("hunter2");
      }
    });

    test("revoke when key has no grants still rotates the key", async () => {
      const alice = createVault({ address: "0xAlice", chainId: 1 });
      await alice.vault.unlock(createMockSigner());
      await alice.vault.put("solo", { content: "data" });

      const headBefore = await alice.vault.head("solo");
      const keyIdBefore = headBefore.ok ? headBefore.data["x-vault-key-id"] : "";

      // Revoke a DID that was never granted — should still rotate
      const result = await alice.vault.revoke(
        "solo",
        "did:pkh:eip155:1:0xNobody"
      );
      expect(result.ok).toBe(true);

      const headAfter = await alice.vault.head("solo");
      const keyIdAfter = headAfter.ok ? headAfter.data["x-vault-key-id"] : "";
      expect(keyIdAfter).not.toBe(keyIdBefore);

      // Data should still be readable
      const getResult = await alice.vault.get<{ content: string }>("solo");
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.data.value.content).toBe("data");
      }
    });
  });

  // ===========================================================================
  // DID parsing edge cases
  // ===========================================================================

  describe("resolvePublicKey", () => {
    test("invalid DID format returns PUBLIC_KEY_NOT_FOUND", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const result = await vault.resolvePublicKey("not-a-did");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PUBLIC_KEY_NOT_FOUND");
      }
    });

    test("valid DID with missing public key returns PUBLIC_KEY_NOT_FOUND", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      const result = await vault.resolvePublicKey("did:pkh:eip155:1:0xNoOne");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("PUBLIC_KEY_NOT_FOUND");
      }
    });

    test("resolves published public key", async () => {
      // Bob publishes his key
      const bob = createVault({ address: "0xBob", chainId: 1 });
      await bob.vault.unlock(createMockSigner());

      // Alice resolves Bob's key
      const alice = createVault({ address: "0xAlice", chainId: 1 });
      await alice.vault.unlock(createMockSigner());

      const result = await alice.vault.resolvePublicKey("did:pkh:eip155:1:0xBob");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBeInstanceOf(Uint8Array);
        expect(result.data.length).toBe(32);
      }
    });
  });

  // ===========================================================================
  // Custom serialization
  // ===========================================================================

  describe("custom serialization", () => {
    test("put with custom contentType", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("doc.txt", "plain text", {
        contentType: "text/plain",
      });

      const head = await vault.head("doc.txt");
      expect(head.ok).toBe(true);
      if (head.ok) {
        expect(head.data["x-vault-content-type"]).toBe("text/plain");
      }
    });

    test("put with custom metadata", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("tagged", "data", {
        metadata: { "x-custom-tag": "important" },
      });

      const head = await vault.head("tagged");
      expect(head.ok).toBe(true);
      if (head.ok) {
        expect(head.data["x-custom-tag"]).toBe("important");
      }
    });

    test("get with custom deserializer", async () => {
      const { vault } = createVault();
      await vault.unlock(createMockSigner());

      await vault.put("csv", "a,b,c");
      const result = await vault.get("csv", {
        deserialize: (bytes) => new TextDecoder().decode(bytes).split(","),
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.value).toEqual(["a", "b", "c"]);
      }
    });
  });
});
