import { describe, expect, test } from "bun:test";
import { POLICY_PARENT_REGISTRATION_PATH, registerPolicyParentDelegation } from "./parent";
import type { PolicyAccessHttpRequest, PolicyAccessTransport } from "./transport";

const base = {
  policyEngineEndpoint: "https://policy.example",
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
  test("registers directly with the Policy Engine", async () => {
    const requests: PolicyAccessHttpRequest[] = [];
    const transport: PolicyAccessTransport = { async request(request) {
      requests.push(request);
      return { status: 200, body: { registeredDelegationId: base.delegationCid }, finalUrl: request.url };
    } };
    await registerPolicyParentDelegation({ ...base, transport });
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([POLICY_PARENT_REGISTRATION_PATH]);
    expect(requests.some((request) => new URL(request.url).pathname.startsWith("/share/"))).toBe(false);
  });
});
