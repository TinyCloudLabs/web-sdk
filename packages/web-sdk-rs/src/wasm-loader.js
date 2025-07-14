/**
 * Custom WASM loader that reconstructs WASM from 3 base64 chunks loaded dynamically
 */

/**
 * Reconstructs the WASM binary from 3 base64 chunks loaded dynamically
 * @returns {Promise<Uint8Array>} The reconstructed WASM binary
 */
async function reconstructWasmBinary() {
  // Dynamically import all chunks
  const [
    { wasmChunk1 },
    { wasmChunk2 },
    { wasmChunk3 }
  ] = await Promise.all([
    import('./wasm-chunks/chunk-1.js'),
    import('./wasm-chunks/chunk-2.js'),
    import('./wasm-chunks/chunk-3.js')
  ]);
  
  // Concatenate all chunks
  const base64 = wasmChunk1 + wasmChunk2 + wasmChunk3;
  
  // Convert base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes;
}

/**
 * Returns the WASM binary as Uint8Array for wasm-bindgen init
 * @returns {Promise<Uint8Array>} The WASM binary
 */
export async function getWasmBinary() {
  return await reconstructWasmBinary();
}

/**
 * Loads and instantiates the WASM module
 * @param {Object} imports - WebAssembly imports object
 * @returns {Promise<WebAssembly.Instance>} The instantiated WASM module
 */
export async function loadWasm(imports) {
  const wasmBytes = await reconstructWasmBinary();
  return await WebAssembly.instantiate(wasmBytes, imports);
}