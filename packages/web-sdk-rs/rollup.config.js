import typescript from "rollup-plugin-typescript2";
import { wasm } from "@rollup/plugin-wasm";

export default {
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "cjs",
  },
  plugins: [wasm({ maxFileSize: 30000000 }), typescript()],
};