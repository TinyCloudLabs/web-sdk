# TinyCloud Web SDK (Rust/WASM)

<img src="https://github.com/TinyCloudLabs/tc-sdk/blob/main/documentation/static/img/tinycloudheader.png?raw=true" alt="TinyCloud" width="100%" />

WebAssembly library written in Rust for the TinyCloud Web SDK.

[![npm version](https://img.shields.io/npm/v/@tinycloudlabs/web-sdk-rs.svg)](https://www.npmjs.com/package/@tinycloudlabs/web-sdk-rs)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/TinyCloudLabs/tc-sdk/blob/main/LICENSE-MIT)

## Overview

This package provides high-performance WebAssembly components for TinyCloud Web SDK. It uses `rollup` to encode the `.wasm` as a base64-encoded string, meaning there is no configuration needed downstream to support WebAssembly (other than a compatible browser).

## Features

- **High Performance** - Critical operations implemented in Rust for maximum efficiency
- **Small Footprint** - Minimal bundle size overhead
- **Seamless Integration** - Works directly with the JavaScript SDK without configuration

## Installation

```bash
# Using npm
npm install @tinycloudlabs/web-sdk-rs

# Using Yarn
yarn add @tinycloudlabs/web-sdk-rs

# Using Bun (recommended)
bun add @tinycloudlabs/web-sdk-rs
```

## Usage

This package is typically used internally by the main TinyCloud Web SDK, but you can also use it directly:

```typescript
import { initialize } from '@tinycloudlabs/web-sdk-rs';

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

This project is licensed under the MIT License - see the [LICENSE-MIT](https://github.com/TinyCloudLabs/tc-sdk/blob/main/LICENSE-MIT) file for details.

## Related Packages

- [**@tinycloudlabs/web-sdk**](https://www.npmjs.com/package/@tinycloudlabs/web-sdk) - The main TinyCloud Web SDK package
- [**@tinycloudlabs/web-core**](https://www.npmjs.com/package/@tinycloudlabs/web-core) - Core utilities and types