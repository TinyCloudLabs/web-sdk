//! Cross-platform utilities for browser and Node.js environments.

#[cfg(feature = "nodejs")]
use wasm_bindgen::prelude::*;

#[cfg(feature = "nodejs")]
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
}

/// Log an error message to the console.
/// Uses web_sys::console in browser, wasm_bindgen extern in Node.js.
#[cfg(feature = "browser")]
pub fn log_error(msg: &str) {
    web_sys::console::error_1(&msg.into());
}

#[cfg(feature = "nodejs")]
pub fn log_error(msg: &str) {
    error(msg);
}

/// Fallback for when neither feature is enabled (e.g., tests)
#[cfg(not(any(feature = "browser", feature = "nodejs")))]
pub fn log_error(msg: &str) {
    // In test/default mode, just print to stderr
    eprintln!("{}", msg);
}
