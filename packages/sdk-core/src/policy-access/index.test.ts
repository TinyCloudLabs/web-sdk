import { describe, expect, it } from "bun:test";
import { ed25519 } from "@noble/curves/ed25519";
import {
  EPHEMERAL_HOLDER_BINDING,
  PolicyAccessError,
  assertExactReadOnlyCapabilities,
  createEphemeralHolderKey,
  createFetchPolicyAccessTransport,
  decryptLocally,
  grantPresentationDigest,
  openPolicyAccess,
  requestPolicyAccessGrant,
  requestedCapabilitiesHashHex,
  type PolicyAccessDescriptor,
  type PolicyAccessHttpRequest,
  type PolicyAccessHttpResponse,
  type PolicyAccessTransport,
} from ".";
import { deriveDelegationCid } from "../requester";
import type { PolicyCapability } from "../policy";

const ENGINE_ORIGIN = "https://policy-engine.example";
const NODE_ORIGIN = "https://node.example";
const SPACE = "tinycloud:did:pkh:eip155:1:0xowner:default";
const RESOURCE_PATH = "shares/share-1/report.md.enc";
const POLICY_ID = "pol_exact_email";
const AUDIENCE = "urn:tinycloud:policy-engine:test";
const NODE_SPACE_ID = "did:pkh:eip155:1:0xowner:default";

const GRANT_ISSUER_SEED = new Uint8Array(32).fill(3);
const grantIssuerPublic = ed25519.getPublicKey(GRANT_ISSUER_SEED);

function base64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function didKey(publicKey: Uint8Array): string {
  // multicodec 0xed01 + base58btc, matching the engine's did:key parser.
  const bs58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes = Uint8Array.from([0xed, 0x01, ...publicKey]);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let out = "";
  while (value > 0n) {
    out = bs58[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) break;
    out = `1${out}`;
  }
  return `did:key:z${out}`;
}

const GRANT_ISSUER_DID = didKey(grantIssuerPublic);

const CAPABILITY: PolicyCapability = {
  service: "tinycloud.kv",
  space: SPACE,
  path: RESOURCE_PATH,
  actions: ["tinycloud.kv/get"],
};

function descriptor(
  overrides: Partial<PolicyAccessDescriptor> = {},
): PolicyAccessDescriptor {
  return {
    policyId: POLICY_ID,
    policyEngine: {
      endpoint: ENGINE_ORIGIN,
      audience: AUDIENCE,
      grantIssuerDid: GRANT_ISSUER_DID,
    },
    ownerNode: { endpoint: NODE_ORIGIN, spaceId: NODE_SPACE_ID },
    requestedCapabilities: [CAPABILITY],
    ...overrides,
  };
}

/**
 * Mint the compact-JWS UCAN the SDK derives all delegation authority from.
 * The SDK never trusts the surrounding JSON, so the fixture has to be
 * genuinely signed and genuinely self-consistent.
 */
function portableDelegation(input: {
  readonly holderDid: string;
  readonly issuedAtMs: number;
  readonly ttlSeconds: number;
  readonly capabilities?: readonly PolicyCapability[];
  readonly terminal?: boolean;
}) {
  const capabilities = input.capabilities ?? [CAPABILITY];
  const issuanceId = "iss_test_0001";
  const capabilityHashHex = requestedCapabilitiesHashHex(capabilities);
  const att: Record<string, Record<string, unknown[]>> = {};
  for (const capability of capabilities) {
    const service = capability.service.split(".")[1]!;
    att[`${capability.space}/${service}/${capability.path}`] =
      Object.fromEntries(capability.actions.map((action) => [action, [{}]]));
  }
  const header = { alg: "EdDSA", typ: "JWT", ucv: "0.10.0" };
  const payload = {
    iss: `${GRANT_ISSUER_DID}#${GRANT_ISSUER_DID.slice("did:key:".length)}`,
    aud: input.holderDid,
    att,
    prf: ["bafyparent"],
    nbf: Math.floor(input.issuedAtMs / 1000),
    exp: Math.floor(input.issuedAtMs / 1000) + input.ttlSeconds,
    fct: [
      {
        "xyz.tinycloud.policy/delegationMode":
          (input.terminal ?? true) ? "terminal" : "attenuable",
        "xyz.tinycloud.policy/policyId": POLICY_ID,
        "xyz.tinycloud.policy/capabilityHashHex": capabilityHashHex,
        "xyz.tinycloud.policy/revocationMode": "refresh_only",
        "xyz.tinycloud.policy/issuanceId": issuanceId,
      },
    ],
  };
  const signingInput = `${Buffer.from(JSON.stringify(header)).toString(
    "base64url",
  )}.${Buffer.from(JSON.stringify(payload)).toString("base64url")}`;
  const signature = base64Url(
    ed25519.sign(new TextEncoder().encode(signingInput), GRANT_ISSUER_SEED),
  );
  const encoded = `${signingInput}.${signature}`;
  const rfc = (ms: number) => new Date(ms).toISOString().replace(".000Z", "Z");
  return {
    delegationId: deriveDelegationCid(encoded),
    issuanceId,
    issuerDid: GRANT_ISSUER_DID,
    holderDid: input.holderDid,
    policyId: POLICY_ID,
    capabilityHashHex,
    revocationMode: "refresh_only",
    issuedAt: rfc(Math.floor(input.issuedAtMs / 1000) * 1000),
    expiresAt: rfc(
      (Math.floor(input.issuedAtMs / 1000) + input.ttlSeconds) * 1000,
    ),
    terminal: input.terminal ?? true,
    encoded,
  };
}

interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

function scriptedTransport(
  handlers: Array<
    (request: PolicyAccessHttpRequest) => PolicyAccessHttpResponse | undefined
  >,
): { transport: PolicyAccessTransport; recorded: RecordedRequest[] } {
  const recorded: RecordedRequest[] = [];
  const transport: PolicyAccessTransport = {
    async request(request) {
      recorded.push({
        method: request.method,
        url: request.url,
        body: request.body,
        headers: request.headers,
      });
      for (const handler of handlers) {
        const response = handler(request);
        if (response !== undefined) return response;
      }
      throw new Error(`unscripted request: ${request.method} ${request.url}`);
    },
  };
  return { transport, recorded };
}

const NOW_MS = Date.parse("2026-08-19T12:00:00Z");
const now = () => new Date(NOW_MS);

function challengeHandler(
  overrides: Record<string, unknown> = {},
): (request: PolicyAccessHttpRequest) => PolicyAccessHttpResponse | undefined {
  return (request) =>
    request.url === `${ENGINE_ORIGIN}/policy/v0/challenge`
      ? {
          status: 200,
          finalUrl: request.url,
          body: {
            challenge: {
              schema: "xyz.tinycloud.policy/challenge/v0",
              challengeId: "chal_1",
              policyId: POLICY_ID,
              audience: AUDIENCE,
              nonce: "n".repeat(43),
              challengeExpiresAt: "2026-08-19T12:05:00Z",
              acceptedSuites: ["eddsa-ed25519-sha256-jcs-v1"],
              ...overrides,
            },
          },
        }
      : undefined;
}

function resolveHandler(delegation: unknown) {
  return (request: PolicyAccessHttpRequest) =>
    request.url === `${ENGINE_ORIGIN}/policy/v0/resolve`
      ? { status: 200, finalUrl: request.url, body: { delegation } }
      : undefined;
}

function delegateHandler() {
  return (request: PolicyAccessHttpRequest) =>
    request.url === `${NODE_ORIGIN}/delegate`
      ? {
          status: 200,
          finalUrl: request.url,
          body: { activated: [NODE_SPACE_ID], skipped: [] },
        }
      : undefined;
}

const invoke = () => ({ Authorization: "invocation-header" });

describe("policy-access happy path", () => {
  const holder = createEphemeralHolderKey({ seed: new Uint8Array(32).fill(9) });

  it("goes challenge -> resolve -> delegate -> invoke and nowhere else", async () => {
    const delegation = portableDelegation({
      holderDid: holder.did,
      issuedAtMs: NOW_MS,
      ttlSeconds: 120,
    });
    const { transport, recorded } = scriptedTransport([
      challengeHandler(),
      resolveHandler(delegation),
      delegateHandler(),
      (request) =>
        request.url === `${NODE_ORIGIN}/invoke`
          ? { status: 200, finalUrl: request.url, body: "ciphertext-bytes" }
          : undefined,
    ]);

    const session = await openPolicyAccess({
      descriptor: descriptor(),
      holder,
      transport,
      evidence: [{ requirementId: "exact-email", presentation: { sdJwt: "x" } }],
      invoke,
      now,
    });
    const read = await session.readEncrypted(RESOURCE_PATH);

    expect(new TextDecoder().decode(read.ciphertext)).toBe("ciphertext-bytes");
    expect(recorded.map((entry) => entry.url)).toEqual([
      `${ENGINE_ORIGIN}/policy/v0/challenge`,
      `${ENGINE_ORIGIN}/policy/v0/resolve`,
      `${NODE_ORIGIN}/delegate`,
      `${NODE_ORIGIN}/invoke`,
    ]);
    // The whole point of the correction: node sees only generic routes.
    expect(
      recorded.some((entry) => new URL(entry.url).pathname.startsWith("/share/")),
    ).toBe(false);
    expect(session.holderDid).toBe(holder.did);
    expect(session.isActive()).toBe(true);
  });

  it("presents an audience-bound, nonce-bound, read-only, exact-resource claim", async () => {
    const delegation = portableDelegation({
      holderDid: holder.did,
      issuedAtMs: NOW_MS,
      ttlSeconds: 120,
    });
    const { transport, recorded } = scriptedTransport([
      challengeHandler(),
      resolveHandler(delegation),
      delegateHandler(),
    ]);

    await requestPolicyAccessGrant({
      descriptor: descriptor(),
      holder,
      transport,
      evidence: [{ requirementId: "exact-email", presentation: { sdJwt: "x" } }],
      invoke,
      now,
    });

    const resolve = recorded.find((entry) =>
      entry.url.endsWith("/policy/v0/resolve"),
    )!;
    const presentation = (resolve.body as { presentation: Record<string, unknown> })
      .presentation;
    expect(presentation.audience).toBe(AUDIENCE);
    expect(presentation.nonce).toBe("n".repeat(43));
    expect(presentation.holderDid).toBe(holder.did);
    expect(presentation.eligibleSubjectDid).toBe(holder.did);
    expect(presentation.holderBinding).toEqual(EPHEMERAL_HOLDER_BINDING);
    expect(presentation.requestedCapabilities).toEqual([CAPABILITY]);
    expect(presentation.requestedCapabilitiesHash).toBe(
      requestedCapabilitiesHashHex([CAPABILITY]),
    );
    // Presentation expiry is the recipient's own deadline, not the challenge's.
    expect(presentation.expiresAt).toBe("2026-08-19T12:01:00Z");

    const { holderSignature, ...unsigned } = presentation as Record<
      string,
      unknown
    > & { holderSignature: { value: string; signerDid: string } };
    expect(holderSignature.signerDid).toBe(holder.did);
    expect(
      ed25519.verify(
        Buffer.from(holderSignature.value, "base64url"),
        grantPresentationDigest(unsigned),
        holder.publicKey,
      ),
    ).toBe(true);
  });

  it("refuses to reuse a nonce across two grants", async () => {
    const delegation = portableDelegation({
      holderDid: holder.did,
      issuedAtMs: NOW_MS,
      ttlSeconds: 120,
    });
    const { transport } = scriptedTransport([
      challengeHandler(),
      (request) =>
        request.url === `${ENGINE_ORIGIN}/policy/v0/resolve`
          ? { status: 200, finalUrl: request.url, body: { delegation } }
          : undefined,
      delegateHandler(),
    ]);
    const options = {
      descriptor: descriptor(),
      holder,
      transport,
      evidence: [{ requirementId: "exact-email", presentation: { sdJwt: "x" } }],
      invoke,
      now,
    };
    const first = await requestPolicyAccessGrant(options);
    const second = await requestPolicyAccessGrant(options);
    // The engine is authoritative on replay; the SDK still surfaces the nonce so
    // callers and traces can assert single-use behaviour.
    expect(first.nonce).toBe(second.nonce);
  });
});

describe("policy-access boundaries", () => {
  const holder = createEphemeralHolderKey({ seed: new Uint8Array(32).fill(9) });
  const evidence = [
    { requirementId: "exact-email", presentation: { sdJwt: "x" } },
  ];

  it("rejects a write action before any egress", () => {
    expect(() =>
      assertExactReadOnlyCapabilities([
        { ...CAPABILITY, actions: ["tinycloud.kv/get", "tinycloud.kv/put"] },
      ]),
    ).toThrow(PolicyAccessError);
  });

  it("rejects a prefix resource before any egress", () => {
    expect(() =>
      assertExactReadOnlyCapabilities([{ ...CAPABILITY, path: "shares/" }]),
    ).toThrow(PolicyAccessError);
  });

  it("rejects a challenge bound to another audience", async () => {
    const { transport } = scriptedTransport([
      challengeHandler({ audience: "urn:tinycloud:policy-engine:other" }),
    ]);
    await expect(
      requestPolicyAccessGrant({
        descriptor: descriptor(),
        holder,
        transport,
        evidence,
        invoke,
        now,
      }),
    ).rejects.toMatchObject({ code: "challenge-binding-mismatch" });
  });

  it("rejects a delegation minted for another holder key", async () => {
    const other = createEphemeralHolderKey({ seed: new Uint8Array(32).fill(4) });
    const { transport } = scriptedTransport([
      challengeHandler(),
      resolveHandler(
        portableDelegation({
          holderDid: other.did,
          issuedAtMs: NOW_MS,
          ttlSeconds: 120,
        }),
      ),
    ]);
    await expect(
      requestPolicyAccessGrant({
        descriptor: descriptor(),
        holder,
        transport,
        evidence,
        invoke,
        now,
      }),
    ).rejects.toMatchObject({ code: "delegation-wrong-holder" });
  });

  it("rejects a delegation that outlives the 300s ceiling", async () => {
    const { transport } = scriptedTransport([
      challengeHandler(),
      resolveHandler(
        portableDelegation({
          holderDid: holder.did,
          issuedAtMs: NOW_MS,
          ttlSeconds: 3600,
        }),
      ),
    ]);
    await expect(
      requestPolicyAccessGrant({
        descriptor: descriptor(),
        holder,
        transport,
        evidence,
        invoke,
        now,
      }),
    ).rejects.toMatchObject({ code: "delegation-ttl-excessive" });
  });

  it("rejects a delegation wider than the exact requested resource", async () => {
    const { transport } = scriptedTransport([
      challengeHandler(),
      resolveHandler(
        portableDelegation({
          holderDid: holder.did,
          issuedAtMs: NOW_MS,
          ttlSeconds: 120,
          capabilities: [{ ...CAPABILITY, path: "shares/share-1/other.enc" }],
        }),
      ),
    ]);
    await expect(
      requestPolicyAccessGrant({
        descriptor: descriptor(),
        holder,
        transport,
        evidence,
        invoke,
        now,
      }),
    ).rejects.toMatchObject({ code: "delegation-capability-wider" });
  });

  it("rejects a re-delegatable grant", async () => {
    const { transport } = scriptedTransport([
      challengeHandler(),
      resolveHandler(
        portableDelegation({
          holderDid: holder.did,
          issuedAtMs: NOW_MS,
          ttlSeconds: 120,
          terminal: false,
        }),
      ),
    ]);
    await expect(
      requestPolicyAccessGrant({
        descriptor: descriptor(),
        holder,
        transport,
        evidence,
        invoke,
        now,
      }),
      // The compact-JWS authority parser refuses a non-terminal grant before
      // the policy-access-level terminal check ever sees it.
    ).rejects.toMatchObject({ code: "delegation-invalid" });
  });

  it("refuses to read a resource the grant does not cover exactly", async () => {
    const { transport } = scriptedTransport([
      challengeHandler(),
      resolveHandler(
        portableDelegation({
          holderDid: holder.did,
          issuedAtMs: NOW_MS,
          ttlSeconds: 120,
        }),
      ),
      delegateHandler(),
    ]);
    const session = await openPolicyAccess({
      descriptor: descriptor(),
      holder,
      transport,
      evidence,
      invoke,
      now,
    });
    await expect(
      session.readEncrypted("shares/share-1/other.enc"),
    ).rejects.toMatchObject({ code: "read-not-contained" });
  });

  it("refuses to read after the grant expires", async () => {
    const { transport } = scriptedTransport([
      challengeHandler(),
      resolveHandler(
        portableDelegation({
          holderDid: holder.did,
          issuedAtMs: NOW_MS,
          ttlSeconds: 120,
        }),
      ),
      delegateHandler(),
    ]);
    let clock = NOW_MS;
    const session = await openPolicyAccess({
      descriptor: descriptor(),
      holder,
      transport,
      evidence,
      invoke,
      now: () => new Date(clock),
    });
    clock = NOW_MS + 121_000;
    expect(session.isActive()).toBe(false);
    await expect(
      session.readEncrypted(RESOURCE_PATH),
    ).rejects.toMatchObject({ code: "session-expired" });
  });

  it("refuses a node share route and any unpinned origin", async () => {
    const transport = createFetchPolicyAccessTransport({
      originPolicy: { allowedOrigins: [NODE_ORIGIN, ENGINE_ORIGIN] },
      fetchFn: (async () => {
        throw new Error("must not reach the network");
      }) as unknown as typeof fetch,
    });
    await expect(
      transport.request({ method: "POST", url: `${NODE_ORIGIN}/share/v1/read` }),
    ).rejects.toMatchObject({ code: "origin-not-allowed" });
    await expect(
      transport.request({
        method: "POST",
        url: "https://openkey.example/oauth/authorize",
      }),
    ).rejects.toMatchObject({ code: "origin-not-allowed" });
  });
});

describe("fetch transport body handling", () => {
  const transport = () =>
    createFetchPolicyAccessTransport({
      originPolicy: { allowedOrigins: [NODE_ORIGIN] },
      fetchFn: (async (url: URL) =>
        new Response(
          url.pathname === "/invoke"
            ? new Uint8Array([0x01, 0xff, 0xfe, 0x00, 0x80])
            : JSON.stringify({ activated: [NODE_SPACE_ID] }),
          {
            headers: {
              "content-type":
                url.pathname === "/invoke"
                  ? "application/octet-stream"
                  : "application/json",
            },
          },
        )) as unknown as typeof fetch,
    });

  it("returns ciphertext as raw bytes, not lossily decoded text", async () => {
    const response = await transport().request({
      method: "POST",
      url: `${NODE_ORIGIN}/invoke`,
    });
    expect(response.body).toBeInstanceOf(Uint8Array);
    // 0xff 0xfe 0x80 are not valid UTF-8; a text round-trip would replace them.
    expect([...(response.body as Uint8Array)]).toEqual([
      0x01, 0xff, 0xfe, 0x00, 0x80,
    ]);
  });

  it("still parses declared JSON", async () => {
    const response = await transport().request({
      method: "POST",
      url: `${NODE_ORIGIN}/delegate`,
    });
    expect(response.body).toEqual({ activated: [NODE_SPACE_ID] });
  });
});

describe("local decryption", () => {
  it("round-trips a sealed blob without any service seeing the key", async () => {
    const key = new Uint8Array(32).fill(7);
    const nonce = new Uint8Array(12).fill(1);
    const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, [
      "encrypt",
    ]);
    const plaintext = new TextEncoder().encode("# only the browser sees this");
    const sealed = new Uint8Array(
      await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cryptoKey, plaintext),
    );
    const blob = Uint8Array.from([0x01, ...nonce, ...sealed]);

    const decrypted = await decryptLocally({
      ciphertext: blob,
      key,
      versionByte: 0x01,
    });

    expect(new TextDecoder().decode(decrypted)).toBe(
      "# only the browser sees this",
    );
  });

  it("fails closed on a tampered ciphertext", async () => {
    const key = new Uint8Array(32).fill(7);
    await expect(
      decryptLocally({ ciphertext: new Uint8Array(40).fill(2), key }),
    ).rejects.toMatchObject({ code: "decrypt-failed" });
  });
});
