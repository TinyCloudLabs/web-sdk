# TinyCloud Web SDK

<img src="https://github.com/TinyCloudLabs/tc-sdk/blob/main/documentation/static/img/tinycloudheader.png?raw=true" alt="TinyCloud" width="100%" />

The TinyCloud Web SDK provides all the tools you need to build decentralized web applications with TinyCloud.

[![npm version](https://img.shields.io/npm/v/@tinycloudlabs/web-sdk.svg)](https://www.npmjs.com/package/@tinycloudlabs/web-sdk)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/TinyCloudLabs/tc-sdk/blob/main/LICENSE-MIT)

## Features

- **Decentralized Storage** - Store and retrieve data using TinyCloud's storage protocol
- **Web3 Authentication** - Sign-in with Ethereum (SIWE) integration
- **Wallet Integration** - Seamless connection with popular Ethereum wallets
- **Type Safety** - Written in TypeScript with comprehensive type definitions
- **Easy to Use** - Simple API for common decentralized application needs

## Installation

```bash
# Using npm
npm install @tinycloudlabs/web-sdk

# Using Yarn
yarn add @tinycloudlabs/web-sdk

# Using Bun (recommended)
bun add @tinycloudlabs/web-sdk
```

## Quick Start

```typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

// Initialize the SDK
const tc = new TinyCloudWeb({
  projectId: 'your-project-id' // Get this from your TinyCloud dashboard
});

// Connect to the user's wallet
await tc.connect();

// Use storage
const storage = tc.storage;
await storage.put('myKey', { hello: 'world' });
const result = await storage.get('myKey');
console.log(result.data); // { hello: 'world' }
```

## Basic Storage Operations

### Storing Data

```typescript
// Store a simple object
await storage.put('user/profile', {
  name: 'Alice',
  email: 'alice@example.com',
  preferences: {
    theme: 'dark',
    notifications: true
  }
});

// Store a string
await storage.put('messages/welcome', 'Welcome to the app!');

// Store binary data (as a Uint8Array)
const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
await storage.put('files/data.bin', binaryData);
```

### Retrieving Data

```typescript
// Get an object
const profileResponse = await storage.get('user/profile');
const profile = profileResponse.data;
console.log(`User name: ${profile.name}`);

// Get a string
const messageResponse = await storage.get('messages/welcome');
console.log(messageResponse.data); // "Welcome to the app!"
```

### Listing Data

```typescript
// List all keys under 'user/'
const userKeysResponse = await storage.list({
  path: 'user',
  removePrefix: true // Remove the prefix from the returned keys
});

const userKeys = userKeysResponse.data;
console.log('User keys:', userKeys); // ['profile', ...]
```

### Deleting Data

```typescript
// Delete a single key
await storage.delete('messages/welcome');

// Delete all data under a prefix
await storage.deleteAll('user');
```

## Core Values

TinyCloud is built on these fundamental principles:

- **Sovereignty** - Built so that each user controls their data outright. Requests to access or compute on that data must be explicitly permissioned.
- **Privacy** - Data is stored, streamed, and computed upon in ways that minimize leakage with encryption strategies that ensure users do not need to trust an external party.
- **Interoperability** - Embracing artifact-based formats like Markdown, JSON Canvas, CSV, and SQLite so that data remains portable and future-proof.
- **Open Innovation** - We view AI's rapid growth as an opportunity to endow individuals with new capabilities—before these capabilities are seized exclusively by large institutions.

## Documentation

For complete documentation, please visit:

- [**TinyCloud SDK Documentation**](https://docs.tinycloud.xyz/)
- [**Guides**](https://docs.tinycloud.xyz/docs/web-sdk/guides/)
  - [Getting Started Guide](https://docs.tinycloud.xyz/docs/web-sdk/guides/getting-started)
  - [Storage Guide](https://docs.tinycloud.xyz/docs/web-sdk/guides/storage-guide)
  - [Authentication Guide](https://docs.tinycloud.xyz/docs/web-sdk/guides/authentication-guide)
- [**API Reference**](https://docs.tinycloud.xyz/docs/web-sdk/api/)
  - [TinyCloudStorage](https://docs.tinycloud.xyz/docs/web-sdk/api/tinycloudstorage)
  - [UserAuthorization](https://docs.tinycloud.xyz/docs/web-sdk/api/userauthorization)

## Examples

Check out our [examples directory](https://github.com/TinyCloudLabs/tc-sdk/tree/main/examples) for complete working examples of TinyCloud SDK integration.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE-MIT](https://github.com/TinyCloudLabs/tc-sdk/blob/main/LICENSE-MIT) file for details.

## Support

If you encounter any issues or have questions, please file an issue on our [GitHub repository](https://github.com/TinyCloudLabs/tc-sdk/issues).

## Community

Join the TinyCloud community:

- [Twitter](https://twitter.com/TinyCloudLabs)
- [Discord](https://discord.gg/tinycloud)