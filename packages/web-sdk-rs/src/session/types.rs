use js_sys::JsString;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const EXTRA_FIELDS: &'static str = r#"
export type ExtraFields = {
    /** Any extra fields that are needed for the capability.
     * This object must be serializable with JSON.stringify().
     */
    [key: string]: any
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "ExtraFields")]
    pub type ExtraFields;
}

#[wasm_bindgen(typescript_custom_section)]
const SIWE_CONFIG: &'static str = r#"
export type SiweConfig = {
    /**Ethereum address performing the signing conformant to capitalization
     * encoded checksum specified in EIP-55 where applicable. */
    address: string;
    /**EIP-155 Chain ID to which the session is bound, and the network where
     * Contract Accounts must be resolved. */
    chainId: number;
    /**RFC 4501 dns authority that is requesting the signing. */
    domain: string;
    /**Randomized token used to prevent replay attacks, at least 8 alphanumeric
     * characters. */
    nonce?: string;
    /**ISO 8601 datetime string of the current time. */
    issuedAt: string;
    /**ISO 8601 datetime string that, if present, indicates when the signed
     * authentication message is no longer valid. */
    expirationTime?: string;
    /**ISO 8601 datetime string that, if present, indicates when the signed
     * authentication message will become valid. */
    notBefore?: string;
    /**System-specific identifier that may be used to uniquely refer to the
     * sign-in request. */
    requestId?: string;
    /**List of information or references to information the user wishes to have
     * resolved as part of authentication by the relying party. They are
     * expressed as RFC 3986 URIs separated by `\n- `. */
    resources?: string[];
    /**Human-readable ASCII assertion that the user will sign, and it must not
     * contain `\n`. */
    statement?: string;
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "SiweConfig")]
    pub type SiweConfig;

    #[wasm_bindgen(structural, method, getter)]
    pub fn address(this: &SiweConfig) -> String;

    #[wasm_bindgen(structural, method, getter)]
    pub fn chainId(this: &SiweConfig) -> u32;

    #[wasm_bindgen(structural, method, getter)]
    pub fn domain(this: &SiweConfig) -> String;

    #[wasm_bindgen(structural, method, getter)]
    pub fn nonce(this: &SiweConfig) -> Option<String>;

    #[wasm_bindgen(structural, method, getter)]
    pub fn issuedAt(this: &SiweConfig) -> String;

    #[wasm_bindgen(structural, method, getter)]
    pub fn expirationTime(this: &SiweConfig) -> Option<String>;

    #[wasm_bindgen(structural, method, getter)]
    pub fn notBefore(this: &SiweConfig) -> Option<String>;

    #[wasm_bindgen(structural, method, getter)]
    pub fn requestId(this: &SiweConfig) -> Option<String>;

    #[wasm_bindgen(structural, method, getter)]
    pub fn resources(this: &SiweConfig) -> Option<Vec<JsString>>;

    #[wasm_bindgen(structural, method, getter)]
    pub fn statement(this: &SiweConfig) -> Option<String>;
}
