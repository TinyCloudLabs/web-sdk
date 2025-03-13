---
sidebar_position: 1
---

<img src="/img/tinycloudheader.png" alt="TinyCloud" width="100%" />

# TinyCloud SDK Documentation

Welcome to the TinyCloud SDK documentation. TinyCloud provides a comprehensive suite of tools designed to streamline Web3 development, enabling you to build powerful decentralized applications without the complexity.

## Why TinyCloud SDK?

TinyCloud SDK bridges the gap between Web2 and Web3, offering familiar developer interfaces while leveraging the power of decentralized technology:

- **Simplified Web3 Development**: Focus on building your application features, not blockchain complexity
- **Enterprise-Ready Solutions**: Built with scalability, security, and reliability in mind
- **Complete Web3 Toolkit**: Everything you need for modern decentralized applications

## SDK Components

The TinyCloud SDK ecosystem includes:

- [**Web SDK**](./web-sdk/) - Our flagship toolkit for web application development
  - [Getting Started Guide](./web-sdk/guides/getting-started.md)
  - [API Reference](./web-sdk/api/)

## Core Features

| Feature | Description |
|---------|-------------|
| **Decentralized Storage** | Securely store and retrieve data with TinyCloud protocol integration |
| **Web3 Authentication** | Seamless wallet-based authentication with SIWE support |
| **Type-Safe Development** | Comprehensive TypeScript definitions for improved developer experience |
| **Wallet Integration** | Connect with all major Ethereum wallets out of the box |
| **Simple API** | Intuitive interfaces that abstract blockchain complexity |

## Quick Start

```bash
# Install with npm
npm install @tinycloudlabs/web-sdk

# Or with Bun (recommended)
bun add @tinycloudlabs/web-sdk
```

```typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

// Initialize the SDK
const tc = new TinyCloudWeb({
  projectId: 'your-project-id'
});

// Connect to wallet
await tc.connect();

// Use storage
const storage = tc.storage;
await storage.put('myKey', { hello: 'decentralized world' });
```

## Need Help?

- [**API Reference**](./web-sdk/api/) - Detailed documentation for all SDK components
- [**Guides**](./web-sdk/guides/) - Step-by-step tutorials and how-to examples
- [**GitHub**](https://github.com/TinyCloudLabs/web-sdk) - Report issues or contribute to the project
- [**Discord Community**](https://discord.gg/tinycloud) - Get help from the TinyCloud team and community