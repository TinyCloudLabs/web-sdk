import { PolicyAccessError } from "./errors";

const NONCE_LENGTH = 12;

export interface LocalDecryptInput {
  /** Bytes exactly as TinyCloud returned them. */
  readonly ciphertext: Uint8Array;
  /** 32-byte AES-256-GCM content key the recipient unwrapped locally. */
  readonly key: Uint8Array;
  /**
   * Explicit nonce. Omit when the nonce is the first 12 bytes of `ciphertext`
   * (optionally preceded by a one-byte version header, see `versionByte`).
   */
  readonly nonce?: Uint8Array;
  /** Additional authenticated data the producer bound into the ciphertext. */
  readonly aad?: Uint8Array;
  /**
   * Expected leading version byte when the payload is a versioned sealed blob
   * (`version || nonce || ciphertext+tag`).
   */
  readonly versionByte?: number;
}

/**
 * Decrypt policy-gated content **in the browser**, after the ciphertext has
 * already been read out of TinyCloud.
 *
 * Neither TinyCloud Node nor the Policy Engine ever sees the content key or
 * the plaintext: node returns opaque bytes and this function is the only place
 * they become readable.
 */
export async function decryptLocally(
  input: LocalDecryptInput,
): Promise<Uint8Array> {
  if (input.key.length !== 32) {
    throw new PolicyAccessError(
      "decrypt-failed",
      `content key must be 32 bytes, got ${input.key.length}`,
    );
  }
  let body = input.ciphertext;
  let nonce = input.nonce;
  if (nonce === undefined) {
    if (input.versionByte !== undefined) {
      if (body.length < 1 + NONCE_LENGTH || body[0] !== input.versionByte) {
        throw new PolicyAccessError(
          "decrypt-failed",
          "sealed blob does not start with the expected version byte",
        );
      }
      body = body.subarray(1);
    }
    if (body.length < NONCE_LENGTH) {
      throw new PolicyAccessError(
        "decrypt-failed",
        "ciphertext is too short to carry an inline nonce",
      );
    }
    nonce = body.subarray(0, NONCE_LENGTH);
    body = body.subarray(NONCE_LENGTH);
  }
  if (nonce.length !== NONCE_LENGTH) {
    throw new PolicyAccessError(
      "decrypt-failed",
      `nonce must be ${NONCE_LENGTH} bytes, got ${nonce.length}`,
    );
  }
  let key: Awaited<ReturnType<typeof globalThis.crypto.subtle.importKey>>;
  try {
    key = await globalThis.crypto.subtle.importKey(
      "raw",
      input.key,
      "AES-GCM",
      false,
      ["decrypt"],
    );
  } catch (error) {
    throw new PolicyAccessError(
      "decrypt-failed",
      `content key import failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  try {
    return new Uint8Array(
      await globalThis.crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: nonce,
          ...(input.aad === undefined
            ? {}
            : { additionalData: input.aad }),
        },
        key,
        body,
      ),
    );
  } catch {
    throw new PolicyAccessError(
      "decrypt-failed",
      "local AES-GCM decryption failed: wrong key, wrong AAD, or tampered ciphertext",
    );
  }
}
