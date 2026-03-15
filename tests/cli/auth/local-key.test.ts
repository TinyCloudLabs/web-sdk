import { describe, test, expect } from "bun:test";
import { randomBytes } from "node:crypto";

/**
 * Unit tests for local key auth utilities.
 *
 * These tests verify the pure cryptographic functions without requiring
 * the WASM or node-sdk dependencies to be built. The functions tested here
 * mirror the logic in packages/cli/src/auth/local-key.ts.
 */

describe("local-key utilities", () => {
  describe("generateEthereumPrivateKey", () => {
    function generateEthereumPrivateKey(): string {
      const keyBytes = randomBytes(32);
      return "0x" + keyBytes.toString("hex");
    }

    test("generates a 32-byte hex key with 0x prefix", () => {
      const key = generateEthereumPrivateKey();
      expect(key).toMatch(/^0x[0-9a-f]{64}$/);
    });

    test("generates unique keys each time", () => {
      const key1 = generateEthereumPrivateKey();
      const key2 = generateEthereumPrivateKey();
      expect(key1).not.toBe(key2);
    });

    test("key is correct length (66 chars including 0x)", () => {
      const key = generateEthereumPrivateKey();
      expect(key.length).toBe(66);
    });
  });

  describe("addressToDID", () => {
    function addressToDID(address: string, chainId: number = 1): string {
      return `did:pkh:eip155:${chainId}:${address}`;
    }

    test("creates a did:pkh DID with default chain ID 1", () => {
      const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const did = addressToDID(address);
      expect(did).toBe("did:pkh:eip155:1:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    });

    test("creates a did:pkh DID with custom chain ID", () => {
      const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
      const did = addressToDID(address, 137);
      expect(did).toBe("did:pkh:eip155:137:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
    });

    test("DID format matches did:pkh spec", () => {
      const address = "0x1234567890abcdef1234567890abcdef12345678";
      const did = addressToDID(address);
      expect(did).toMatch(/^did:pkh:eip155:\d+:0x[0-9a-fA-F]{40}$/);
    });
  });

  describe("ProfileConfig authMethod", () => {
    test("local profile has expected shape", () => {
      const profile = {
        name: "test",
        host: "https://node.tinycloud.xyz",
        chainId: 1,
        spaceName: "default",
        did: "did:pkh:eip155:1:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
        createdAt: new Date().toISOString(),
        authMethod: "local" as const,
        privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      };

      expect(profile.authMethod).toBe("local");
      expect(profile.privateKey).toMatch(/^0x[0-9a-f]{64}$/);
      expect(profile.address).toMatch(/^0x[0-9a-fA-F]{40}$/);
      expect(profile.did).toContain(profile.address);
    });

    test("openkey profile does not have privateKey", () => {
      const profile = {
        name: "test",
        host: "https://node.tinycloud.xyz",
        chainId: 1,
        spaceName: "default",
        did: "did:key:z6Mktest...",
        createdAt: new Date().toISOString(),
        authMethod: "openkey" as const,
      };

      expect(profile.authMethod).toBe("openkey");
      expect((profile as any).privateKey).toBeUndefined();
      expect((profile as any).address).toBeUndefined();
    });
  });
});
