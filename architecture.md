# TinyCloud Web SDK Architecture

## Executive Summary

The TinyCloud Web SDK is a sophisticated, multi-layered TypeScript/Rust SDK that enables Web3 applications to integrate decentralized storage and user-controlled data management. The architecture follows a modular monorepo design with clear separation of concerns across three core packages, leveraging WebAssembly for security-critical operations.

## System Overview

### High-Level Architecture

```mermaid
graph TB
    subgraph "User Applications"
        A[React/Vue/JS Apps]
        B[Example App]
    end
    
    subgraph "TinyCloud Web SDK"
        subgraph "Public API Layer"
            C[web-sdk]
            C1[TinyCloudWeb]
            C2[UserAuthorization]
            C3[TinyCloudStorage]
        end
        
        subgraph "Core Layer"
            D[web-core]
            D1[Types & Interfaces]
            D2[Provider Utilities]
            D3[ENS Resolution]
        end
        
        subgraph "Security Layer"
            E["web-sdk-rs WASM"]
            E1[Session Manager]
            E2[Cryptographic Operations]
            E3[SIWE Implementation]
        end
    end
    
    subgraph "External Dependencies"
        F[Wallet Providers]
        G[Ethereum Network]
        H[TinyCloud Nodes]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    C --> F
    C --> G
    C --> H
    
    classDef userApp fill:#e1f5fe
    classDef publicAPI fill:#f3e5f5
    classDef coreLayer fill:#e8f5e8
    classDef securityLayer fill:#fff3e0
    classDef external fill:#fce4ec
    
    class A,B userApp
    class C,C1,C2,C3 publicAPI
    class D,D1,D2,D3 coreLayer
    class E,E1,E2,E3 securityLayer
    class F,G,H external
```

## Package Architecture

### Monorepo Structure

The project follows a Bun workspace configuration with the following packages:

```
tc-sdk/
├── packages/
│   ├── web-sdk-rs/         # Rust/WASM cryptographic layer
│   ├── web-core/           # TypeScript core types and utilities  
│   └── web-sdk/            # Main SDK interface
├── examples/
│   └── web-sdk-example/    # React demonstration app
├── documentation/          # Docusaurus documentation site
└── scripts/               # Build and deployment scripts
```

### Dependency Graph

```mermaid
graph LR
    subgraph "Workspace Dependencies"
        WS[web-sdk]
        WC[web-core]
        WR[web-sdk-rs]
        EX[example-app]
    end
    
    subgraph "External Dependencies"
        ET[ethers.js]
        SW[siwe]
        AX[axios]
        TC[tinycloud-sdk-rs]
    end
    
    WS --> WC
    WS --> WR
    WC --> WR
    WC --> ET
    WC --> SW
    WC --> AX
    WR --> TC
    WR --> SW
    EX --> WS
    
    classDef workspace fill:#e3f2fd
    classDef external fill:#f1f8e9
    
    class WS,WC,WR,EX workspace
    class ET,SW,AX,TC external
```

## Core Components Deep Dive

### 1. web-sdk: Public API Layer

**Purpose**: Primary consumer interface providing high-level abstractions for Web3 authentication and decentralized storage.

**Key Classes**:

#### TinyCloudWeb (Main SDK Entry Point)
```typescript
interface TinyCloudWeb {
  // Authentication
  signIn(): Promise<TCWClientSession>
  signOut(): Promise<void>
  
  // Wallet Integration  
  address(): string
  chainId(): number
  getProvider(): providers.Web3Provider
  getSigner(): Signer
  
  // Core Services
  userAuthorization: IUserAuthorization
  storage: TinyCloudStorage
  
  // Utilities
  resolveEns(name: string): Promise<TCWEnsData>
  extend(extension: TCWExtension): void
}
```

#### UserAuthorization (Authentication Flow)
```mermaid
stateDiagram-v2
    [*] --> Init: new UserAuthorization
    Init --> Connected: connect(wallet)
    Connected --> Authenticated: signIn()
    Authenticated --> SessionActive: Session established
    SessionActive --> [*]: signOut()
    
    Connected --> Init: disconnect()
    Authenticated --> Connected: authentication failed
```

#### TinyCloudStorage (Data Management)
```typescript
interface TinyCloudStorage {
  // CRUD Operations
  get(key: string, options?: GetOptions): Promise<any>
  put(key: string, value: any, options?: PutOptions): Promise<void>
  list(options?: ListOptions): Promise<string[]>
  delete(key: string, options?: DeleteOptions): Promise<void>
  
  // Orbit Management
  orbitId(): string
  createOrbit(name?: string): Promise<string>
  
  // Sharing & Delegation
  createSharingLink(key: string): Promise<string>
  createSessionDelegation(): Promise<SessionDelegation>
}
```

### 2. web-core: Foundation Layer

**Purpose**: Shared types, interfaces, and utilities that define the SDK's contract and provide common functionality.

**Architecture Modules**:

#### Type System (`/types.ts`)
```typescript
// Provider abstraction for multiple RPC services
type TCWRPCProvider = 
  | TCWAlchemyProvider
  | TCWInfuraProvider  
  | TCWEtherscanProvider
  | TCWCustomProvider
  // ... other providers

// Flexible server integration
interface TCWServerRoutes {
  nonce?: TCWServerRouteEndpointType
  login?: TCWServerRouteEndpointType  
  logout?: TCWServerRouteEndpointType
}
```

#### Client Configuration (`/client/types.ts`)
```typescript
interface TCWClientConfig {
  providers?: TCWClientProviders
  siwe?: Partial<SiweConfig>
  server?: TCWServerRoutes
  extensions?: TCWExtension[]
}

interface TCWClientSession {
  address: string
  walletAddress: string
  chainId: number
  sessionKey: string
  siwe: string
  signature: string
  ens?: TCWEnsData
}
```

#### Provider Utilities (`/utils/utils.ts`)
```typescript
// Factory function for ethers.js providers
function getProvider(config: TCWRPCProvider): providers.BaseProvider

// ENS resolution with avatar support
function tcwResolveEns(provider: providers.BaseProvider, address: string): Promise<TCWEnsData>
```

### 3. web-sdk-rs: Security & Performance Layer

**Purpose**: WebAssembly module providing cryptographic primitives, secure session management, and performance-critical operations.

**Rust Module Architecture**:

#### Session Management (`/session/`)
```rust
// Core session manager with Ed25519 cryptography
pub struct SessionManager {
    keys: HashMap<String, JWK>,
    current_session: Option<String>,
}

impl SessionManager {
    pub fn create_session_key(&mut self, session_id: String) -> Result<(), Error>
    pub fn get_did(&self, session_id: &str) -> Result<String, Error>
    pub fn build(&self, config: SiweConfig) -> Result<String, Error>
}

// WASM bindings for JavaScript integration
#[wasm_bindgen]
pub struct TCWSessionManager {
    inner: SessionManager,
}
```

#### Integration with TinyCloud Protocol
```rust
use tinycloud_sdk_wasm::{
    makeOrbitId, prepareSession, completeSessionSetup,
    invoke, generateHostSIWEMessage, siweToDelegationHeaders
};
```

## Authentication & Session Flow

### Complete Authentication Sequence

```mermaid
sequenceDiagram
    participant App as User App
    participant SDK as TinyCloudWeb
    participant Auth as UserAuthorization
    participant WASM as "SessionManager WASM"
    participant Wallet as Wallet Provider
    participant TC as TinyCloud Node
    
    App->>SDK: new TinyCloudWeb with config
    App->>SDK: signIn()
    SDK->>Auth: signIn()
    
    Auth->>Wallet: request wallet connection
    Wallet-->>Auth: account address + provider
    
    Auth->>WASM: createSessionKey(sessionId)
    WASM-->>Auth: Ed25519 keypair generated
    
    Auth->>WASM: build(siweConfig) 
    WASM-->>Auth: SIWE message with ReCap capabilities
    
    Auth->>Wallet: signMessage with siweMessage
    Wallet-->>Auth: signature
    
    Auth->>TC: POST tcw-login with siwe and signature
    TC-->>Auth: session token
    
    Auth->>SDK: TCWClientSession
    SDK-->>App: authenticated session
    
    Note over App,TC: User can now perform storage operations
```

### Extension System Architecture

```mermaid
graph TD
    subgraph "Extension Lifecycle"
        A[Extension Registration] --> B[afterConnect Hook]
        B --> C[Configuration Override]
        C --> D[SIWE Message Generation]
        D --> E[afterSignIn Hook]
        E --> F[Extension Active]
    end
    
    subgraph "Extension Capabilities"
        G[defaultActions]
        H[targetedActions]
        I[extraFields]
        J[Custom Middleware]
    end
    
    F --> G
    F --> H
    F --> I
    F --> J
    
    classDef lifecycle fill:#e8f5e8
    classDef capability fill:#fff3e0
    
    class A,B,C,D,E,F lifecycle
    class G,H,I,J capability
```

## Data Storage Architecture

### TinyCloud Storage Model

```mermaid
graph TB
    subgraph "Client Application"
        A[User Data Request]
    end
    
    subgraph "SDK Layer"
        B[TinyCloudStorage]
        C[Session Delegation]
        D[Orbit Management]
    end
    
    subgraph "TinyCloud Network"
        E[TinyCloud Node]
        F[User Orbit]
        G[Shared Data]
        H[Capability Validation]
    end
    
    A --> B
    B --> C
    B --> D
    C --> E
    D --> F
    E --> H
    F --> G
    
    classDef client fill:#e1f5fe
    classDef sdk fill:#f3e5f5
    classDef network fill:#e8f5e8
    
    class A client
    class B,C,D sdk
    class E,F,G,H network
```

### Storage Operations Flow

```mermaid
sequenceDiagram
    participant App as Application
    participant Storage as TinyCloudStorage
    participant Auth as UserAuthorization
    participant WASM as WASM Layer
    participant Node as TinyCloud Node
    
    App->>Storage: put(key, value, options)
    Storage->>Auth: getSession()
    Auth-->>Storage: current session
    
    Storage->>WASM: prepareSession(sessionData)
    WASM-->>Storage: prepared session headers
    
    Storage->>Node: POST /orbit/{orbitId}/{key}
    Note over Storage,Node: Headers: session delegation
    Node-->>Storage: storage confirmation
    
    Storage-->>App: operation complete
    
    App->>Storage: get(key, options)
    Storage->>Node: GET /orbit/{orbitId}/{key}
    Node-->>Storage: encrypted data
    Storage-->>App: decrypted value
```

## Security Model

### Cryptographic Architecture

```mermaid
graph TD
    subgraph "Key Management (WASM)"
        A[Ed25519 Key Generation]
        B[Session Key Storage]
        C[DID Creation]
    end
    
    subgraph "Authentication"
        D[SIWE Message Building]
        E[Wallet Signature]
        F[Session Token]
    end
    
    subgraph "Authorization"
        G[Capability Delegation]
        H[Resource-based Access]
        I[Temporal Validity]
    end
    
    A --> C
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    G --> H
    H --> I
    
    classDef crypto fill:#ffebee
    classDef auth fill:#e8f5e8
    classDef authz fill:#fff3e0
    
    class A,B,C crypto
    class D,E,F auth
    class G,H,I authz
```

### Security Boundaries

1. **WASM Isolation**: Cryptographic operations isolated in WebAssembly sandbox
2. **Session Management**: Temporary session keys with configurable expiration
3. **Capability-based Access**: Fine-grained permissions using SIWE ReCap
4. **Cross-origin Security**: Proper CORS handling and domain validation

## Performance Characteristics

### Build & Bundle Optimization

```mermaid
graph LR
    subgraph "Development"
        A[TypeScript Source]
        B[Rust Source]
    end
    
    subgraph "Build Process"
        C[tsc compilation]
        D[wasm-pack build]
        E[Rollup bundling]
        F[Type fixup]
    end
    
    subgraph "Distribution"
        G[NPM Packages]
        H[WASM Binaries]
        I[Type Definitions]
    end
    
    A --> C
    B --> D
    C --> E
    D --> E
    E --> F
    F --> G
    D --> H
    C --> I
    F --> I
    
    classDef source fill:#e3f2fd
    classDef build fill:#f1f8e9
    classDef dist fill:#fff3e0
    
    class A,B source
    class C,D,E,F build
    class G,H,I dist
```

### Runtime Performance

- **WASM Execution**: Near-native speed for cryptographic operations
- **Async Initialization**: Non-blocking WASM module loading
- **Session Caching**: Persistent session state across page reloads
- **Lazy Loading**: Modules loaded on-demand based on configuration

## Development & Deployment

### Build Scripts & Automation

```bash
# Root level builds
bun run build         # Build all packages
./scripts/build.sh    # Alternative build script

# Package-specific
web-sdk-rs:  bun run build-dev | build-release
web-core:    bun run build
web-sdk:     bun run build

# Documentation
bun run docs:generate-api    # Generate API docs
bun run docs:dev            # Development server
```

### Release Management

- **Changesets**: Automated versioning and changelog generation
- **Multi-registry**: Support for both NPM and GitHub Package Registry
- **Workspace Dependencies**: Proper inter-package version management

## Integration Patterns

### Recommended Usage Pattern

```typescript
// 1. SDK Initialization
const tcw = new TinyCloudWeb({
  providers: {
    web3: { /* wallet config */ },
    rpc: { service: 'alchemy', apiKey: 'key' }
  },
  modules: {
    storage: true
  }
});

// 2. Authentication Flow
await tcw.signIn();

// 3. Storage Operations
await tcw.storage.put('user-preferences', { theme: 'dark' });
const preferences = await tcw.storage.get('user-preferences');

// 4. Extension Integration
tcw.extend(customExtension);
```

### Framework Integration

- **React**: Hooks for authentication state and storage operations
- **Vue**: Composables for reactive SDK integration  
- **Vanilla JS**: Direct SDK usage with Promise-based API
- **TypeScript**: Comprehensive type definitions for all interfaces

## Future Architecture Considerations

### Scalability
- **Orbit Federation**: Multi-node data distribution
- **Caching Layers**: Client-side and CDN optimization
- **Load Balancing**: Intelligent node selection

### Protocol Evolution
- **Capability Expansion**: New ReCap capability types
- **Cross-chain Support**: Multi-blockchain session management
- **Identity Standards**: DID method standardization

---

This architecture enables developers to build user-controlled applications with confidence, knowing that security, performance, and developer experience have been carefully balanced through a well-designed, layered architecture.