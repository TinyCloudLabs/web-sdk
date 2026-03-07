---
"@tinycloud/web-sdk": minor
---

Switch module output from UMD to ESM for native compatibility with Vite, SvelteKit, and other modern bundlers. Adds proper `exports`, `module`, and `browser` fields to package.json. Consumers using `require()` will need to switch to `import`.
