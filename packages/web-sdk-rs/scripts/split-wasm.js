#!/usr/bin/env node
/**
 * Script to split WASM binary into 3 base64 chunks to avoid Cloudflare Pages 25MB limit
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WASM_FILE = path.join(__dirname, '../pkg/tinycloud_web_sdk_rs_bg.wasm');
const CHUNKS_DIR = path.join(__dirname, '../src/wasm-chunks');

function splitWasmIntoChunks() {
  // Note: WASM is already optimized by wasm-pack build --release
  // which automatically runs wasm-opt, so no additional optimization needed
  
  // Read the WASM binary
  const wasmBuffer = fs.readFileSync(WASM_FILE);
  console.log(`Original WASM size: ${wasmBuffer.length} bytes`);
  
  // Convert to base64
  const base64 = wasmBuffer.toString('base64');
  console.log(`Base64 size: ${base64.length} characters`);
  
  // Split into 3 equal parts
  const chunkSize = Math.ceil(base64.length / 3);
  const chunks = [
    base64.slice(0, chunkSize),
    base64.slice(chunkSize, chunkSize * 2),
    base64.slice(chunkSize * 2)
  ];
  
  console.log(`Chunk sizes: ${chunks.map(c => c.length).join(', ')}`);
  
  // Create chunks directory
  if (!fs.existsSync(CHUNKS_DIR)) {
    fs.mkdirSync(CHUNKS_DIR, { recursive: true });
  }
  
  // Write each chunk to a separate file
  chunks.forEach((chunk, index) => {
    const chunkFile = path.join(CHUNKS_DIR, `chunk-${index + 1}.js`);
    const content = `export const wasmChunk${index + 1} = "${chunk}";\n`;
    fs.writeFileSync(chunkFile, content);
    console.log(`Written chunk ${index + 1} to ${chunkFile} (${chunk.length} chars)`);
  });
  
  // Create an index file that exports all chunks
  const indexContent = `export { wasmChunk1 } from './chunk-1.js';
export { wasmChunk2 } from './chunk-2.js';
export { wasmChunk3 } from './chunk-3.js';

export function reconstructWasm() {
  return wasmChunk1 + wasmChunk2 + wasmChunk3;
}
`;
  
  fs.writeFileSync(path.join(CHUNKS_DIR, 'index.js'), indexContent);
  console.log('Created index.js with reconstruction function');
}

if (require.main === module) {
  splitWasmIntoChunks();
}

module.exports = { splitWasmIntoChunks };