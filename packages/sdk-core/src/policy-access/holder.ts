import { ed25519 } from "@noble/curves/ed25519";
import { base58btc } from "multiformats/bases/base58";
import { sha256 } from "@noble/hashes/sha256";
import { jcsCanonicalize } from "../policy";

/**
 * Domain separator for the Policy Engine GrantPresentation/v0 holder signature.
 * Frozen by policy-engine `spec/grant-presentation.md` §2.2 and enforced by
 * `src/signed_object.rs::GRANT_PRESENTATION_DOMAIN`. The trailing NUL byte is
 * part of the hash input.
 */
export const GRANT_PRESENTATION_V0_DOMAIN =
  "xyz.tinycloud.policy/GrantPresentation/v0\0";

export const ED25519_JCS_SUITE = "eddsa-ed25519-sha256-jcs-v1" as const;

const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 =
    typeof btoa === "function"
      ? btoa(binary)
      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(bytes).toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * An ephemeral, tab-scoped holder key. The private scalar never leaves the
 * browser: the only thing that crosses a network boundary is `did` and
 * signatures produced by {@link EphemeralHolderKey.sign}.
 *
 * Callers that need forward secrecy across reloads should create a new holder
 * per session rather than persisting one.
 */
export interface EphemeralHolderKey {
  /** `did:key:z…` for the Ed25519 public key. */
  readonly did: string;
  /** DID-URL verification method (`<did>#<multibase>`). */
  readonly keyId: string;
  readonly publicKey: Uint8Array;
  readonly suite: typeof ED25519_JCS_SUITE;
  /** Raw Ed25519 signature over `message`. */
  sign(message: Uint8Array): Uint8Array;
  /**
   * Sign a GrantPresentation body (with `holderSignature` omitted) exactly the
   * way the standalone Policy Engine verifies it. Returns base64url-no-pad.
   */
  signGrantPresentation(unsignedPresentation: unknown): string;
  /** Public JWK for node invocation headers. */
  readonly jwk: {
    readonly kty: "OKP";
    readonly crv: "Ed25519";
    readonly x: string;
  };
}

export interface CreateEphemeralHolderKeyOptions {
  /**
   * 32-byte Ed25519 seed. Omit in production — the default draws from the
   * platform CSPRNG. Supplying a seed is for deterministic tests only.
   */
  readonly seed?: Uint8Array;
}

export function didKeyFromEd25519PublicKey(publicKey: Uint8Array): string {
  if (publicKey.length !== 32) {
    throw new Error("ed25519 public key must be 32 bytes");
  }
  return `did:key:${base58btc.encode(
    Uint8Array.from([0xed, 0x01, ...publicKey]),
  )}`;
}

/**
 * Create a fresh holder/session key for a policy-gated read. This is the key
 * whose possession the recipient proves to the Policy Engine, and the same key
 * that must sign the subsequent TinyCloud Node invocation.
 */
export function createEphemeralHolderKey(
  options: CreateEphemeralHolderKeyOptions = {},
): EphemeralHolderKey {
  const seed = options.seed ?? ed25519.utils.randomPrivateKey();
  if (seed.length !== 32) {
    throw new Error("ed25519 seed must be 32 bytes");
  }
  const publicKey = ed25519.getPublicKey(seed);
  const did = didKeyFromEd25519PublicKey(publicKey);
  const multibase = did.slice("did:key:".length);
  const sign = (message: Uint8Array): Uint8Array => ed25519.sign(message, seed);
  return {
    did,
    keyId: `${did}#${multibase}`,
    publicKey,
    suite: ED25519_JCS_SUITE,
    sign,
    signGrantPresentation(unsignedPresentation: unknown): string {
      const digest = grantPresentationDigest(unsignedPresentation);
      return toBase64Url(sign(digest));
    },
    jwk: { kty: "OKP", crv: "Ed25519", x: toBase64Url(publicKey) },
  };
}

/**
 * `SHA-256(domain || JCS(presentation_without_holderSignature))` — the exact
 * bytes the Policy Engine verifies the holder signature against.
 */
export function grantPresentationDigest(
  unsignedPresentation: unknown,
): Uint8Array {
  const canonical = jcsCanonicalize(unsignedPresentation);
  const domain = textEncoder.encode(GRANT_PRESENTATION_V0_DOMAIN);
  const body = textEncoder.encode(canonical);
  const input = new Uint8Array(domain.length + body.length);
  input.set(domain, 0);
  input.set(body, domain.length);
  return sha256(input);
}
