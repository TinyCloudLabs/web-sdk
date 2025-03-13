pub use tinycloud_sdk_wasm;
pub mod session;

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[allow(non_snake_case)]
/// Initialise console-error-panic-hook to improve debug output for panics.
///
/// Run once on initialisation.
pub fn initPanicHook() {
    console_error_panic_hook::set_once();
}
