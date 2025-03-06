---
sidebar_position: 1
---

# TinyCloud Web SDK

Welcome to the TinyCloud Web SDK documentation. This SDK provides all the tools you need to build decentralized web applications with TinyCloud.

## Overview

The TinyCloud Web SDK is a comprehensive toolkit that enables developers to integrate decentralized storage, authentication, and other Web3 capabilities into their applications. It provides a simple, intuitive API while abstracting away the complexities of blockchain interactions.

## Key Features

- **Decentralized Storage** - Store and retrieve data using the Kepler protocol
- **Web3 Authentication** - Sign-in with Ethereum (SIWE) integration
- **Wallet Integration** - Seamless connection with popular Ethereum wallets
- **Type Safety** - Written in TypeScript with comprehensive type definitions
- **Easy to Use** - Simple API for common decentralized application needs

## Getting Started

To get started with the TinyCloud Web SDK, first install the package:

```bash
npm install @tinycloudlabs/web-sdk
# or
bun add @tinycloudlabs/web-sdk
```

Then import and initialize the SDK in your application:

```typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

const tc = new TinyCloudWeb({
  // Configuration options here
});

// Connect to the user's wallet
await tc.connect();

// Use storage
const storage = tc.storage;
await storage.put('myKey', { hello: 'world' });
const result = await storage.get('myKey');
console.log(result.data); // { hello: 'world' }
```

## Documentation Sections

- [**Guides**](./guides/) - Step-by-step tutorials and how-to guides
  - [Getting Started](./guides/getting-started.md)
  - [Working with Storage](./guides/storage-guide.md)
  - [Authentication](./guides/authentication-guide.md)
- [**API Reference**](./api/) - Detailed reference documentation for all SDK components
  - [KeplerStorage](./api/keplerstorage.md)
  - [UserAuthorization](./api/userauthorization.md)

## Requirements

- Modern web browser or Node.js environment
- For Web3 functionality, users need a compatible wallet (e.g., MetaMask)

## Support

If you encounter any issues or have questions, please file an issue on our [GitHub repository](https://github.com/TinyCloudLabs/tc-sdk).