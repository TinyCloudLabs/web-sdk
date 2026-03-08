---
"@tinycloud/web-sdk": minor
---

Ship dual ESM + CJS bundles for broad bundler compatibility. ESM consumers (Vite, SvelteKit) use `import`, CJS consumers (CRA, webpack, Node.js require()) use `require()`.
