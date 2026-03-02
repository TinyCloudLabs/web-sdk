import type { VaultCrypto } from "./DataVaultService";

export interface WasmVaultFunctions {
  vault_encrypt(key: Uint8Array, plaintext: Uint8Array): Uint8Array;
  vault_decrypt(key: Uint8Array, blob: Uint8Array): Uint8Array;
  /** WASM order: (salt, signature, info) — NOT (signature, salt, info) */
  vault_derive_key(salt: Uint8Array, signature: Uint8Array, info: Uint8Array): Uint8Array;
  vault_x25519_from_seed(seed: Uint8Array): { publicKey: Uint8Array; privateKey: Uint8Array };
  vault_x25519_dh(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array;
  vault_random_bytes(length: number): Uint8Array;
  vault_sha256(data: Uint8Array): Uint8Array;
}

export function createVaultCrypto(wasm: WasmVaultFunctions): VaultCrypto {
  return {
    encrypt: (key, plaintext) => wasm.vault_encrypt(key, plaintext),
    decrypt: (key, blob) => wasm.vault_decrypt(key, blob),
    deriveKey: (signature, salt, info) => wasm.vault_derive_key(salt, signature, info),
    x25519FromSeed: (seed) => wasm.vault_x25519_from_seed(seed),
    x25519Dh: (privateKey, publicKey) => wasm.vault_x25519_dh(privateKey, publicKey),
    randomBytes: (length) => wasm.vault_random_bytes(length),
    sha256: (data) => wasm.vault_sha256(data),
  };
}
