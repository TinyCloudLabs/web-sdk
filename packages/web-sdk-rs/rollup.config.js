import typescript from "rollup-plugin-typescript2";
import { execSync } from "child_process";

// Plugin to generate WASM chunks before build
const generateWasmChunks = {
  name: 'generate-wasm-chunks',
  buildStart() {
    console.log('Generating WASM chunks...');
    execSync('node scripts/split-wasm.js', { stdio: 'inherit' });
  }
};

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "cjs",
    // Enable code splitting to keep chunks separate
    preserveModules: true,
    preserveModulesRoot: 'src'
  },
  plugins: [generateWasmChunks, typescript()],
};
