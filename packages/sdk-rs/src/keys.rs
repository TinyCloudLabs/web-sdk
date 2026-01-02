//! Node.js-specific key management functions.
//!
//! This module provides functions for importing/exporting keys as base64-encoded JWKs,
//! loading keys from environment variables, and signing messages with secp256k1 keys.

#![cfg(feature = "nodejs")]

use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use wasm_bindgen::prelude::*;

use crate::session::TCWSessionManager;
use tinycloud_sdk_rs::tinycloud_lib::ssi::jwk::JWK;

/// Import a private key from a base64-encoded JWK string.
///
/// # Arguments
/// * `manager` - The session manager to import the key into
/// * `base64_jwk` - Base64-encoded JWK JSON string
/// * `key_id` - Optional key ID (defaults to "default")
///
/// # Returns
/// The key ID of the imported key
#[wasm_bindgen(js_name = importKeyFromBase64)]
pub fn import_key_from_base64(
    manager: &mut TCWSessionManager,
    base64_jwk: String,
    key_id: Option<String>,
) -> Result<String, String> {
    let jwk_bytes = BASE64
        .decode(&base64_jwk)
        .map_err(|e| format!("Invalid base64 encoding: {}", e))?;
    let jwk_str =
        String::from_utf8(jwk_bytes).map_err(|e| format!("Invalid UTF-8 in JWK: {}", e))?;
    let jwk: JWK =
        serde_json::from_str(&jwk_str).map_err(|e| format!("Invalid JWK format: {}", e))?;

    manager.import_session_key_internal(jwk, key_id, false)
}

/// Export a private key as a base64-encoded JWK string.
///
/// # Arguments
/// * `manager` - The session manager containing the key
/// * `key_id` - Optional key ID (defaults to "default")
///
/// # Returns
/// Base64-encoded JWK JSON string
#[wasm_bindgen(js_name = exportKeyAsBase64)]
pub fn export_key_as_base64(
    manager: &TCWSessionManager,
    key_id: Option<String>,
) -> Result<String, String> {
    let jwk_str = manager.jwk(key_id).ok_or("Key not found")?;
    Ok(BASE64.encode(jwk_str.as_bytes()))
}

/// Import a key from an environment variable value (base64-encoded JWK).
/// Note: The actual environment variable reading happens in JavaScript.
/// This function receives the already-read value.
///
/// # Arguments
/// * `manager` - The session manager to import the key into
/// * `env_value` - The base64-encoded JWK value from the environment variable
/// * `key_id` - Optional key ID (defaults to "default")
///
/// # Returns
/// The key ID of the imported key
#[wasm_bindgen(js_name = importKeyFromEnvValue)]
pub fn import_key_from_env_value(
    manager: &mut TCWSessionManager,
    env_value: String,
    key_id: Option<String>,
) -> Result<String, String> {
    import_key_from_base64(manager, env_value, key_id)
}

/// Sign a message with a secp256k1 private key (Ethereum-style).
///
/// # Arguments
/// * `message` - The message bytes to sign
/// * `private_key_base64` - Base64-encoded 32-byte private key
///
/// # Returns
/// The signature as bytes (64 bytes: r || s)
#[wasm_bindgen(js_name = signSecp256k1)]
pub fn sign_secp256k1(message: &[u8], private_key_base64: String) -> Result<Vec<u8>, String> {
    use k256::ecdsa::{signature::Signer, Signature, SigningKey};

    let key_bytes = BASE64
        .decode(&private_key_base64)
        .map_err(|e| format!("Invalid base64 encoding for private key: {}", e))?;

    let signing_key = SigningKey::from_slice(&key_bytes)
        .map_err(|e| format!("Invalid secp256k1 private key: {}", e))?;

    let signature: Signature = signing_key.sign(message);
    Ok(signature.to_bytes().to_vec())
}

/// Sign an Ethereum message with the standard prefix and return the signature with recovery ID.
///
/// This applies the Ethereum message prefix: "\x19Ethereum Signed Message:\n{length}{message}"
/// and returns the signature as a hex string with the recovery byte appended (65 bytes total).
///
/// # Arguments
/// * `message` - The message string to sign
/// * `private_key_base64` - Base64-encoded 32-byte private key
///
/// # Returns
/// Hex-encoded signature (130 characters = 65 bytes: r || s || v)
#[wasm_bindgen(js_name = signEthereumMessage)]
pub fn sign_ethereum_message(
    message: String,
    private_key_base64: String,
) -> Result<String, String> {
    use k256::ecdsa::SigningKey;
    use sha3::{Digest, Keccak256};

    // Apply Ethereum message prefix
    let prefixed = format!(
        "\x19Ethereum Signed Message:\n{}{}",
        message.len(),
        message
    );
    let hash = Keccak256::digest(prefixed.as_bytes());

    let key_bytes = BASE64
        .decode(&private_key_base64)
        .map_err(|e| format!("Invalid base64 encoding for private key: {}", e))?;

    let signing_key = SigningKey::from_slice(&key_bytes)
        .map_err(|e| format!("Invalid secp256k1 private key: {}", e))?;

    let (signature, recovery_id) = signing_key
        .sign_prehash_recoverable(&hash)
        .map_err(|e| format!("Signing failed: {}", e))?;

    // Combine signature bytes with recovery ID (Ethereum uses 27/28)
    let mut sig_bytes = signature.to_bytes().to_vec();
    sig_bytes.push(recovery_id.to_byte() + 27);

    Ok(hex::encode(sig_bytes))
}
