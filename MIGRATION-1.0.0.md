# web-sdk 1.0.0 Migration Guide

Quick reference for migrating to the new unified auth module. For detailed documentation, see [docs/web-sdk/guides/migration-1.0.0.md](documentation/docs/web-sdk/guides/migration-1.0.0.md).

## What's New

- **Session-only mode**: Start without a wallet, receive delegations
- **SignStrategy pattern**: Control sign request handling
- **Identity model**: Clear `did` vs `sessionDid` distinction
- **`connectWallet()` upgrade**: Transition from session-only to wallet mode

## Enabling New Auth

```typescript
const tcw = new TinyCloudWeb({
  useNewAuth: true,  // Enable new auth module
  providers: { web3: { driver: window.ethereum } }
});
```

## Breaking Changes Summary

### Deprecated Methods (throw when `useNewAuth: true`)

| Legacy | New Auth Replacement |
|--------|----------------------|
| `resolveEns()` | Use ethers.js/viem directly |
| `getProvider()` | `tcw.isWalletConnected` |
| `getSigner()` | `tcw.signMessage()` |
| `generateSiweMessage()` | `tcw.webAuth.prepareSessionForSigning()` |
| `signInWithSignature()` | `tcw.webAuth.signInWithPreparedSession()` |

### New Properties

| Property | Description |
|----------|-------------|
| `tcw.did` | Primary identity (PKH when wallet, session key otherwise) |
| `tcw.sessionDid` | Session key DID (always available) |
| `tcw.isSessionOnly` | True if no wallet connected |
| `tcw.isWalletConnected` | True if wallet connected (may not be signed in) |
| `tcw.isNewAuthEnabled` | True if using new auth module |
| `tcw.webAuth` | Access to WebUserAuthorization instance |

### New Methods

| Method | Description |
|--------|-------------|
| `tcw.connectWallet(provider)` | Upgrade from session-only to wallet mode |

## New Config Options

```typescript
interface TCWConfig {
  useNewAuth?: boolean;                    // Enable new auth (default: false)
  signStrategy?: WebSignStrategy;          // How to handle signing
  spaceCreationHandler?: ISpaceCreationHandler; // Space creation UI
}
```

## SignStrategy Options

```typescript
// Wallet popup (default for web)
signStrategy: { type: 'wallet-popup' }

// Callback for custom UI
signStrategy: {
  type: 'callback',
  handler: async (req) => ({ approved: true })
}

// Event emitter for external handling
signStrategy: { type: 'event-emitter', emitter: myEmitter }
```

## Migration Examples

### Standard Web App

```typescript
// Before
const tcw = new TinyCloudWeb({
  providers: { web3: { driver: window.ethereum } }
});
await tcw.signIn();

// After (minimal change)
const tcw = new TinyCloudWeb({
  useNewAuth: true,
  providers: { web3: { driver: window.ethereum } }
});
await tcw.signIn();
```

### Session-Only Mode (New Feature)

```typescript
// Start without wallet
const tcw = new TinyCloudWeb({ useNewAuth: true });
console.log(tcw.sessionDid);  // Available immediately

// Later, connect wallet
tcw.connectWallet(window.ethereum);
await tcw.signIn();
console.log(tcw.did);  // Now shows wallet PKH DID
```

### External Signing

```typescript
// Before
const siwe = await tcw.generateSiweMessage(address);
const sig = await external.sign(siwe.prepareMessage());
await tcw.signInWithSignature(siwe, sig);

// After
const prep = await tcw.webAuth.prepareSessionForSigning();
const sig = await external.sign(prep.prepared.siwe);
await tcw.webAuth.signInWithPreparedSession(prep.prepared, sig, prep.keyId, prep.jwk);
```

## New Type Exports

```typescript
import {
  WebUserAuthorization,
  WebUserAuthorizationConfig,
  WebSignStrategy,
  ModalSpaceCreationHandler,
  SignStrategy,
  SignRequest,
  SignResponse,
  ISpaceCreationHandler,
  SpaceCreationContext,
} from '@tinycloud/web-sdk';
```

## FAQ

**Q: Is legacy mode still supported?**
A: Yes, `useNewAuth: false` (default) maintains full backward compatibility.

**Q: Can session-only users access storage?**
A: They can receive delegations but not create their own space. Connect a wallet and sign in to create a space.

**Q: How do I check which mode I'm in?**
A: Use `tcw.isNewAuthEnabled` and `tcw.isSessionOnly`.
