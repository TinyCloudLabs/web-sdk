import { describe, expect, it } from "bun:test";
import { createHash } from "crypto";
import {
  EPHEMERAL_HOLDER_BINDING,
  createEphemeralHolderKey,
  requestedCapabilitiesHashHex,
} from ".";

/**
 * The policy engine verifies these exact bytes in
 * `tests/accountless_holder_conformance.rs`. Both sides pin the same digest, so
 * a change to JCS canonicalization, the domain separator, the did:key encoding,
 * or the capability hash breaks a test here *and* there rather than silently in
 * a browser.
 */
const VECTOR_PATH = new URL(
  "../../test-fixtures/policy-access/ephemeral-holder-presentation.json",
  import.meta.url,
);
const VECTOR_SHA256 =
  "561acb632c9cc634d508bec6241a6d80a33ef7a6f0e7a925df61e9c19a1f4adf";

describe("accountless presentation conformance vector", () => {
  it("still matches the bytes the policy engine verifies", async () => {
    const bytes = await Bun.file(VECTOR_PATH).text();
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      VECTOR_SHA256,
    );
  });

  it("is reproduced byte-for-byte from the pinned holder seed", async () => {
    const vector = (await Bun.file(VECTOR_PATH).json()) as {
      holderSeedHex: string;
      presentation: Record<string, unknown> & {
        requestedCapabilities: Parameters<
          typeof requestedCapabilitiesHashHex
        >[0];
        holderSignature: { value: string };
      };
    };
    const seed = Uint8Array.from(
      Buffer.from(vector.holderSeedHex, "hex"),
    );
    const holder = createEphemeralHolderKey({ seed });
    const { holderSignature, ...unsigned } = vector.presentation;

    expect(unsigned.holderDid).toBe(holder.did);
    expect(unsigned.eligibleSubjectDid).toBe(holder.did);
    expect(unsigned.holderBinding).toEqual(EPHEMERAL_HOLDER_BINDING);
    expect(unsigned.requestedCapabilitiesHash).toBe(
      requestedCapabilitiesHashHex(vector.presentation.requestedCapabilities),
    );
    expect(holder.signGrantPresentation(unsigned)).toBe(holderSignature.value);
  });
});
