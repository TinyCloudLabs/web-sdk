# TinyCloud Web Core

<img src="https://github.com/TinyCloudLabs/web-sdk/blob/main/documentation/static/img/tinycloudheader.png?raw=true" alt="TinyCloud" width="100%" />

TinyCloud Web Core provides foundational utilities and types used by TinyCloud SDKs.

[![npm version](https://img.shields.io/npm/v/@tinycloud/web-core.svg)](https://www.npmjs.com/package/@tinycloud/web-core)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](https://github.com/TinyCloudLabs/web-sdk/blob/main/LICENSE-MIT)

## Overview

This package is a library made to aggregate types and utilities for other TinyCloud web packages. It serves as the foundation for the TinyCloud SDK ecosystem.

## Features

- **Type Definitions** - Comprehensive TypeScript type definitions 
- **Utility Functions** - Common utilities for TinyCloud services
- **Error Types** - Standardized error handling across packages
- **Configuration Interfaces** - Shared configuration types

## Installation

```bash
# Using npm
npm install @tinycloud/web-core

# Using Yarn
yarn add @tinycloud/web-core

# Using Bun (recommended)
bun add @tinycloud/web-core
```

## Usage

```typescript
import { IStorageGetOptions, IStoragePutOptions } from '@tinycloud/web-core';
```

## Documentation

For complete documentation, please visit:

- [**TinyCloud SDK Documentation**](https://docs.tinycloud.xyz/)
- [**API Reference**](https://docs.tinycloud.xyz/docs/web-sdk/api/core/)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE-MIT](https://github.com/TinyCloudLabs/web-sdk/blob/main/LICENSE-MIT) file for details.

## Related Packages

- [**@tinycloud/web-sdk**](https://www.npmjs.com/package/@tinycloud/web-sdk) - The main TinyCloud Web SDK package