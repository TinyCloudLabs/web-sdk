import { describe, expect, it } from "bun:test";
import { PolicyAccessError } from "./errors";
import {
  POLICY_REGISTRATION_PATH,
  publishSignedPolicyObjects,
} from "./publish";
import { createFetchPolicyAccessTransport } from "./transport";
import type { PolicyAccessTransport } from "./transport";

const ENGINE = "https://policy.example.com";

const POLICY = {
  schema: "xyz.tinycloud.policy/policy/v0",
  policyId: "pol_aaaa",
  ownerDid: "did:pkh:eip155:1:0x00",
  signature: { suite: "eddsa-ed25519-sha256-jcs-v1", signerDid: "did:pkh:eip155:1:0x00", value: "AA" },
};

function recordingTransport(
  response: { status: number; body: unknown },
): { transport: PolicyAccessTransport; sent: Array<{ url: string; body: unknown }> } {
  const sent: Array<{ url: string; body: unknown }> = [];
  return {
    sent,
    transport: {
      async request(request) {
        sent.push({ url: request.url, body: request.body });
        return { ...response, finalUrl: request.url };
      },
    },
  };
}

describe("publishSignedPolicyObjects", () => {
  it("posts the batch to the engine's frozen registration route", async () => {
    const { transport, sent } = recordingTransport({
      status: 200,
      body: { registeredPolicyIds: ["pol_aaaa"] },
    });

    const result = await publishSignedPolicyObjects({
      endpoint: `${ENGINE}/`,
      signedObjects: [POLICY],
      transport,
    });

    expect(result.registeredPolicyIds).toEqual(["pol_aaaa"]);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe(`${ENGINE}${POLICY_REGISTRATION_PATH}`);
    expect(sent[0]!.body).toEqual({ signedObjects: [POLICY] });
  });

  it("refuses an object family the registration contract does not accept", async () => {
    const { transport, sent } = recordingTransport({ status: 200, body: {} });

    const error = await publishSignedPolicyObjects({
      endpoint: ENGINE,
      signedObjects: [{ schema: "xyz.tinycloud.policy/challenge/v0" }],
      transport,
    }).catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(PolicyAccessError);
    expect((error as PolicyAccessError).code).toBe("access-descriptor-invalid");
    // A caller mistake must not reach the engine at all.
    expect(sent).toHaveLength(0);
  });

  it("refuses an empty batch rather than reporting a silent success", async () => {
    const { transport } = recordingTransport({ status: 200, body: {} });
    const error = await publishSignedPolicyObjects({
      endpoint: ENGINE,
      signedObjects: [],
      transport,
    }).catch((cause: unknown) => cause);
    expect((error as PolicyAccessError).code).toBe("access-descriptor-invalid");
  });

  it("surfaces the engine's own denial code", async () => {
    const { transport } = recordingTransport({
      status: 403,
      body: { error: { code: "policy_engine_record.grant_issuer_authority", message: "" } },
    });

    const error = (await publishSignedPolicyObjects({
      endpoint: ENGINE,
      signedObjects: [POLICY],
      transport,
    }).catch((cause: unknown) => cause)) as PolicyAccessError;

    expect(error.code).toBe("engine-denied");
    expect(error.denialCode).toBe("policy_engine_record.grant_issuer_authority");
    expect(error.status).toBe(403);
  });

  it("rejects a success body that does not report registered ids", async () => {
    const { transport } = recordingTransport({ status: 200, body: { ok: true } });
    const error = (await publishSignedPolicyObjects({
      endpoint: ENGINE,
      signedObjects: [POLICY],
      transport,
    }).catch((cause: unknown) => cause)) as PolicyAccessError;
    expect(error.code).toBe("engine-response-invalid");
  });

  it("inherits the transport's origin pin, so publication cannot leak to an unpinned host", async () => {
    const transport = createFetchPolicyAccessTransport({
      originPolicy: { allowedOrigins: [ENGINE] },
      fetchFn: (() => {
        throw new Error("fetch must not be reached");
      }) as unknown as typeof fetch,
    });

    const error = (await publishSignedPolicyObjects({
      endpoint: "https://attacker.example.com",
      signedObjects: [POLICY],
      transport,
    }).catch((cause: unknown) => cause)) as PolicyAccessError;

    expect(error.code).toBe("origin-not-allowed");
  });
});
