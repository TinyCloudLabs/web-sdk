# TinyCloud Web SDK Example App

This is an example application demonstrating the usage of the TinyCloud Web SDK.

## Bundle Size Optimization Guide

The following optimizations have been applied to reduce the bundle size for Cloudflare Pages deployment:

### Implemented Optimizations

1. **Code Splitting**
   - Added React.lazy and Suspense for route components
   - Implemented webpack splitChunks configuration for vendor modules

2. **Removed Unnecessary Polyfills**
   - Reduced Node.js polyfills to only essential ones (buffer)

3. **Build Optimizations**
   - Disabled source maps in production build
   - Added bundle analyzer for dependency size inspection

4. **Component Lazy Loading**
   - Lazy loaded heavy components like StorageModule

### Additional Recommendations

1. **Analyze Bundle**
   - Run `bun run build:analyze` to see which dependencies are taking up the most space

2. **Web3 Dependency Management**
   - Consider loading ethereum-related libraries dynamically only when needed
   - Explore using smaller alternatives to ethers.js (such as viem)
   - Only import specific components from web3modal

3. **Other Optimizations**
   - Use dynamic imports for large third-party libraries
   - Consider implementing a service worker for caching
   - Use tree-shakable imports: `import { specificFunction } from 'library'` instead of `import library from 'library'`

4. **Production Fine-tuning**
   - Set aggressive compression for Cloudflare Pages
   - Deploy static assets to a CDN if possible

## Running the App

```
bun install
bun run start
```

## Building for Production

```
bun run build
```

## Analyzing Bundle Size

```
bun run build:analyze
```