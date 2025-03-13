---
sidebar_position: 2
---

<img src="/img/tinycloudheader.png" alt="TinyCloud" width="100%" />

# KeplerStorage

KeplerStorage provides decentralized storage functionality through the Kepler protocol. This class implements both the IStorage and IKepler interfaces.

```typescript
import { KeplerStorage } from '@tinycloudlabs/web-sdk';
```

## Description

KeplerStorage allows for storing, retrieving, and managing data in a decentralized way. It handles authentication and session management for secure data operations.

## Constructor

```typescript
constructor(config: any, userAuth: IUserAuthorization)
```

Creates a new instance of the KeplerStorage class.

**Parameters:**
- `config` - Configuration options for Kepler storage
  - `hosts` - Optional array of Kepler host endpoints
  - `prefix` - Optional prefix to use for all storage operations
  - `autoCreateNewOrbit` - Whether to automatically create a new orbit if one doesn't exist
- `userAuth` - User authorization interface for authentication

## Properties

| Name | Type | Description |
|------|------|-------------|
| `namespace` | `string` | The namespace identifier for Kepler storage. Default: `'kepler'` |
| `prefix` | `string` | The prefix used for all storage operations. |
| `orbitId` | `string \| undefined` | The user's orbit identifier. |
| `domain` | `string \| undefined` | The domain to display in the SIWE message. |

## Methods

### get

```typescript
async get(key: string, options?: IStorageGetOptions): Promise<Response>
```

Retrieves data from storage by key.

**Parameters:**
- `key` - The key to retrieve
- `options` - Optional configuration for the get operation

**Returns:** A Promise containing the response with the data

**Example:**
```typescript
const response = await keplerStorage.get('myData');
console.log(response.data);
```

### put

```typescript
async put(key: string, value: any, options?: IStoragePutOptions): Promise<Response>
```

Stores data in storage with the specified key.

**Parameters:**
- `key` - The key to store the data under
- `value` - The value to store
- `options` - Optional configuration for the put operation

**Returns:** A Promise containing the response from the storage operation

**Example:**
```typescript
const data = { name: 'Example', value: 42 };
await keplerStorage.put('myData', data);
```

### list

```typescript
async list(options?: IStorageListOptions): Promise<Response>
```

Lists keys in storage, optionally filtered by path.

**Parameters:**
- `options` - Configuration options for the list operation
  - `prefix` - Custom prefix to use instead of the default
  - `path` - Sub-path to list within the prefix
  - `removePrefix` - Whether to remove the prefix from the returned keys
  - `request` - Additional request options

**Returns:** A Promise containing the response with the list of keys

**Example:**
```typescript
const response = await keplerStorage.list({ 
  path: 'folder', 
  removePrefix: true 
});
console.log(response.data); // List of keys
```

### delete

```typescript
async delete(key: string, options?: IStorageDeleteOptions): Promise<Response>
```

Deletes the data stored under the specified key.

**Parameters:**
- `key` - The key to delete
- `options` - Optional configuration for the delete operation

**Returns:** A Promise containing the response from the delete operation

**Example:**
```typescript
await keplerStorage.delete('myData');
```

### deleteAll

```typescript
async deleteAll(prefix?: string): Promise<Response[]>
```

Deletes all data under a specific prefix.

**Parameters:**
- `prefix` - Optional sub-prefix to delete data under

**Returns:** A Promise containing an array of responses from the delete operations

**Example:**
```typescript
await keplerStorage.deleteAll('folder');
```

### delegate

```typescript
async delegate(params: DelegateParams): Promise<DelegateResponse>
```

Creates a delegation to allow another user to access specific resources.

**Parameters:**
- `params` - Parameters for the delegation
  - `target` - The target file or folder you are sharing
  - `delegateDID` - The DID of the key you are delegating to
  - `actions` - The actions you are authorizing the delegate to do
  - `statement` - Optional statement in the SIWE message

**Returns:** A Promise containing the delegation response with SIWE message and signature

### generateSharingLink

```typescript
async generateSharingLink(path: string, params?: any): Promise<string>
```

Generates a sharing link for a specific file or folder.

**Parameters:**
- `path` - The path to the file or folder to share
- `params` - Optional additional parameters

**Returns:** A Promise containing the encoded sharing link as a string

### retrieveSharingLink

```typescript
async retrieveSharingLink(encodedShare: string): Promise<Response>
```

Retrieves the data from a sharing link.

**Parameters:**
- `encodedShare` - The encoded sharing link

**Returns:** A Promise containing the response with the shared data