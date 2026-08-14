import { describe, expect, test } from "bun:test";
import { credentialRequirementDigest } from "../credentials";
import { policyV2DigestHex, validatePolicyCredentialRequirementV1, validateUnifiedPolicyV2 } from "./credential-admission";
import { policyCidFromCanonicalBytes, policyIdForDigestHex } from "./unified";
import { jcsCanonicalize } from "./jcs";

describe("TC-470 policy credential contract", () => {
  test("matches the canonical policy-engine requirement projection vector", async () => {
    const vector = (await Bun.file(
      `${import.meta.dir}/../../test-fixtures/policy-engine-vectors/unified-policy/credential-requirement.json`,
    ).json()) as any;

    expect(await credentialRequirementDigest(vector.sdkRequirement)).toBe(
      vector.requirementDigest,
    );
    expect(validatePolicyCredentialRequirementV1(vector.policyProjection)).toEqual(
      vector.policyProjection,
    );
    expect(JSON.stringify(vector.policyProjection)).not.toContain(
      vector.sdkRequirement.claims.email,
    );
  });

  test("accepts an exact-email plaintext policy with only KV get authority", async () => {
    const vector = (await Bun.file(`${import.meta.dir}/../../test-fixtures/policy-engine-vectors/unified-policy/credential-requirement.json`).json()) as any;
    const source = { type: "xyz.tinycloud.share/plaintext-kv/v1", shareId: "plain-1", kvResource: "tinycloud:space/kv/shares/plain-1/report.txt", selector: "exact", mode: "mutable", contentDigestHex: "a".repeat(64) };
    const unsigned = { schema: "xyz.tinycloud.policy/policy/v2", ownerDid: "did:key:zowner", createdAt: "2026-08-03T12:00:00Z", expiresAt: "2026-08-04T12:00:00Z", contentSource: source, capabilityCeiling: [{ kind: "kv", resource: source.kvResource, selector: "exact", actions: ["tinycloud.kv/get"] }], credentialRequirement: vector.policyProjection };
    const policy = { ...unsigned, policyId: policyIdForDigestHex(policyV2DigestHex(unsigned as any)), signature: { suite: "Ed25519", signerDid: unsigned.ownerDid, value: "signature" } };
    const cid = policyCidFromCanonicalBytes(new TextEncoder().encode(jcsCanonicalize(policy as any)));
    expect(validateUnifiedPolicyV2(policy, cid).contentSource).toEqual(source);
  });
});
