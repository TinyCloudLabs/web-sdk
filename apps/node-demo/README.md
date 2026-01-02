# TinyCloud Node.js SDK Demo

Demonstrates the full TinyCloud flow using the Node.js SDK:

1. **Alice** creates a namespace and stores data
2. **Alice** delegates read-only access to **Bob**
3. **Bob** reads data from Alice's namespace
4. **Bob** tries to write (fails - read-only access)

## Quick Start

```bash
# From the web-sdk repository root
bun install

# Run the demo
cd apps/node-demo
bun run demo
```

## Generate Keys

Generate a new Ed25519 session key:

```bash
# Generate with default key ID
bun run keygen

# Generate with custom key ID
bun run keygen alice
```

**One-liner to export a key:**

```bash
export TINYCLOUD_DEMO_KEY_ALICE=$(bun run keygen alice 2>/dev/null | grep -A1 "Base64-encoded" | tail -1)
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TINYCLOUD_URL` | TinyCloud server URL | `http://localhost:4000` |
| `TINYCLOUD_DEMO_KEY_ALICE` | Alice's base64-encoded JWK | Auto-generated |
| `TINYCLOUD_DEMO_KEY_BOB` | Bob's base64-encoded JWK | Auto-generated |
| `TINYCLOUD_ETH_PRIVATE_KEY` | Ethereum private key (base64) | Demo key |

## Running with a Live Server

```bash
# Start your TinyCloud server, then:
TINYCLOUD_URL=http://localhost:4000 bun run demo

# Or with pre-generated keys for reproducibility:
export TINYCLOUD_DEMO_KEY_ALICE="eyJraWQiOiJhbGljZSIsImt0eSI6Ik9LUCIsImNydiI6IkVkMjU1MTkiLC..."
export TINYCLOUD_DEMO_KEY_BOB="eyJraWQiOiJib2IiLCJrdHkiOiJPS1AiLCJjcnYiOiJFZDI1NTE5IiwieCI..."
bun run demo
```

## Demo Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         TinyCloud Demo                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Ethereum Wallet (owner)                                       │
│         │                                                       │
│         │ signs SIWE message                                    │
│         ▼                                                       │
│   ┌───────────┐                                                 │
│   │   Alice   │  Session Key (Ed25519)                         │
│   │   (DID)   │  Full KV access: put, get, del, list           │
│   └─────┬─────┘                                                 │
│         │                                                       │
│         │ delegates with attenuation                            │
│         ▼                                                       │
│   ┌───────────┐                                                 │
│   │    Bob    │  Session Key (Ed25519)                         │
│   │   (DID)   │  Read-only access: get, list, metadata         │
│   └───────────┘                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## SDK Usage Examples

### Create a Session Manager

```typescript
import {
  TCWSessionManager,
  exportKeyAsBase64,
  loadKeyFromEnv,
} from "@tinycloudlabs/node-sdk-wasm";

// Create new session with auto-generated key
const manager = new TCWSessionManager();
const did = manager.getDID();

// Or load from environment
loadKeyFromEnv(manager, "MY_TINYCLOUD_KEY", "my-key");
```

### Prepare a Session

```typescript
import { prepareSession, completeSessionSetup } from "@tinycloudlabs/node-sdk-wasm";

const config = {
  abilities: {
    kv: { "my-data/": ["tinycloud.kv/get", "tinycloud.kv/put"] }
  },
  address: "0x...",
  chainId: 1,
  domain: "myapp.com",
  issuedAt: new Date().toISOString(),
  expirationTime: new Date(Date.now() + 3600000).toISOString(),
  namespaceId: "tinycloud:pkh:eip155:1:0x...:default",
  jwk: JSON.parse(manager.jwk()!),
};

const prepared = prepareSession(config);
const signature = await wallet.signMessage(prepared.siwe);
const session = completeSessionSetup({ ...prepared, signature });
```

### Make Invocations

```typescript
import { invoke } from "@tinycloudlabs/node-sdk-wasm";

// Get headers for an invocation
const headers = invoke(session, "kv", "my-data/key", "tinycloud.kv/get");

// Make the request
const response = await fetch("https://tinycloud.example/invoke", {
  method: "POST",
  headers,
});
```

## Key Concepts

- **Session Key**: An Ed25519 key pair used for signing invocations
- **DID**: Decentralized Identifier derived from the session key (did:key:...)
- **Namespace**: A data container identified by `tinycloud:pkh:eip155:{chainId}:{address}:{name}`
- **Delegation**: SIWE-ReCap message chain authorizing session keys
- **Abilities**: Permitted actions (e.g., `tinycloud.kv/get`) on paths
