# TinyCloud Javascript SDK

<img src="https://github.com/TinyCloudLabs/web-sdk/blob/master/documentation/static/img/tinycloudheader.png?raw=true" alt="TinyCloud" width="100%" />

TinyCloud SDK is a comprehensive toolkit for building decentralized applications with TinyCloud. It provides easy-to-use interfaces for storage, authentication, and more.

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/TinyCloudLabs/web-sdk/blob/main/LICENSE-MIT)

## Features

- **Web3 Authentication** - Sign-in with Ethereum (SIWE) using your wallet
- **Namespace Management** - Create and manage user-owned data namespaces
- **KV Storage** - Store and retrieve key-value data with your namespace
- **Delegation System** - Share access to your data with fine-grained permissions
- **Wallet Integration** - Seamless connection with popular Ethereum wallets (browser SDK)
- **Server Support** - Node.js SDK for server-side delegation chains and automation
- **Type Safety** - Written in TypeScript with comprehensive type definitions
- **Easy to Use** - Simple API for common decentralized application needs

## Packages

This monorepo contains the following packages:

### Core SDKs

| Package | Description | Platform |
|---------|-------------|----------|
| [`@tinycloudlabs/web-sdk`](./packages/web-sdk/) | Browser SDK with wallet integration | Browser |
| [`@tinycloudlabs/node-sdk`](./packages/node-sdk/) | Node.js SDK for server-side applications | Node.js |

### Core Libraries

| Package | Description |
|---------|-------------|
| [`@tinycloudlabs/web-core`](./packages/web-core/) | Shared types and utilities for browser SDK |
| [`@tinycloudlabs/sdk-core`](./packages/sdk-core/) | Core utilities and types shared across all SDKs |
| [`@tinycloudlabs/sdk-rs`](./packages/sdk-rs/) | Rust implementation with cryptographic primitives |

### WASM Bindings

| Package | Description |
|---------|-------------|
| [`@tinycloudlabs/web-sdk-wasm`](./packages/sdk-rs/web-sdk-wasm/) | WASM bindings for browser environments |
| [`@tinycloudlabs/node-sdk-wasm`](./packages/sdk-rs/node-sdk-wasm/) | WASM bindings for Node.js environments |

## Quick Start

### Browser SDK

```bash
# Install the browser SDK
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

### Node.js SDK

```bash
# Install the Node.js SDK
npm install @tinycloudlabs/node-sdk
```

```typescript
import { TinyCloudNode } from '@tinycloudlabs/node-sdk';

// Initialize with private key
const tc = new TinyCloudNode({
  privateKey: 'your-ethereum-private-key',
  host: 'https://node.tinycloud.xyz',
  autoCreateNamespace: true,
});

// Sign in and create namespace
await tc.signIn();

// Use KV storage
await tc.kv.put('myKey', { hello: 'world' });
const result = await tc.kv.get('myKey');
console.log(result.data); // { hello: 'world' }

// Create delegations
const delegation = await tc.createDelegation({
  path: 'shared/',
  actions: ['tinycloud.kv/get', 'tinycloud.kv/put'],
  delegateDID: 'did:pkh:eip155:1:0x...',
});
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
