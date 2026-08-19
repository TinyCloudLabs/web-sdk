import { describe, expect, it } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519";
import { createLabReportReader } from "../../examples/policy-access-reader/reader";
import { requestedCapabilitiesHashHex } from ".";
import { deriveDelegationCid } from "../requester";
import type {
  CredentialFlowDescriptor,
  CredentialRequirement,
} from "../credentials";
import type { PolicyAccessTransport } from "./transport";

/**
 * Drives the non-Share example end to end against scripted OpenCredentials,
 * Policy Engine, and TinyCloud Node responses. Its job is to prove that an
 * application which imports nothing from Share can complete the whole flow —
 * and that the resulting request trace contains no identity-provider call and
 * no application-specific node route.
 */

const ISSUER_ORIGIN = "https://witness.credentials.example";
const ENGINE_ORIGIN = "https://policy-engine.clinic.example";
const NODE_ORIGIN = "https://node.clinic.example";
const NODE_SPACE_ID = "did:pkh:eip155:1:0xclinic:default";
const CAPABILITY_SPACE = "tinycloud:did:pkh:eip155:1:0xclinic:default";
const REPORT_PATH = "reports/2026-08/cbc.md.enc";
const POLICY_ID = "pol_lab_report";
const AUDIENCE = "urn:tinycloud:policy-engine:clinic";
const PATIENT_EMAIL = "patient@clinic.example";
const REQUIREMENT_ID = "exact-email";

const GRANT_ISSUER_SEED = new Uint8Array(32).fill(5);
function didKey(publicKey: Uint8Array): string {
  const bs58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes = Uint8Array.from([0xed, 0x01, ...publicKey]);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = bs58[Number(value % 58n)] + out;
    value /= 58n;
  }
  return `did:key:z${out}`;
}
const GRANT_ISSUER_DID = didKey(ed25519.getPublicKey(GRANT_ISSUER_SEED));

const CAPABILITY = {
  service: "tinycloud.kv" as const,
  space: CAPABILITY_SPACE,
  path: REPORT_PATH,
  actions: ["tinycloud.kv/get"],
};

const requirement = {
  type: "TinyCloudCredentialRequirement",
  version: 1,
  profile: { id: "tinycloud.email-proof/v1", version: 1 },
  credentialType: { id: "opencredentials.email/v1", version: 1 },
  claims: { email: PATIENT_EMAIL },
  maxAgeSeconds: 3600,
} as unknown as CredentialRequirement;

const descriptor = {
  type: "tinycloud.credentials/descriptor/v1",
  contractVersion: 1,
  protocol: "tinycloud.credentials/acquisition/v1",
  profile: "tinycloud.email-proof/v1",
  profileVersion: 1,
  display: {
    title: "Confirm your email",
    description: "We will email you a one-time code.",
    consent: "Continue to confirm you control this mailbox.",
    securityTextLocked: true,
  },
  accessibility: { progressLabel: "Step", errorLiveRegion: "assertive" },
  theme: {
    tokenVersion: "tinycloud.credentials/tokens/v1",
    allowed: ["accentColor", "fontFamily", "borderRadius"],
  },
  issuer: {
    did: "did:web:witness.credentials.example",
    origin: "https://witness.credentials.example",
    kid: "did:web:witness.credentials.example#key-1",
  },
  interaction: {
    origin: "https://credentials.org",
    pathTemplate: "/credentials/acquire/{requestId}",
  },
  format: { id: "vc+sd-jwt", vct: "opencredentials.email/v1" },
  claims: [
    { name: "email", matching: "normalized_exact", selectiveDisclosure: true },
  ],
  subjectRelationship: "holder_is_subject",
  inputs: [
    {
      id: "email",
      label: "Email",
      schema: { type: "string", format: "email" },
      prefill: "privacy_hint_only",
      autocomplete: "off",
    },
  ],
  steps: [
    { type: "collect_input", version: 1 },
    { type: "mailbox_otp", version: 1 },
    { type: "holder_signature", version: 1 },
  ],
  holderBinding: {
    required: true,
    alg: "EdDSA",
    domain: "tinycloud.credentials/holder-binding/v1",
    version: 1,
  },
  endpoints: {
    request: "request",
    state: "state",
    challenge: "challenge",
    proof: "proof",
    holderBinding: "holder_binding",
    holderSignature: "holder_signature",
    issue: "issue",
    result: "result",
  },
  lifecycle: {
    requestTtlSeconds: 600,
    challengeTtlSeconds: 300,
    maxProofAttempts: 5,
    challengeConsumption: "atomic_once",
    retry: "bounded",
  },
  status: { type: "none", freshnessSeconds: 3600 },
  revocation: { supported: false },
  presentation: {
    stateVersion: "tinycloud.credentials/ux-states/v1",
    states: [
      "collecting",
      "challenging",
      "proving",
      "signing",
      "issuing",
      "verifying",
      "saving",
      "success",
      "recovery",
    ],
  },
} as unknown as CredentialFlowDescriptor;

function delegationFor(holderDid: string) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const att = {
    [`${CAPABILITY_SPACE}/kv/${REPORT_PATH}`]: { "tinycloud.kv/get": [{}] },
  };
  const header = { alg: "EdDSA", typ: "JWT", ucv: "0.10.0" };
  const payload = {
    iss: `${GRANT_ISSUER_DID}#${GRANT_ISSUER_DID.slice("did:key:".length)}`,
    aud: holderDid,
    att,
    prf: ["bafyparent"],
    nbf: nowSeconds,
    exp: nowSeconds + 120,
    fct: [
      {
        "xyz.tinycloud.policy/delegationMode": "terminal",
        "xyz.tinycloud.policy/policyId": POLICY_ID,
        "xyz.tinycloud.policy/capabilityHashHex":
          requestedCapabilitiesHashHex([CAPABILITY]),
        "xyz.tinycloud.policy/revocationMode": "refresh_only",
        "xyz.tinycloud.policy/issuanceId": "iss_clinic_1",
      },
    ],
  };
  const signingInput = `${Buffer.from(JSON.stringify(header)).toString(
    "base64url",
  )}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const encoded = `${signingInput}.${Buffer.from(
    ed25519.sign(new TextEncoder().encode(signingInput), GRANT_ISSUER_SEED),
  ).toString("base64url")}`;
  const rfc = (seconds: number) =>
    new Date(seconds * 1000).toISOString().replace(".000Z", "Z");
  return {
    delegationId: deriveDelegationCid(encoded),
    issuanceId: "iss_clinic_1",
    issuerDid: GRANT_ISSUER_DID,
    holderDid,
    policyId: POLICY_ID,
    capabilityHashHex: requestedCapabilitiesHashHex([CAPABILITY]),
    revocationMode: "refresh_only",
    issuedAt: rfc(nowSeconds),
    expiresAt: rfc(nowSeconds + 120),
    terminal: true,
    encoded,
  };
}

async function sealedReport(key: Uint8Array, markdown: string) {
  const nonce = new Uint8Array(12).fill(3);
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, [
    "encrypt",
  ]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      cryptoKey,
      new TextEncoder().encode(markdown),
    ),
  );
  return Uint8Array.from([0x01, ...nonce, ...sealed]);
}

describe("a non-Share application reading a policy-gated resource", () => {
  it("completes acquisition, presentation, delegation, read, and local decrypt", async () => {
    const REPORT = "# Complete blood count\n\nAll values within range.\n";
    const contentKey = new Uint8Array(32).fill(11);
    const ciphertext = await sealedReport(contentKey, REPORT);
    const trace: string[] = [];
    let holderDid = "";
    let signedBinding: unknown;

    const transport: PolicyAccessTransport = {
      async request(request) {
        const url = new URL(request.url);
        trace.push(`${request.method} ${url.origin}${url.pathname}`);
        const body = request.body as Record<string, unknown> | undefined;
        const ok = (value: unknown, status = 200) => ({
          status,
          body: value,
          finalUrl: request.url,
        });

        // --- OpenCredentials: delivered-email / OTP, nothing else ---
        if (url.pathname === "/v1/acquisitions") {
          holderDid = String(body?.holderDid);
          expect(body?.inputs).toEqual({ email: PATIENT_EMAIL });
          return ok({ requestId: "acq_00000000000001" }, 201);
        }
        if (url.pathname === "/v1/acquisitions/acq_00000000000001/challenge") {
          return ok({ challengeNonce: "c".repeat(24) });
        }
        if (url.pathname === "/v1/acquisitions/acq_00000000000001/state") {
          return ok({ challengeNonce: "c".repeat(24) });
        }
        if (url.pathname === "/v1/acquisitions/acq_00000000000001/proof") {
          expect((body?.proof as { otp: string }).otp).toBe("246810");
          return ok({ verified: true });
        }
        if (url.pathname === "/v1/acquisitions/acq_00000000000001/holder-binding") {
          return ok({
            binding: {
              type: "tinycloud.credentials/holder-binding/v1",
              protocol: "tinycloud.credentials/acquisition/v1",
              requestId: "acq_00000000000001",
              profile: "tinycloud.email-proof/v1",
              profileVersion: 1,
              descriptorDigest: "d".repeat(43),
              requirementDigest: "r".repeat(43),
              issuer: "did:web:witness.credentials.example",
              issuerKid: "did:web:witness.credentials.example#key-1",
              holderDid,
              normalizedClaimsDigest: "n".repeat(43),
              challengeNonce: "c".repeat(24),
              audience: "tinycloud://credentials",
              openerOrigin: "https://portal.clinic.example",
              completionOrigin: "https://portal.clinic.example",
              completionContext: "clinic-lab-report",
              jti: "j".repeat(24),
              issuedAt: "2026-08-19T12:00:00Z",
              expiresAt: "2026-08-19T12:10:00Z",
            },
          });
        }
        if (url.pathname === "/v1/acquisitions/acq_00000000000001/holder-signature") {
          signedBinding = body;
          return ok({ verified: true });
        }
        if (url.pathname === "/v1/acquisitions/acq_00000000000001/issue") {
          return ok({ issued: true });
        }
        if (url.pathname === "/v1/acquisitions/acq_00000000000001/result") {
          return ok({
            format: "vc+sd-jwt",
            credential: "eyJ.lab.sd-jwt",
            credentialDigest: "g".repeat(43),
            subject: holderDid,
            issuer: "did:web:witness.credentials.example",
            issuerKid: "did:web:witness.credentials.example#key-1",
            claims: { email: PATIENT_EMAIL },
            issuedAt: "2026-08-19T12:00:00Z",
            expiresAt: "2026-08-19T13:00:00Z",
          });
        }

        // --- Policy Engine: direct, no broker in between ---
        if (url.pathname === "/policy/v0/challenge") {
          return ok({
            challenge: {
              schema: "xyz.tinycloud.policy/challenge/v0",
              challengeId: "chal_clinic",
              policyId: POLICY_ID,
              audience: AUDIENCE,
              nonce: "z".repeat(43),
              challengeExpiresAt: new Date(
                Date.now() + 300_000,
              ).toISOString(),
              acceptedSuites: ["eddsa-ed25519-sha256-jcs-v1"],
            },
          });
        }
        if (url.pathname === "/policy/v0/resolve") {
          const presentation = (
            body as { presentation: Record<string, unknown> }
          ).presentation;
          expect(presentation.eligibleSubjectDid).toBe(holderDid);
          expect(presentation.holderBinding).toEqual({
            type: "ephemeral-holder",
          });
          expect(presentation.evidence).toEqual([
            { requirementId: REQUIREMENT_ID, presentation: { sdJwt: "eyJ.lab.sd-jwt" } },
          ]);
          return ok({ delegation: delegationFor(holderDid) });
        }

        // --- TinyCloud Node: generic capability + storage only ---
        if (url.pathname === "/delegate") {
          return ok({ activated: [NODE_SPACE_ID], skipped: [] });
        }
        if (url.pathname === "/invoke") {
          return ok(ciphertext);
        }
        throw new Error(`unexpected request: ${request.url}`);
      },
    };

    const reader = createLabReportReader(
      {
        issuerOrigin: ISSUER_ORIGIN,
        policyEngine: {
          endpoint: ENGINE_ORIGIN,
          audience: AUDIENCE,
          grantIssuerDid: GRANT_ISSUER_DID,
        },
        ownerNode: { endpoint: NODE_ORIGIN, spaceId: NODE_SPACE_ID },
        policyId: POLICY_ID,
        capabilitySpace: CAPABILITY_SPACE,
        reportPath: REPORT_PATH,
        requirementId: REQUIREMENT_ID,
        patientEmail: PATIENT_EMAIL,
        requirement,
        descriptor,
        portalOrigin: "https://portal.clinic.example",
      },
      transport,
      () => ({ Authorization: "invocation-header" }),
    );

    await reader.sendCode();
    const markdown = await reader.readReport("246810", contentKey);

    expect(markdown).toBe(REPORT);
    expect(holderDid).toBe(reader.holder.did);
    expect((signedBinding as { kid: string }).kid).toBe(reader.holder.keyId);

    // The whole trace, in order — and nothing else.
    expect(trace).toEqual([
      `POST ${ISSUER_ORIGIN}/v1/acquisitions`,
      `POST ${ISSUER_ORIGIN}/v1/acquisitions/acq_00000000000001/challenge`,
      `GET ${ISSUER_ORIGIN}/v1/acquisitions/acq_00000000000001/state`,
      `POST ${ISSUER_ORIGIN}/v1/acquisitions/acq_00000000000001/proof`,
      `GET ${ISSUER_ORIGIN}/v1/acquisitions/acq_00000000000001/holder-binding`,
      `POST ${ISSUER_ORIGIN}/v1/acquisitions/acq_00000000000001/holder-signature`,
      `POST ${ISSUER_ORIGIN}/v1/acquisitions/acq_00000000000001/issue`,
      `GET ${ISSUER_ORIGIN}/v1/acquisitions/acq_00000000000001/result`,
      `POST ${ENGINE_ORIGIN}/policy/v0/challenge`,
      `POST ${ENGINE_ORIGIN}/policy/v0/resolve`,
      `POST ${NODE_ORIGIN}/delegate`,
      `POST ${NODE_ORIGIN}/invoke`,
    ]);
    expect(trace.some((entry) => entry.includes("/share/"))).toBe(false);
    expect(trace.some((entry) => /openkey|oauth|siwe/i.test(entry))).toBe(false);
  });
});
