# TC CLI Command Reference

## Global Options

| Flag | Description |
|------|-------------|
| `-p, --profile <name>` | Profile to use |
| `-H, --host <url>` | Node URL override |
| `-v, --verbose` | Verbose output |
| `-q, --quiet` | Suppress non-essential output |
| `--no-cache` | Disable caching |

## Delegations

```bash
tc delegation create \
  --to did:pkh:eip155:1:0xRecipient... \
  --path kv/shared \
  --actions kv/get,kv/put \
  --expiry 24h

tc delegation list              # All
tc delegation list --granted    # Granted by me
tc delegation list --received   # Received by me
tc delegation info <cid>
tc delegation revoke <cid>
```

Actions are auto-prefixed with `tinycloud.` if not already.

## Spaces

```bash
tc space list
tc space create myspace
tc space info                   # Current space
tc space info <space-id>        # Specific space
tc space switch myspace
```

## Profiles

Multiple identities/environments with isolated keys and sessions.

```bash
tc profile list
tc profile create staging --host https://staging.tinycloud.xyz
tc profile show                 # Current profile
tc profile switch staging       # Change default
tc profile delete old-profile
```

Per-command override: `tc kv get mykey --profile staging`

## Node Health

```bash
tc node health                  # Ping + latency
tc node version                 # Server version
tc node status                  # Combined
```

## Shell Completions

```bash
eval "$(tc completion bash)"
eval "$(tc completion zsh)"
tc completion fish | source
```

## Share Create Options

| Flag | Description | Default |
|------|-------------|---------|
| `--path <path>` | KV path scope (required) | — |
| `--actions <actions>` | Comma-separated actions | `kv/get` |
| `--expiry <duration>` | Duration: `1h`, `7d`, `1w`, or ISO date | `7d` |
| `--web-link` | Generate browser-friendly URL | off |

## KV Put Input Sources (mutually exclusive)

| Source | Example |
|--------|---------|
| Argument | `tc kv put key "value"` |
| File | `tc kv put key --file ./data.txt` |
| Stdin | `echo "data" \| tc kv put key --stdin` |

## Profile Directory Structure

```
~/.tinycloud/
├── config.json                    # Global config (defaultProfile)
└── profiles/
    └── {name}/
        ├── profile.json           # Host, DID, chainId
        ├── key.json               # Ed25519 JWK keypair
        ├── session.json           # Delegation, spaceId
        └── cache/
```

## DID Formats

- **Session key**: `did:key:z6Mk...#z6Mk...` — generated at init
- **Primary DID**: `did:pkh:eip155:{chainId}:{address}` — after auth

All output is JSON. Errors go to stderr as `{error: {code, message}}`.
