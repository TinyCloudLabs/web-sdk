import { ed25519 } from "@noble/curves/ed25519";
import { describe, expect, it } from "vitest";

import {
  didKeyFromEd25519PublicKey,
  signCompactUcanAuthorization,
  verifyCompactUcanAuthorization,
} from "../src/index.js";

describe("compact UCAN browser compatibility", () => {
  it("does not depend on a Buffer polyfill supporting the base64url encoding", async () => {
    const privateKey = new Uint8Array(32).fill(61);
    const issuerDid = didKeyFromEd25519PublicKey(ed25519.getPublicKey(privateKey));
    const authorization = await signCompactUcanAuthorization({
      issuerDid,
      audienceDid: "did:web:node.example.test",
      attenuation: { "tinycloud:test": { "tinycloud.kv/get": [{}] } },
      facts: [{ role: "browser-compatibility" }],
      proofs: [],
      notBefore: 1_800_000_000,
      expiresAt: 1_800_000_060,
      nonce: "browser-compatibility",
      sign: async (bytes) => ed25519.sign(bytes, privateKey),
    });
    const original = Object.getOwnPropertyDescriptor(globalThis, "Buffer");
    Object.defineProperty(globalThis, "Buffer", {
      configurable: true,
      value: {
        from(_value: unknown, encoding?: string) {
          if (encoding === "base64url") throw new TypeError("Unknown encoding: base64url");
          throw new TypeError("unexpected Buffer use");
        },
      },
    });
    try {
      expect(verifyCompactUcanAuthorization(authorization.authorization, authorization.cid).cid).toBe(authorization.cid);
    } finally {
      if (original === undefined) delete (globalThis as { Buffer?: unknown }).Buffer;
      else Object.defineProperty(globalThis, "Buffer", original);
    }
  });
});
