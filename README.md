# TinyCloud SDK

<img src="https://github.com/TinyCloudLabs/web-sdk/blob/master/documentation/static/img/tinycloudheader.png?raw=true" alt="TinyCloud" width="100%" />

TinyCloud SDK is a comprehensive toolkit for building decentralized applications with TinyCloud. It provides easy-to-use interfaces for storage, authentication, and more.

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/TinyCloudLabs/web-sdk/blob/main/LICENSE-MIT)

## Features

- **Decentralized Storage** - Store and retrieve data using TinyCloud's storage protocol
- **Web3 Authentication** - Sign-in with Ethereum (SIWE) integration
- **Wallet Integration** - Seamless connection with popular Ethereum wallets
- **Type Safety** - Written in TypeScript with comprehensive type definitions
- **Easy to Use** - Simple API for common decentralized application needs

## Packages

This monorepo contains the following packages:

| Package | Description |
|---------|-------------|
| [`@tinycloudlabs/web-sdk`](./packages/web-sdk/) | The main TinyCloud Web SDK package |
| [`@tinycloudlabs/web-core`](./packages/web-core/) | Core utilities and types for TinyCloud SDKs |
| [`@tinycloudlabs/web-sdk-wasm`](./packages/sdk-rs/) | Rust/WASM components for the TinyCloud SDK |
| [`@tinycloudlabs/node-sdk-wasm`](./packages/node-sdk-wasm/) | Node.js WASM bindings for the TinyCloud SDK |

## Quick Start

```bash
# Install the SDK
npm install @tinycloudlabs/web-sdk
```

```typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

// Initialize the SDK
const tc = new TinyCloudWeb();

// Connect to the user's wallet
await tc.connect();

// Use storage
const storage = tc.storage;
await storage.put('myKey', { hello: 'world' });
const result = await storage.get('myKey');
console.log(result.data); // { hello: 'world' }
```

## Documentation

For complete documentation, please visit:

- [**TinyCloud SDK Documentation**](https://docs.tinycloud.xyz/)
- [**Guides**](https://docs.tinycloud.xyz/docs/web-sdk/guides/)
  - [Getting Started Guide](https://docs.tinycloud.xyz/docs/web-sdk/guides/getting-started)
  - [Storage Guide](https://docs.tinycloud.xyz/docs/web-sdk/guides/storage-guide)
  - [Authentication Guide](https://docs.tinycloud.xyz/docs/web-sdk/guides/authentication-guide)
- [**API Reference**](https://docs.tinycloud.xyz/docs/web-sdk/api/)

## Examples

Check out our [examples directory](./examples/) for complete working examples of TinyCloud SDK integration.

## Development

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js v16+
- Rust for sdk-rs package

### Building the SDK

```bash
# Clone the repository
git clone https://github.com/TinyCloudLabs/web-sdk.git
cd web-sdk

# Install dependencies
bun install

# Build all packages
bun run build
```

### Running Tests

```bash
bun run test
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Inspiration

The TinyCloud Web SDK is the spiritual successor to the [SSX SDK](https://github.com/spruceid/ssx). SSX was an open source project built at SpruceID, made to make it easier to build apps with Sign in with Ethereum. While SSX saw limited adoption, it was a great project that pioneered the use of Ethereum for authentication and authorization. TinyCloud Web takes some of its architectural shape from SSX, but is built to be a modern SDK for building applications with TinyCloud.

## License

This project is licensed under the MIT License - see the [LICENSE-MIT](./LICENSE-MIT) file for details.

## Support

If you encounter any issues or have questions, please file an issue on our [GitHub repository](https://github.com/TinyCloudLabs/web-sdk/issues).

## Community

Join the TinyCloud community:

- [Twitter](https://twitter.com/TinyCloudLabs)
- [Telegram](https://t.me/+pplkv1XbbU01MDVh)