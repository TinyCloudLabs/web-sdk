# Node-SDK Test Specification

> Generated: 2026-01-15

## Overview

Test suite for `@tinycloudlabs/node-sdk` covering authentication, session management, signing, and storage functionality.

**Location**: `tests/node-sdk/`
**Test Runner**: `bun test` (configured in package.json)
**HTTP Mocking**: msw (Mock Service Worker)

---

## Architectural Decisions

### WASM Bindings
**Decision**: Use real WASM bindings, not mocks.

- Tests require `@tinycloudlabs/node-sdk-wasm` to be built before running
- Tests validate actual crypto/session logic from WASM
- Build dependency: `bun run build` in `packages/sdk-rs` must complete first

### Server Mocking
**Decision**: Full HTTP mocking with msw.

- All TinyCloud server endpoints are mocked (no network calls)
- Tests run offline, fast, and deterministic
- Mock handlers for: `activateSessionWithHost()`, `fetchPeerId()`, `submitHostDelegation()`

### Test Keys
**Decision**: Hardcoded known test keys + generated keys for space-creation tests.

- Use Hardhat's default test accounts for deterministic tests
- Generate random keys for tests that create real spaces (avoiding collisions)

---

## File Structure

Flat by feature (not mirroring source directories):

```
tests/node-sdk/
├── SPEC.md                    # This specification
├── fixtures.ts                # Shared test data (keys, addresses, sessions)
├── mocks/
│   └── handlers.ts            # msw request handlers
├── signIn.test.ts             # NodeUserAuthorization sign-in flow
├── signIn.errors.test.ts      # Error scenarios for sign-in
├── signer.test.ts             # PrivateKeySigner with known vectors
├── storage.test.ts            # Storage implementations (secondary priority)
└── setup.ts                   # Test setup (msw server, WASM init)
```

---

## Test Categories

### 1. Sign-In Flow (`signIn.test.ts`)

**Priority**: High
**Strategy Focus**: auto-sign (primary), smoke tests for others

#### Test Cases

```
describe('NodeUserAuthorization')
  describe('signIn')
    ✓ creates session with auto-sign strategy
    ✓ generates correct spaceId from address and prefix
    ✓ persists session to storage after signIn
    ✓ sets tinyCloudSession with delegationHeader
    ✓ calls ensureSpaceExists after session creation
    ✓ includes correct chainId in session

  describe('signOut')
    ✓ clears session from storage
    ✓ clears in-memory session state

  describe('sign strategies')
    ✓ auto-sign: automatically signs SIWE message
    ✓ auto-reject: throws on sign request
    ✓ callback: invokes handler with SignRequest (smoke)
    ✓ event-emitter: emits sign-request event (smoke)

  describe('ensureSpaceExists')
    ✓ succeeds when space exists (200 response)
    ✓ creates space when missing and autoCreateSpace=true
    ✓ throws when missing and autoCreateSpace=false
```

### 2. Sign-In Errors (`signIn.errors.test.ts`)

**Priority**: High
**Approach**: Comprehensive error paths

#### Test Cases

```
describe('NodeUserAuthorization error handling')
  describe('network errors')
    ✓ throws when server unreachable
    ✓ throws on connection timeout

  describe('server errors')
    ✓ throws on 500 server error
    ✓ throws on 401 unauthorized
    ✓ throws on 404 space not found (when autoCreate=false)

  describe('signature errors')
    ✓ throws when auto-reject strategy configured
    ✓ throws when callback rejects
    ✓ throws when event-emitter times out

  describe('key errors')
    ✓ throws on invalid private key length
    ✓ throws on malformed private key

  describe('session creation errors')
    ✓ throws when session key creation fails
    ✓ throws when space creation fails after 404
```

### 3. Private Key Signer (`signer.test.ts`)

**Priority**: Medium
**Approach**: Known test vectors for cryptographic correctness

#### Test Cases

```
describe('PrivateKeySigner')
  describe('constructor')
    ✓ accepts key with 0x prefix
    ✓ accepts key without 0x prefix
    ✓ throws on invalid key length (not 64 hex chars)
    ✓ accepts custom chainId
    ✓ defaults to chainId 1

  describe('getAddress')
    ✓ derives correct address from known private key
    ✓ returns checksum address (EIP-55)
    ✓ caches address after first derivation

  describe('signMessage')
    ✓ produces correct signature for known input
    ✓ returns 0x-prefixed signature
    ✓ handles string messages
    ✓ handles Uint8Array messages

  describe('known vectors')
    # Use Hardhat's default account 0:
    # Private: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
    # Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
    ✓ hardhat account 0 produces expected address
    ✓ hardhat account 0 signature matches expected
```

### 4. Storage (`storage.test.ts`)

**Priority**: Low (secondary)
**Approach**: Interface contract testing

#### Test Cases

```
describe('MemorySessionStorage')
  ✓ saves and loads session
  ✓ returns null for unknown address
  ✓ clears session
  ✓ normalizes address to lowercase
  ✓ auto-clears expired sessions on load
  ✓ exists returns false after expiry
  ✓ isAvailable returns true

describe('FileSessionStorage')
  ✓ saves session to file
  ✓ loads session from file
  ✓ clears session file
  ✓ auto-clears expired sessions
  ✓ uses default directory when not specified
  ✓ creates directory if missing
```

---

## Deferred (Out of Scope)

### Delegations
Deferred to future iteration. Focus on core auth first.

When added, should test:
- `createDelegation()` with correct PKH DID
- `createSubDelegation()` expiry constraints
- `useDelegation()` returns DelegatedAccess with working KV
- PKH vs session-key DID validation

### TinyCloudNode High-Level API
The `TinyCloudNode` class wraps `NodeUserAuthorization`. Test via auth tests for now.

### Session Resumption
`tryResumeSession()` skipped as it combines tested components (load + signIn).

### Deprecated APIs
`signInWithSignature()` intentionally untested (throws by design).

---

## Test Infrastructure

### Setup (`setup.ts`)

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Mock Handlers (`mocks/handlers.ts`)

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  // Activate session
  http.post('https://node.tinycloud.xyz/api/v1/session/activate', () => {
    return HttpResponse.json({ success: true });
  }),

  // Fetch peer ID
  http.get('https://node.tinycloud.xyz/api/v1/space/:spaceId/peer', () => {
    return HttpResponse.json({ peerId: 'test-peer-id' });
  }),

  // Host delegation
  http.post('https://node.tinycloud.xyz/api/v1/space/:spaceId/host', () => {
    return HttpResponse.json({ success: true });
  }),
];
```

### Test Fixtures (`fixtures.ts`)

```typescript
// Hardhat's default account 0
export const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
export const TEST_CHAIN_ID = 1;

// Generate random key for tests needing unique spaces
export function generateTestKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Mock persisted session
export const MOCK_PERSISTED_SESSION: PersistedSessionData = {
  address: TEST_ADDRESS,
  chainId: TEST_CHAIN_ID,
  sessionKey: '{"kty":"EC",...}',
  siwe: 'test-siwe-message',
  signature: '0x...',
  tinycloudSession: {
    delegationHeader: { Authorization: 'Bearer test' },
    delegationCid: 'bafytest',
    spaceId: 'test-space-id',
    verificationMethod: 'did:key:z6Mk...',
  },
  expiresAt: new Date(Date.now() + 3600000).toISOString(),
  createdAt: new Date().toISOString(),
  version: '1.0',
};
```

---

## Dependencies to Add

```json
{
  "devDependencies": {
    "msw": "^2.0.0",
    "@types/bun": "latest"
  }
}
```

---

## Running Tests

```bash
# From web-sdk root (after building WASM)
cd packages/node-sdk
bun test

# Run specific test file
bun test signIn.test.ts

# With coverage
bun test --coverage
```

---

## Success Criteria

1. All sign-in happy paths pass
2. All documented error scenarios have tests
3. Signer produces cryptographically correct outputs (verified against known vectors)
4. Tests run in <10 seconds (no network, no real server)
5. Tests work in CI without special configuration beyond WASM build
