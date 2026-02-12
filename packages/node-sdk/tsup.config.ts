import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
  // Externalize workspace packages and node_modules
  external: [
    '@tinycloud/sdk-core',
    '@tinycloud/node-sdk-wasm',
    '@tinycloud/web-core',
    'siwe',
    'events',
    'fs',
    'path',
  ],
});
