import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import {
  TCWSessionManager,
  importKeyFromBase64,
  exportKeyAsBase64,
  importKeyFromEnvValue,
  loadKeyFromEnv,
  signSecp256k1,
  signEthereumMessage,
  prepareSession,
  makeNamespaceId,
  ensureEip55,
  initPanicHook,
} from "../src/index.js";

// Initialize panic hook for better error messages
initPanicHook();

describe("Node SDK WASM", () => {
  describe("Session Manager", () => {
    test("creates a new session manager", () => {
      const manager = new TCWSessionManager();
      expect(manager).toBeDefined();
    });

    test("lists session keys with default key", () => {
      const manager = new TCWSessionManager();
      const keys = manager.listSessionKeys();
      expect(keys).toContain("default");
    });

    test("creates session key with custom ID", () => {
      const manager = new TCWSessionManager();
      const keyId = manager.createSessionKey("test-key");
      expect(keyId).toBe("test-key");
      const keys = manager.listSessionKeys();
      expect(keys).toContain("test-key");
    });

    test("gets DID for session key", () => {
      const manager = new TCWSessionManager();
      const did = manager.getDID();
      expect(did).toMatch(/^did:key:z[a-zA-Z0-9]+$/);
    });

    test("renames session key", () => {
      const manager = new TCWSessionManager();
      manager.renameSessionKeyId("default", "renamed");
      const keys = manager.listSessionKeys();
      expect(keys).not.toContain("default");
      expect(keys).toContain("renamed");
    });

    test("fails to create duplicate key", () => {
      const manager = new TCWSessionManager();
      expect(() => manager.createSessionKey("default")).toThrow();
    });

    test("gets JWK for session key", () => {
      const manager = new TCWSessionManager();
      const jwk = manager.jwk();
      expect(jwk).toBeDefined();
      expect(jwk).toContain('"kty"');
      expect(jwk).toContain('"crv":"Ed25519"');
    });
  });

  describe("Key Import/Export (Base64)", () => {
    test("exports key as base64", () => {
      const manager = new TCWSessionManager();
      const exported = exportKeyAsBase64(manager);
      expect(exported).toBeDefined();

      // Verify it's valid base64
      const decoded = Buffer.from(exported, "base64").toString("utf-8");
      const jwk = JSON.parse(decoded);
      expect(jwk.kty).toBe("OKP");
      expect(jwk.crv).toBe("Ed25519");
    });

    test("imports key from base64", () => {
      const manager1 = new TCWSessionManager();
      const exported = exportKeyAsBase64(manager1);
      const did1 = manager1.getDID();

      const manager2 = new TCWSessionManager();
      importKeyFromBase64(manager2, exported, "imported");
      const did2 = manager2.getDID("imported");

      expect(did1).toBe(did2);
    });

    test("round-trips key export/import", () => {
      const manager = new TCWSessionManager();
      const original = exportKeyAsBase64(manager);
      const originalDid = manager.getDID();

      importKeyFromBase64(manager, original, "copy");
      const copyDid = manager.getDID("copy");

      // The DIDs should match (same underlying key)
      expect(originalDid).toBe(copyDid);

      // The exported JWKs will differ only in `kid` field
      const copy = exportKeyAsBase64(manager, "copy");
      const originalJwk = JSON.parse(Buffer.from(original, "base64").toString());
      const copyJwk = JSON.parse(Buffer.from(copy, "base64").toString());

      // Verify key material is identical (x and d are the actual key)
      expect(copyJwk.kty).toBe(originalJwk.kty);
      expect(copyJwk.crv).toBe(originalJwk.crv);
      expect(copyJwk.x).toBe(originalJwk.x);
      expect(copyJwk.d).toBe(originalJwk.d);
    });

    test("fails to import invalid base64", () => {
      const manager = new TCWSessionManager();
      expect(() => importKeyFromBase64(manager, "not-valid-base64!!!", "bad")).toThrow();
    });

    test("fails to import invalid JWK", () => {
      const manager = new TCWSessionManager();
      const invalidJwk = Buffer.from('{"invalid": "jwk"}').toString("base64");
      expect(() => importKeyFromBase64(manager, invalidJwk, "bad")).toThrow();
    });
  });

  describe("Environment Variable Loading", () => {
    const TEST_ENV_VAR = "TEST_TINYCLOUD_KEY";
    let testKey: string;

    beforeEach(() => {
      const tempManager = new TCWSessionManager();
      testKey = exportKeyAsBase64(tempManager);
      process.env[TEST_ENV_VAR] = testKey;
    });

    afterEach(() => {
      delete process.env[TEST_ENV_VAR];
    });

    test("loads key from environment variable", () => {
      const manager = new TCWSessionManager();
      const keyId = loadKeyFromEnv(manager, TEST_ENV_VAR, "env-loaded");

      expect(keyId).toBe("env-loaded");
      expect(manager.listSessionKeys()).toContain("env-loaded");
    });

    test("throws when env var is not set", () => {
      const manager = new TCWSessionManager();
      expect(() => loadKeyFromEnv(manager, "NONEXISTENT_VAR")).toThrow(
        "Environment variable NONEXISTENT_VAR is not set"
      );
    });

    test("loaded key matches original", () => {
      // Get DID from original key
      const tempManager = new TCWSessionManager();
      importKeyFromBase64(tempManager, testKey, "original");
      const originalDid = tempManager.getDID("original");

      // Load from env and compare
      const manager = new TCWSessionManager();
      loadKeyFromEnv(manager, TEST_ENV_VAR, "env-loaded");
      const loadedDid = manager.getDID("env-loaded");

      // DIDs should match (same underlying key)
      expect(loadedDid).toBe(originalDid);
    });

    test("importKeyFromEnvValue works directly", () => {
      const manager = new TCWSessionManager();
      const keyId = importKeyFromEnvValue(manager, testKey, "direct-import");
      expect(keyId).toBe("direct-import");
    });
  });

  describe("Secp256k1 Signing (Ethereum)", () => {
    // Test private key (DO NOT USE IN PRODUCTION)
    // This is just 32 bytes of deterministic test data
    const TEST_PRIVATE_KEY = Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex"
    ).toString("base64");

    test("signs message with secp256k1", () => {
      const message = new TextEncoder().encode("test message");
      const signature = signSecp256k1(message, TEST_PRIVATE_KEY);

      expect(signature).toBeInstanceOf(Uint8Array);
      expect(signature.length).toBe(64); // r + s (32 bytes each)
    });

    test("produces deterministic signatures", () => {
      const message = new TextEncoder().encode("deterministic test");
      const sig1 = signSecp256k1(message, TEST_PRIVATE_KEY);
      const sig2 = signSecp256k1(message, TEST_PRIVATE_KEY);

      // ECDSA with RFC 6979 is deterministic
      expect(sig1).toEqual(sig2);
    });

    test("different messages produce different signatures", () => {
      const msg1 = new TextEncoder().encode("message 1");
      const msg2 = new TextEncoder().encode("message 2");

      const sig1 = signSecp256k1(msg1, TEST_PRIVATE_KEY);
      const sig2 = signSecp256k1(msg2, TEST_PRIVATE_KEY);

      expect(sig1).not.toEqual(sig2);
    });

    test("fails with invalid private key", () => {
      const message = new TextEncoder().encode("test");
      const invalidKey = Buffer.from("too short").toString("base64");
      expect(() => signSecp256k1(message, invalidKey)).toThrow();
    });
  });

  describe("Ethereum Message Signing", () => {
    const TEST_PRIVATE_KEY = Buffer.from(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      "hex"
    ).toString("base64");

    test("signs Ethereum message with recovery", () => {
      const signature = signEthereumMessage("Hello, Ethereum!", TEST_PRIVATE_KEY);

      // 65 bytes as hex = 130 characters
      expect(signature).toMatch(/^[0-9a-f]{130}$/);

      // Last byte should be 27 or 28 (recovery id)
      const recoveryByte = parseInt(signature.slice(-2), 16);
      expect(recoveryByte).toBeGreaterThanOrEqual(27);
      expect(recoveryByte).toBeLessThanOrEqual(28);
    });

    test("produces deterministic signatures", () => {
      const sig1 = signEthereumMessage("test message", TEST_PRIVATE_KEY);
      const sig2 = signEthereumMessage("test message", TEST_PRIVATE_KEY);
      expect(sig1).toBe(sig2);
    });

    test("different messages produce different signatures", () => {
      const sig1 = signEthereumMessage("message 1", TEST_PRIVATE_KEY);
      const sig2 = signEthereumMessage("message 2", TEST_PRIVATE_KEY);
      expect(sig1).not.toBe(sig2);
    });

    test("handles empty message", () => {
      const signature = signEthereumMessage("", TEST_PRIVATE_KEY);
      expect(signature).toMatch(/^[0-9a-f]{130}$/);
    });

    test("handles unicode message", () => {
      const signature = signEthereumMessage("Hello, World!", TEST_PRIVATE_KEY);
      expect(signature).toMatch(/^[0-9a-f]{130}$/);
    });
  });

  describe("Utility Functions", () => {
    test("makeNamespaceId creates valid namespace ID", () => {
      const address = "0x1234567890123456789012345678901234567890";
      const namespaceId = makeNamespaceId(address, 1, "test");

      expect(namespaceId).toContain("tinycloud:pkh:eip155:1:");
      expect(namespaceId).toContain(":test");
    });

    test("ensureEip55 checksums address", () => {
      const lowercase = "0xabcdef1234567890abcdef1234567890abcdef12";
      const checksummed = ensureEip55(lowercase);

      // Should be 42 characters (0x + 40 hex chars)
      expect(checksummed).toMatch(/^0x[0-9a-fA-F]{40}$/);
      // Should have mixed case (checksummed)
      expect(checksummed).not.toBe(lowercase);
    });

    test("ensureEip55 is idempotent", () => {
      const address = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
      const checksummed1 = ensureEip55(address);
      const checksummed2 = ensureEip55(checksummed1);
      expect(checksummed1).toBe(checksummed2);
    });
  });

  describe("Session Preparation", () => {
    test("prepares session with config", () => {
      const config = {
        abilities: { kv: { "test/path": ["tinycloud.kv/get", "tinycloud.kv/put"] } },
        address: "0x1234567890123456789012345678901234567890",
        chainId: 1,
        domain: "example.com",
        issuedAt: new Date().toISOString(),
        namespaceId:
          "tinycloud:pkh:eip155:1:0x1234567890123456789012345678901234567890:test",
        expirationTime: new Date(Date.now() + 86400000).toISOString(),
      };

      const prepared = prepareSession(config);

      expect(prepared).toBeDefined();
      expect(prepared.jwk).toBeDefined();
      expect(prepared.siwe).toBeDefined();
      expect(prepared.verificationMethod).toMatch(/^did:key:/);
    });

    test("prepares session with optional fields", () => {
      const config = {
        abilities: { kv: { "path": ["tinycloud.kv/get"] } },
        address: "0x1234567890123456789012345678901234567890",
        chainId: 1,
        domain: "example.com",
        issuedAt: new Date().toISOString(),
        namespaceId:
          "tinycloud:pkh:eip155:1:0x1234567890123456789012345678901234567890:test",
        expirationTime: new Date(Date.now() + 86400000).toISOString(),
        notBefore: new Date().toISOString(),
      };

      const prepared = prepareSession(config);
      expect(prepared).toBeDefined();
    });
  });

  describe("Multiple Key Management", () => {
    test("manages multiple keys independently", () => {
      const manager = new TCWSessionManager();

      // Create additional keys
      manager.createSessionKey("key-1");
      manager.createSessionKey("key-2");

      // Each key should have a different DID
      const did0 = manager.getDID("default");
      const did1 = manager.getDID("key-1");
      const did2 = manager.getDID("key-2");

      expect(did0).not.toBe(did1);
      expect(did1).not.toBe(did2);
      expect(did0).not.toBe(did2);
    });

    test("exports and imports keys with different IDs", () => {
      const manager = new TCWSessionManager();
      manager.createSessionKey("source");

      const exported = exportKeyAsBase64(manager, "source");
      importKeyFromBase64(manager, exported, "destination");

      const sourceDid = manager.getDID("source");
      const destDid = manager.getDID("destination");

      expect(sourceDid).toBe(destDid);
    });
  });
});
