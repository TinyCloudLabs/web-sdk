# TinyCloud Web SDK (Rust/WASM)

<img src="https://github.com/TinyCloudLabs/web-sdk/blob/main/documentation/static/img/tinycloudheader.png?raw=true" alt="TinyCloud" width="100%" />

WebAssembly library written in Rust for the TinyCloud Web SDK.

[![npm version](https://img.shields.io/npm/v/@tinycloud/web-sdk-wasm.svg)](https://www.npmjs.com/package/@tinycloud/web-sdk-wasm)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/TinyCloudLabs/web-sdk/blob/main/LICENSE-MIT)

## Overview

This package provides high-performance WebAssembly components for TinyCloud Web SDK. It uses `rollup` to encode the `.wasm` as a base64-encoded string, meaning there is no configuration needed downstream to support WebAssembly (other than a compatible browser).

## Features

- **High Performance** - Critical operations implemented in Rust for maximum efficiency
- **Small Footprint** - Minimal bundle size overhead
- **Seamless Integration** - Works directly with the JavaScript SDK without configuration

## Installation

```bash
# Using npm
npm install @tinycloud/web-sdk-wasm

# Using Yarn
yarn add @tinycloud/web-sdk-wasm

# Using Bun (recommended)
bun add @tinycloud/web-sdk-wasm
```

## Usage

This package is typically used internally by the main TinyCloud Web SDK, but you can also use it directly:

```typescript
import { initialize } from '@tinycloud/web-sdk-wasm';

// Initialize the WASM module
await initialize();

// Use the WASM functions
// ...
```

## Building from Source

### Requirements

* [Rust](https://www.rust-lang.org/tools/install)
* [wasm-pack](https://rustwasm.github.io/wasm-pack/installer/)
* [Bun](https://bun.sh) or [Yarn](https://yarnpkg.com/getting-started/install)

### Building

For development builds:

```bash
bun run build-dev
```

For optimized release builds:

```bash
bun run build-release
```

Then bundle the package:

```bash
bun run bundle
```

## Documentation

For complete documentation, please visit:

- [**TinyCloud SDK Documentation**](https://docs.tinycloud.xyz/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE-MIT](https://github.com/TinyCloudLabs/web-sdk/blob/main/LICENSE-MIT) file for details.

## Related Packages

- [**@tinycloud/web-sdk**](https://www.npmjs.com/package/@tinycloud/web-sdk) - The main TinyCloud Web SDK package
- [**@tinycloud/web-core**](https://www.npmjs.com/package/@tinycloud/web-core) - Core utilities and types