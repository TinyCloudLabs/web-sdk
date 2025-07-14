/**
 * Custom WASM loader that reconstructs WASM from 3 base64 chunks
 */

// Import the chunks - these will be separate files to avoid large bundles
import { wasmChunk1 } from './wasm-chunks/chunk-1.js';
import { wasmChunk2 } from './wasm-chunks/chunk-2.js';
import { wasmChunk3 } from './wasm-chunks/chunk-3.js';

/**
 * Reconstructs the WASM binary from 3 base64 chunks
 * @returns {Uint8Array} The reconstructed WASM binary
 */
function reconstructWasmBinary() {
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
 * @returns {Uint8Array} The WASM binary
 */
export function getWasmBinary() {
  return reconstructWasmBinary();
}

/**
 * Loads and instantiates the WASM module
 * @param {Object} imports - WebAssembly imports object
 * @returns {Promise<WebAssembly.Instance>} The instantiated WASM module
 */
export async function loadWasm(imports) {
  const wasmBytes = reconstructWasmBinary();
  return await WebAssembly.instantiate(wasmBytes, imports);
}

/**
 * Loads the WASM module asynchronously (for better performance)
 * @param {Object} imports - WebAssembly imports object
 * @returns {Promise<WebAssembly.Instance>} The instantiated WASM module
 */
export async function loadWasmAsync(imports) {
  // This allows for dynamic chunk loading if needed in the future
  const chunks = await Promise.all([
    Promise.resolve(wasmChunk1),
    Promise.resolve(wasmChunk2),
    Promise.resolve(wasmChunk3)
  ]);
  
  const base64 = chunks.join('');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return await WebAssembly.instantiate(bytes, imports);
}