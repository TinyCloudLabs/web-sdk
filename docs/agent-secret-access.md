# Agent Secret Access

How agents fetch secrets at runtime via the TinyCloud CLI.

## Quick Start

```bash
# Agent fetches a secret (simplest case — own vault)
API_KEY=$(TC_PRIVATE_KEY=<hex> tc secrets get FIREFLIES_API_KEY --quiet --raw)
curl -H "Authorization: Bearer $API_KEY" https://api.fireflies.ai/...
```

## Authentication Options

### Option A: Private Key Environment Variable (Recommended for Agents)

Set `TC_PRIVATE_KEY` with a 64-character hex private key. No browser or interactive auth needed.

```bash
export TC_PRIVATE_KEY=ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# All CLI commands use this key automatically
tc secrets list --quiet
tc secrets get MY_SECRET --quiet --raw
```

**Pros:** Zero-interaction, works in CI/CD and headless environments.
**Cons:** Private key must be securely provisioned to the agent.

### Option B: Private Key Flag

Pass the key per-command instead of as an environment variable.

```bash
tc secrets get MY_SECRET --private-key ac09...ff80 --quiet --raw
```

**Pros:** No env var needed.
**Cons:** Key visible in process list. Use Option A in production.

### Option C: Stored Session (Interactive Login)

Run `tc auth login` once to create a stored session, then use CLI without keys.

```bash
# One-time setup (opens browser to OpenKey)
tc auth login

# Subsequent commands use the stored session
tc secrets get MY_SECRET --quiet --raw
```

**Pros:** No raw private key handling.
**Cons:** Requires browser interaction; sessions expire.

## Workflows

### 1. Agent's Own Secrets

The agent has its own identity and vault. It stores and retrieves its own secrets.

```bash
# Store a secret
tc secrets put FIREFLIES_API_KEY sk-abc123 --quiet

# Retrieve it
API_KEY=$(tc secrets get FIREFLIES_API_KEY --quiet --raw)
```

### 2. Delegated Secrets (Admin → Agent)

An admin stores secrets and grants access to an agent's identity. This requires two steps: a **vault grant** (re-encrypts the decryption key) and a **delegation** (authorizes KV access to the admin's space).

#### Admin Side

```bash
# 1. Store the secret
tc secrets put FIREFLIES_API_KEY sk-abc123

# 2. Grant vault access to the agent's DID
#    (agent must have unlocked their vault at least once to publish their public key)
tc vault grant secrets/FIREFLIES_API_KEY --to did:pkh:eip155:1:0x70997970...

# 3. Create a delegation for KV access to your space
tc delegation create \
  --to did:pkh:eip155:1:0x70997970... \
  --path "" \
  --actions kv/get,kv/list \
  --expiry 24h

# Save the delegation output to a file and share with agent
tc delegation create ... > delegation.json
```

#### Agent Side

```bash
# Fetch the shared secret using the delegation token
tc vault get-shared \
  did:pkh:eip155:1:0xf39Fd6e5... \
  secrets/FIREFLIES_API_KEY \
  --delegation-file delegation.json \
  --raw
```

### 3. Agent Workflow Script

Complete example for an agent startup script:

```bash
#!/bin/bash
set -euo pipefail

# Agent authenticates with its own private key
export TC_PRIVATE_KEY="${TC_PRIVATE_KEY:?TC_PRIVATE_KEY must be set}"

# Option A: Read own secrets
FIREFLIES_KEY=$(tc secrets get FIREFLIES_API_KEY --quiet --raw)

# Option B: Read delegated secrets (admin shared with us)
ADMIN_DID="did:pkh:eip155:1:0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
DELEGATION_FILE="${TC_DELEGATION_FILE:-./delegation.json}"

SHARED_KEY=$(tc vault get-shared "$ADMIN_DID" secrets/FIREFLIES_API_KEY \
  --delegation-file "$DELEGATION_FILE" \
  --quiet --raw)

# Use the secrets
export FIREFLIES_API_KEY="$FIREFLIES_KEY"
exec "$@"
```

## Architecture

### Vault Encryption Model

```
Admin stores secret:
  plaintext → encrypt(dataKey) → ciphertext
  dataKey → encrypt(masterKey) → encryptedDataKey
  Store: vault/secrets/KEY = ciphertext
         keys/secrets/KEY  = encryptedDataKey

Admin grants to agent:
  encryptedDataKey → decrypt(masterKey) → dataKey
  dataKey → encrypt(sharedSecret) → reEncryptedDataKey
  sharedSecret = x25519_dh(admin.privateKey, agent.publicKey)
  Store: grants/{agentDID}/secrets/KEY = reEncryptedDataKey

Agent reads shared secret:
  reEncryptedDataKey → decrypt(sharedSecret) → dataKey
  sharedSecret = x25519_dh(agent.privateKey, admin.publicKey)
  ciphertext → decrypt(dataKey) → plaintext
```

### Two-Layer Access Control

1. **Vault Grant** — Cryptographic. Re-encrypts the per-entry data key to the agent's X25519 public key. Without this, the agent cannot decrypt the secret.

2. **Delegation** — Authorization. Grants the agent KV read access to the admin's space. Without this, the agent cannot reach the admin's encrypted data.

Both are required for delegated access. A delegation alone gives KV access but not decryption. A vault grant alone gives the decryption key but no way to fetch the ciphertext.

### Public Key Discovery

When an agent unlocks its vault (`tc vault unlock`), it publishes its X25519 public key to its public space at `.well-known/vault-pubkey`. The admin's `vault grant` command resolves this public key to perform the DH key exchange.

**Prerequisite:** The agent must have unlocked its vault at least once before the admin can grant access.

## CLI Reference

| Command | Description |
|---------|-------------|
| `tc secrets put <name> <value>` | Store an encrypted secret |
| `tc secrets get <name> --raw` | Retrieve a secret value |
| `tc secrets list` | List secret names |
| `tc secrets delete <name>` | Delete a secret |
| `tc vault grant <key> --to <did>` | Grant vault access to another DID |
| `tc vault revoke <key> --from <did>` | Revoke vault access (rotates key) |
| `tc vault list-grants <key>` | List DIDs with access to a key |
| `tc vault get-shared <did> <key> --delegation <json>` | Fetch a shared secret |
| `tc delegation create --to <did> --path "" --actions kv/get --expiry 1h` | Create a delegation |

## Error Scenarios

| Error | Cause | Fix |
|-------|-------|-----|
| `PUBLIC_KEY_NOT_FOUND` | Agent hasn't unlocked vault | Agent runs `tc vault unlock` first |
| `GRANT_NOT_FOUND` | Admin hasn't granted vault access | Admin runs `tc vault grant` |
| `DECRYPTION_FAILED` | Key was rotated after grant | Admin re-runs `tc vault grant` |
| `AUTH_REQUIRED` | No private key provided | Set `TC_PRIVATE_KEY` or use `--private-key` |
| `NOT_FOUND` | Secret doesn't exist | Check secret name with `tc secrets list` |
