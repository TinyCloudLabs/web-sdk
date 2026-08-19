import { describe, expect, test } from "bun:test";
import { GENERIC_DELEGATION_IMPORT_PATH, POLICY_PARENT_REGISTRATION_PATH, registerPolicyParentDelegation } from "./parent";
import type { PolicyAccessHttpRequest, PolicyAccessTransport } from "./transport";

const base = {
  policyEngineEndpoint: "https://policy.example",
  nodeEndpoint: "https://node.example",
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
  test("persists the generic parent before registering it with the Policy Engine", async () => {
    const requests: PolicyAccessHttpRequest[] = [];
    const transport: PolicyAccessTransport = { async request(request) {
      requests.push(request);
      return new URL(request.url).pathname === GENERIC_DELEGATION_IMPORT_PATH
        ? { status: 200, body: { cid: base.delegationCid }, finalUrl: request.url }
        : { status: 200, body: { registeredDelegationId: base.delegationCid }, finalUrl: request.url };
    } };
    await registerPolicyParentDelegation({ ...base, transport });
    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([GENERIC_DELEGATION_IMPORT_PATH, POLICY_PARENT_REGISTRATION_PATH]);
    expect(requests[0]?.headers?.authorization).toBe(`Bearer ${base.authorization}`);
    expect(requests.some((request) => new URL(request.url).pathname.startsWith("/share/"))).toBe(false);
  });
});
