import { describe, expect, test } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519";
import { sha256 } from "@noble/hashes/sha256";
import { decodeBase64Url, encodeBase64Url } from "../credentials";
import { jcsCanonicalize } from "./jcs";
import {
  POLICY_PRESENTATION_V4_DOMAIN,
  signPolicyCredentialPresentationV4,
  validatePolicyCredentialAdmissionV4Authority,
  type UnsignedPolicyCredentialPresentationV4,
} from "./credential-admission";
import { requestPolicyChallengeV3 } from "./unified";

describe("TC-500 policy presentation v4", () => {
  test("matches the frozen cross-language golden vector", async () => {
    const vector = (await Bun.file(
      `${import.meta.dir}/../../test-vectors/policy-presentation-v4.json`,
    ).json()) as any;
    const seed = decodeBase64Url(vector.holderSeedBase64Url);
    expect(jcsCanonicalize(vector.unsigned)).toBe(vector.canonicalUnsigned);
    expect(encodeBase64Url(sha256(new TextEncoder().encode(
      POLICY_PRESENTATION_V4_DOMAIN + vector.canonicalUnsigned,
    )))).toBe(vector.signingDigestBase64Url);
    const presentation = await signPolicyCredentialPresentationV4(
      vector.unsigned as UnsignedPolicyCredentialPresentationV4,
      async (digest) => ed25519.sign(digest, seed),
    );
    expect(presentation.signature.value).toBe(vector.signatureBase64Url);
    expect(presentation.signature.signerDid).toBe(vector.holderDid);
    expect("accountAuthorizationCid" in presentation).toBe(false);
    expect("credentialSpaceId" in presentation).toBe(false);
  });

  test("rejects account fields and broken key continuity", async () => {
    const vector = (await Bun.file(
      `${import.meta.dir}/../../test-vectors/policy-presentation-v4.json`,
    ).json()) as any;
    const seed = decodeBase64Url(vector.holderSeedBase64Url);
    await expect(signPolicyCredentialPresentationV4(
      { ...vector.unsigned, accountAuthorizationCid: "forbidden" },
      async (digest) => ed25519.sign(digest, seed),
    )).rejects.toThrow("unknown or missing field");
    await expect(signPolicyCredentialPresentationV4(
      { ...vector.unsigned, subjectDid: "did:key:zBroken" },
      async (digest) => ed25519.sign(digest, seed),
    )).rejects.toThrow("invalid");
  });

  test("requires out-of-band runtime Node and enforcer authority", () => {
    const nodeAudience = "did:key:z6MkRuntimeNode";
    const enforcerDid = "did:key:z6MkEnforcer";
    const session = {
      iss: `${nodeAudience}#key`,
      fact: { nodeAudience, enforcerDid },
    } as any;
    expect(() => validatePolicyCredentialAdmissionV4Authority(session, { nodeAudience, enforcerDid })).not.toThrow();
    expect(() => validatePolicyCredentialAdmissionV4Authority(session, { nodeAudience: "did:key:z6MkAttacker", enforcerDid })).toThrow("authority binding");
    expect(() => validatePolicyCredentialAdmissionV4Authority(session, { nodeAudience, enforcerDid: "did:key:z6MkAttacker" })).toThrow("authority binding");
  });

  test("uses only the embedded Node policy route", async () => {
    const calls: string[] = [];
    const challenge = await requestPolicyChallengeV3({
      nodeOrigin: "https://node.example",
      policyCid: "bafy-policy",
      recipientDid: "did:key:zHolder",
      requestedCapabilities: [],
      fetch: (async (input) => {
        calls.push(String(input));
        return new Response(JSON.stringify({
          challengeId: "challenge",
          nonce: "nonce",
          policyCid: "bafy-policy",
          recipientDid: "did:key:zHolder",
        }), { headers: { "content-type": "application/json" } });
      }) as typeof fetch,
    });
    expect(challenge.challengeId).toBe("challenge");
    expect(calls).toEqual(["https://node.example/policy/v3/challenges"]);
    expect(calls.some((url) => url.includes("/share/"))).toBe(false);
    await expect(requestPolicyChallengeV3({
      nodeOrigin: "https://node.example",
      policyRuntimePath: "/share/v3/policy",
      policyCid: "bafy-policy",
      recipientDid: "did:key:zHolder",
      requestedCapabilities: [],
      fetch: (async () => new Response()) as typeof fetch,
    })).rejects.toThrow("policy runtime path is invalid");
  });
});
