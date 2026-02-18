---
name: tc-cli
description: Stores, retrieves, and shares data on TinyCloud using the tc CLI or @tinycloud/node-sdk. Use when the user wants to store key-value data, create sharing links, manage delegations, or interact with a TinyCloud node.
---

# TinyCloud CLI

## Setup

```bash
npm install -g @tinycloud/cli
tc init                   # Generate key + authenticate via OpenKey
tc init --paste           # Headless/CI (manual paste)
tc init --key-only        # Key only, skip auth
```

Creates profile at `~/.tinycloud/profiles/default/` with key, config, and session.

## Authentication

```bash
tc auth login             # Browser-based OpenKey flow
tc auth login --paste     # Manual paste mode
tc auth status            # JSON: authenticated, DIDs, spaceId
tc auth whoami            # Identity info
tc auth logout            # Clear session, keep key
```

## Key-Value Storage

```bash
tc kv put mykey "value"                # String
tc kv put config '{"k":"v"}'           # JSON
tc kv put doc --file ./data.txt        # From file
echo "data" | tc kv put notes --stdin  # From stdin

tc kv get mykey                        # JSON: {key, data, metadata}
tc kv get mykey --raw                  # Raw value to stdout
tc kv get mykey --raw -o out.txt       # Raw value to file

tc kv list                             # All keys
tc kv list --prefix "logs/"            # Filter by prefix
tc kv head mykey                       # Metadata only
tc kv delete mykey                     # Delete
```

## Sharing

```bash
tc share create --path kv/mykey --actions kv/get --expiry 7d --web-link
tc share receive "eyJ0eXAi..."
tc share list
tc share revoke shr_abc123
```

For detailed command reference and all options, see [REFERENCE.md](REFERENCE.md).

For programmatic usage with `@tinycloud/node-sdk`, see [SDK.md](SDK.md).

## Common Patterns

```bash
# Store and share in one shot
tc kv put report "$(cat report.json)" && \
tc share create --path kv/report --actions kv/get --expiry 7d --web-link

# Pipe from curl into TinyCloud
curl -s https://api.example.com/data | tc kv put snapshot --stdin

# Read back and process
tc kv get snapshot --raw | jq '.results'
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Usage error |
| 3 | Auth required |
| 4 | Not found |
| 5 | Permission denied |
| 6 | Network error |
| 7 | Node error |
