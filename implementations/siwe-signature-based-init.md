# SIWE Signature-Based Initialization Implementation Plan

## Overview
Add two new methods to the TinyCloudWeb SDK to support SIWE message generation and signature-based initialization without requiring direct access to an Ethereum provider.

## Design Goals
- Generate portable SIWE messages with capabilities from configured extensions
- Initialize SDK sessions using pre-signed SIWE messages from external applications
- Maintain existing capability and extension system integration
- Skip the traditional "connected" state and go directly to session establishment

## Implementation Details

### 1. New Methods on TinyCloudWeb Class

#### 1.1 `generateSiweMessage()`
**Location**: `packages/web-sdk/src/tcw.ts`
**Signature**: 
```typescript
public generateSiweMessage(
  address: string,
  partialSiweMessage?: Partial<SiweMessage>
): SiweMessage
```

**Implementation Steps**:
1. Initialize `TCWSessionManager` from WASM
2. Create session key and store in manager
3. Apply extension capabilities (defaultActions/targetedActions)
4. Build SIWE message with capabilities as resources
5. Store session state for later retrieval
6. Return SiweMessage JSON

#### 1.2 `initializeWithSignature()`
**Location**: `packages/web-sdk/src/tcw.ts`
**Signature**:
```typescript
public async initializeWithSignature(
  siweMessage: SiweMessage,
  signature: string
): Promise<void>
```

**Implementation Steps**:
1. Validate that `generateSiweMessage()` was called first
2. Retrieve stored session state
3. Create `TCWClientSession` object
4. Apply extension `afterSignIn()` hooks
5. Set session on `userAuthorization`
6. Mark SDK as ready for API calls

### 2. Session State Management

#### 2.1 State Storage
- **Location**: Instance variable on `TinyCloudWeb` class
- **Type**: `TCWSessionManager` instance with generated session key
- **Lifecycle**: Persists between `generateSiweMessage()` and `initializeWithSignature()` calls
- **Cleanup**: Cleared after successful initialization or on error

#### 2.2 State Structure
```typescript
interface PendingSession {
  sessionManager: TCWSessionManager;
  address: string;
  generatedAt: number; // timestamp for expiration
}
```

### 3. Extension Integration

#### 3.1 Capability Application (generateSiweMessage)
Replicate `UserAuthorizationConnected.applyExtensions()` logic but only for capabilities:
```typescript
private async applyExtensionCapabilities(sessionManager: TCWSessionManager): Promise<void> {
  for (const extension of this.getExtensions()) {
    if (extension.namespace && extension.defaultActions) {
      const defaults = await extension.defaultActions();
      sessionManager.addDefaultActions(extension.namespace, defaults);
    }

    if (extension.namespace && extension.targetedActions) {
      const targetedActions = await extension.targetedActions();
      for (const target in targetedActions) {
        sessionManager.addTargetedActions(
          extension.namespace,
          target,
          targetedActions[target]
        );
      }
    }
  }
}
```

#### 3.2 AfterSignIn Hooks (initializeWithSignature)
```typescript
private async applyAfterSignInHooks(session: TCWClientSession): Promise<void> {
  for (const extension of this.getExtensions()) {
    if (extension.afterSignIn) {
      await extension.afterSignIn(session);
    }
  }
}
```

### 4. Error Handling

#### 4.1 Validation Errors
- **Missing generateSiweMessage call**: Throw descriptive error in `initializeWithSignature()`
- **WASM initialization failure**: Handle WASM module loading errors
- **Extension errors**: Catch and re-throw extension capability/hook errors

#### 4.2 Error Messages
```typescript
const ERRORS = {
  GENERATE_FIRST: 'generateSiweMessage() must be called before initializeWithSignature()',
  WASM_INIT_FAILED: 'Failed to initialize WASM session manager',
  SESSION_EXPIRED: 'Generated session has expired, call generateSiweMessage() again',
  EXTENSION_ERROR: 'Extension error during capability application',
};
```

### 5. Implementation Files

#### 5.1 Primary Changes
- **File**: `packages/web-sdk/src/tcw.ts`
- **Changes**: Add two new public methods and supporting private methods
- **Imports**: Add `SiweMessage` type from 'siwe' package

#### 5.2 Supporting Changes
- **File**: `packages/web-sdk/src/index.ts`
- **Changes**: Ensure `SiweMessage` type is exported (likely already done)

#### 5.3 Type Definitions
- **File**: `packages/web-core/src/client/types.ts` (if needed)
- **Changes**: Add any new interfaces for pending session state

### 6. Implementation Phases

#### Phase 1: Core Implementation
1. Add `generateSiweMessage()` method to `TinyCloudWeb`
2. Add session state storage mechanism
3. Implement capability application logic
4. Add basic error handling

#### Phase 2: Signature-Based Initialization
1. Add `initializeWithSignature()` method
2. Implement session completion logic
3. Add afterSignIn hook integration
4. Add comprehensive error handling

#### Phase 3: Testing and Validation
1. Unit tests for both methods
2. Integration tests with storage extension
3. Error scenario testing
4. Documentation updates

### 7. Code Structure

#### 7.1 Instance Variables
```typescript
export class TinyCloudWeb {
  // Existing properties...
  
  /** Pending session state for signature-based initialization */
  private pendingSession?: PendingSession;
}
```

#### 7.2 Method Implementations
```typescript
public generateSiweMessage(
  address: string,
  partialSiweMessage?: Partial<SiweMessage>
): SiweMessage {
  // 1. Initialize session manager
  // 2. Apply extension capabilities
  // 3. Build SIWE message
  // 4. Store pending session
  // 5. Return SIWE message
}

public async initializeWithSignature(
  siweMessage: SiweMessage,
  signature: string
): Promise<void> {
  // 1. Validate pending session exists
  // 2. Create TCWClientSession
  // 3. Apply afterSignIn hooks
  // 4. Set userAuthorization.session
  // 5. Clean up pending session
}
```

### 8. Testing Strategy

#### 8.1 Unit Tests
- Test `generateSiweMessage()` with various partial SIWE configs
- Test `initializeWithSignature()` with valid and invalid signatures
- Test error scenarios (missing generateSiweMessage call, etc.)

#### 8.2 Integration Tests
- Test with TinyCloudStorage extension enabled
- Test capability embedding in SIWE messages
- Test end-to-end flow from generation to API calls

#### 8.3 Example Usage Test
```typescript
describe('Signature-based initialization', () => {
  it('should generate SIWE and initialize with signature', async () => {
    const tcw = new TinyCloudWeb({ modules: { storage: true } });
    
    const siweMessage = tcw.generateSiweMessage('0x...', {
      domain: 'test.com',
      statement: 'Test sign-in'
    });
    
    expect(siweMessage.address).toBe('0x...');
    expect(siweMessage.chainId).toBe(1);
    expect(siweMessage.domain).toBe('test.com');
    
    const signature = await mockSigner.signMessage(siweMessage);
    await tcw.initializeWithSignature(siweMessage, signature);
    
    expect(tcw.session()).toBeDefined();
    expect(tcw.address()).toBe('0x...');
  });
});
```

### 9. Migration and Compatibility

#### 9.1 Backward Compatibility
- Existing `signIn()` flow remains unchanged
- New methods are additive, no breaking changes
- Extensions continue to work with both flows

#### 9.2 Documentation Updates
- Add usage examples to README
- Update API documentation
- Add migration guide for applications wanting to use new flow

### 10. Security Considerations

#### 10.1 Session State Security
- Pending sessions stored in memory only (not persisted)
- Session expiration to prevent stale state attacks
- Proper cleanup of cryptographic material

#### 10.2 SIWE Message Validation
- Validate address format and chain ID constraints
- Ensure capabilities are properly embedded
- Trust caller for signature validation (as specified)

### 11. Future Enhancements

#### 11.1 Cross-Tab Session Sharing
- Use sessionStorage for cross-tab session persistence
- Add session encryption for storage security

#### 11.2 Custom Session IDs
- Support multiple concurrent sessions
- Allow custom session identification

#### 11.3 Advanced Capability Management
- Dynamic capability modification
- Capability revocation and renewal

## Implementation Timeline

**Week 1**: Core implementation (generateSiweMessage + session state)
**Week 2**: Signature-based initialization (initializeWithSignature)
**Week 3**: Testing, error handling, and documentation
**Week 4**: Integration testing and refinement

## Success Criteria

1. ✅ `generateSiweMessage()` produces valid SIWE messages with embedded capabilities
2. ✅ `initializeWithSignature()` successfully initializes SDK sessions
3. ✅ Extension system works seamlessly with new flow
4. ✅ Error handling provides clear feedback for common issues
5. ✅ Full test coverage for both methods and integration scenarios
6. ✅ Documentation and examples enable easy adoption