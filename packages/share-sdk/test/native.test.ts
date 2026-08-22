import { describe, expect, it } from "bun:test";
import { createNativeShare, nativeShareUrl, openNativeShare, parseNativeShareUrl } from "../src/native.js";

describe("TinyCloud-native share", () => {
  it("writes to the owner, invokes with an ordinary bounded delegation, and keeps its receiver key in the fragment", async () => {
    const bytes = new Uint8Array([0, 1, 2, 255]);
    const calls: string[] = [];
    const recipient = {
      did: "did:key:zRecipient",
      exportSessionKey: () => ({ kty: "OKP", d: "private" }),
      useDelegation: async (delegation: unknown) => {
        calls.push(`invoke:${JSON.stringify(delegation)}`);
        return { kv: { get: async (path: string) => {
          calls.push(`get:${path}`);
          return { ok: true, data: { data: bytes } };
        } } };
      },
    };
    const owner = {
      kv: { put: async (path: string, value: Uint8Array) => {
        calls.push(`put:${path}:${Array.from(value).join(",")}`);
        return { ok: true };
      } },
      createDelegation: async (params: unknown) => {
        calls.push(`delegate:${JSON.stringify(params)}`);
        return { cid: "ordinary-delegation" };
      },
    };
    const link = await createNativeShare(owner, recipient, { path: "shares/demo.bin", bytes, expiresInMs: 60_000 });
    const url = nativeShareUrl("https://unrelated.example", link);
    expect(url).not.toContain("private");
    expect(new URL(url).hash).toContain("tc-share=");
    const parsed = parseNativeShareUrl(url);
    expect(await openNativeShare(recipient, parsed)).toEqual(bytes);
    expect(calls).toEqual([
      "put:shares/demo.bin:0,1,2,255",
      'delegate:{"path":"shares/demo.bin","actions":["tinycloud.kv/get"],"delegateDID":"did:key:zRecipient","expiryMs":60000,"disableSubDelegation":true,"includePublicSpace":false}',
      'invoke:{"cid":"ordinary-delegation"}',
      "get:",
    ]);
  });
});
