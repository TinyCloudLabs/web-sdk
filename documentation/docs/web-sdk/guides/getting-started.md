---
sidebar_position: 2
---

<img src="/img/tinycloudheader.png" alt="TinyCloud" width="100%" />

# Getting Started

This guide will help you get started with the TinyCloud Web SDK.

## Installation

Install the SDK using your preferred package manager:

```bash
npm install @tinycloudlabs/web-sdk
# or
bun add @tinycloudlabs/web-sdk
```

## Basic Usage

Here's a simple example of how to initialize the SDK and connect to a user's wallet:

```typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

// Initialize the SDK
const tc = new TinyCloudWeb({
  // Your configuration options
});

// Connect to the user's wallet
await tc.connect();

// Now you can use the SDK's functionality
// For example, storing data with TinyCloud
const storage = tc.storage;
await storage.put('myKey', { hello: 'world' });

// Or retrieving data
const result = await storage.get('myKey');
console.log(result.data); // { hello: 'world' }
```

## Configuration Options

When initializing the SDK, you can provide various configuration options:

```typescript
const tc = new TinyCloudWeb({
  // General configuration
  debug: true, // Enable debug logging
  
  // TinyCloud storage configuration
  storage: {
    hosts: ['https://node.tinycloud.xyz'], // TinyCloud host endpoints
    prefix: 'myApp', // Prefix for all storage operations
    autoCreateNewOrbit: true, // Automatically create a new orbit if one doesn't exist
  },
  
  // SIWE (Sign-In with Ethereum) configuration
  siweConfig: {
    domain: 'example.com', // The domain to display in the SIWE message
    statement: 'Sign in to Example App', // Custom statement for the SIWE message
  }
});
```

## Next Steps

Once you have the SDK installed and initialized, you can explore more advanced functionality:

- [Working with Storage](./storage-guide.md) - Learn how to store, retrieve, and manage data
- [Authentication](./authentication-guide.md) - Understand the authentication and authorization flow