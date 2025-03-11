---
sidebar_position: 3
---

<img src="/img/tinycloudheader.png" alt="TinyCloud" width="100%" />

# Working with Storage

This guide covers how to use the storage functionality provided by the TinyCloud Web SDK.

## Overview

The TinyCloud Web SDK provides decentralized storage through the Kepler protocol. This allows you to store, retrieve, and manage data without relying on centralized servers.

## Accessing Storage

Once you've initialized the SDK and connected to a user's wallet, you can access the storage functionality:

```typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

// Initialize and connect
const tc = new TinyCloudWeb();
await tc.connect();

// Access the storage module
const storage = tc.storage;
```

## Basic Operations

### Storing Data

Use the `put` method to store data:

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

Use the `get` method to retrieve data:

```typescript
// Get an object
const profileResponse = await storage.get('user/profile');
const profile = profileResponse.data;
console.log(`User name: ${profile.name}`);

// Get a string
const messageResponse = await storage.get('messages/welcome');
console.log(messageResponse.data); // "Welcome to the app!"

// Get binary data
const fileResponse = await storage.get('files/data.bin');
const fileData = fileResponse.data; // Uint8Array
```

### Listing Data

Use the `list` method to get a list of keys under a prefix:

```typescript
// List all keys under 'user/'
const userKeysResponse = await storage.list({
  path: 'user',
  removePrefix: true // Remove the prefix from the returned keys
});

const userKeys = userKeysResponse.data;
console.log('User keys:', userKeys); // ['profile', ...]

// List all keys (with paths)
const allKeysResponse = await storage.list();
console.log('All keys:', allKeysResponse.data);
```

### Deleting Data

Use the `delete` method to remove data:

```typescript
// Delete a single key
await storage.delete('messages/welcome');

// Delete all data under a prefix
await storage.deleteAll('user');
```

## Advanced Usage

### File Organization

You can organize your data by using path-like keys:

```typescript
// Store data in different "folders"
await storage.put('users/alice/profile', aliceProfile);
await storage.put('users/bob/profile', bobProfile);

// List all users
const usersResponse = await storage.list({
  path: 'users',
  removePrefix: true
});
```

### Custom Prefix

You can specify a custom prefix for your storage operations:

```typescript
// Initialize with a custom prefix
const tc = new TinyCloudWeb({
  storage: {
    prefix: 'myApp'
  }
});

// Use a different prefix for a specific operation
await storage.put('data', value, {
  prefix: 'customPrefix'
});
```

### Sharing Data

You can generate sharing links to allow others to access specific files:

```typescript
// Generate a sharing link for a file
const sharingLink = await storage.generateSharingLink('users/alice/profile');
console.log('Share this link:', sharingLink);

// Retrieve data from a sharing link
const sharedData = await storage.retrieveSharingLink(sharingLink);
console.log('Shared data:', sharedData.data);
```

### Delegating Access

For more fine-grained control, you can delegate specific permissions:

```typescript
// First get a sessionKey DID from the user you want to delegate to
const delegateDID = 'did:key:...';

// Delegate read access to a specific file or folder
const delegation = await storage.delegate({
  target: `${storage.orbitId}/kv/users/alice/profile`,
  delegateDID: delegateDID,
  actions: ['get', 'metadata'],
  statement: 'I am giving you permission to view my profile'
});
```

## Error Handling

Always handle potential errors when working with storage:

```typescript
try {
  const response = await storage.get('someKey');
  console.log(response.data);
} catch (error) {
  console.error('Error retrieving data:', error);
  
  // Handle specific error cases
  if (error.status === 404) {
    console.log('Data not found');
  } else if (error.status === 401) {
    console.log('Not authorized to access this data');
  }
}
```

## Next Steps

Now that you understand how to work with storage, you might want to explore:

- [Authentication](./authentication-guide.md) - Learn more about the authentication flow
- [KeplerStorage API Reference](../api/keplerstorage.md) - Detailed reference for all storage methods