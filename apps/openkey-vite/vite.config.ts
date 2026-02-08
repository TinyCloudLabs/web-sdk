import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { readFileSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

const require = createRequire(import.meta.url);

// In production, Rollup's CJS plugin breaks the web-sdk webpack bundle
// (renames variables that eval'd code references by original name).
// Fix: load the UMD bundle via script tag and resolve imports from the global.
function externalWebSdkBuild(): Plugin {
  const virtualId = "\0web-sdk-shim";
  let isBuild = false;

  return {
    name: "external-web-sdk-build",
    enforce: "pre",
    config(_, { command }) {
      isBuild = command === "build";
    },
    resolveId(id) {
      if (isBuild && id === "@tinycloud/web-sdk") {
        return virtualId;
      }
    },
    load(id) {
      if (id === virtualId) {
        return `const sdk = window["@tinycloud/web-sdk"];
export const TinyCloudWeb = sdk.TinyCloudWeb;
export const UserAuthorization = sdk.UserAuthorization;
export const WebUserAuthorization = sdk.WebUserAuthorization;
export default sdk;`;
      }
    },
    transformIndexHtml() {
      if (isBuild) {
        return [{ tag: "script", attrs: { src: "/web-sdk.js" }, injectTo: "head" }];
      }
    },
    generateBundle() {
      const webSdkPkg = require.resolve("@tinycloud/web-sdk/package.json");
      const distDir = resolve(dirname(webSdkPkg), "dist");

      // Emit main UMD bundle with this→globalThis fix
      let mainSource = readFileSync(resolve(distDir, "index.js"), "utf-8");
      mainSource = mainSource.replace('}(this,', '}(globalThis,');
      this.emitFile({ type: "asset", fileName: "web-sdk.js", source: mainSource });

      // Emit any webpack code-split chunks with this→globalThis fix
      for (const file of readdirSync(distDir)) {
        if (file !== "index.js" && file.endsWith(".js") && /^\d+\./.test(file)) {
          let chunkSource = readFileSync(resolve(distDir, file), "utf-8");
          chunkSource = chunkSource.replace(/this\.webpackChunk/g, 'globalThis.webpackChunk');
          this.emitFile({ type: "asset", fileName: file, source: chunkSource });
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), externalWebSdkBuild()],
  server: {
    port: 5175,
    strictPort: true,
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  optimizeDeps: {
    include: ["@tinycloud/web-sdk"],
  },
});
