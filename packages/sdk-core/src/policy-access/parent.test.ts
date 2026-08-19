import { describe, expect, test } from "bun:test";
import { POLICY_PARENT_REGISTRATION_PATH, registerPolicyParentDelegation } from "./parent";
import type { PolicyAccessHttpRequest, PolicyAccessTransport } from "./transport";

const base = {
  policyEngineEndpoint: "https://policy.example",
  ownerNodeEndpoint: "https://node.example",
  ownerNodeSpaceId: "tinycloud:key:owner:default",
  ownerDid: "did:key:z6MkOwner",
  authorization: "header.payload.signature",
  delegationCid: "bafkr4iparent",
  nativeResource: "tinycloud:key:owner:default/kv/docs/a",
  policyCapability: {
    service: "tinycloud.kv",
    space: "tinycloud:key:owner:default",
    path: "docs/a",
    actions: ["tinycloud.kv/get"],
  },
} as const;

describe("policy issuance parent registration", () => {
  test("uses only generic Node and Policy Engine routes", async () => {
    const requests: PolicyAccessHttpRequest[] = [];
    const transport: PolicyAccessTransport = { async request(request) {
      requests.push(request);
      return request.url.endsWith("/delegate")
        ? { status: 200, body: { activated: [base.ownerNodeSpaceId], skipped: [] }, finalUrl: request.url }
        : { status: 200, body: { registeredDelegationId: base.delegationCid }, finalUrl: request.url };
    } };
    await registerPolicyParentDelegation({ ...base, transport });
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      "/delegate",
      POLICY_PARENT_REGISTRATION_PATH,
    ]);
    expect(requests.some((request) => new URL(request.url).pathname.startsWith("/share/"))).toBe(false);
  });

  test("does not register a parent the Node did not activate", async () => {
    let calls = 0;
    const transport: PolicyAccessTransport = { async request(request) {
      calls += 1;
      return { status: 200, body: { activated: [], skipped: [base.ownerNodeSpaceId] }, finalUrl: request.url };
    } };
    await expect(registerPolicyParentDelegation({ ...base, transport })).rejects.toThrow("refused");
    expect(calls).toBe(1);
  });
});
