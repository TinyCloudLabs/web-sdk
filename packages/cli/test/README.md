# CLI E2E Tests

End-to-end tests for the TinyCloud CLI (`tc`) against a local tinycloud-node.

## Prerequisites

1. **Build the CLI:**
   ```bash
   bun run build
   ```

2. **Run a local tinycloud-node** (one of):

   ```bash
   # Option A: cargo run (SQLite, simplest)
   cd repositories/tinycloud-node
   mkdir -p data/blocks && touch data/caps.db
   cargo run

   # Option B: docker-compose (PostgreSQL + S3)
   cd repositories/tinycloud-node/test
   docker-compose up
   ```

   The node must be reachable at `http://localhost:8000`. Tests auto-skip if it's not.

## Running Tests

```bash
# All E2E tests (75+ tests)
bun run test:e2e

# Individual suites
bun run test:e2e:vars           # Plaintext variables (7 tests)
bun run test:e2e:secrets        # Encrypted secrets (6 tests)
bun run test:e2e:vault          # Raw vault operations (10 tests)
bun run test:e2e:node           # Node health/status (3 tests)
bun run test:e2e:profile        # Profile CRUD (7 tests)
bun run test:e2e:doctor         # Diagnostic checks (4 tests)
bun run test:e2e:init           # Init --key-only (4 tests)
bun run test:e2e:kv             # KV store operations (11 tests)
bun run test:e2e:delegation     # Delegation management (9 tests, 5 skip if server lacks support)
bun run test:e2e:errors         # Error handling and exit codes (6 tests)
bun run test:e2e:agent-secrets  # Agent delegated vault access (8 tests, 3 skip if no delegation)
```

## Architecture

- Tests shell out to the built `bin/tc` binary via `Bun.spawn` (true E2E)
- A temporary `~/.tinycloud` profile directory is created per test suite (overrides `HOME`)
- Auth uses `TC_PRIVATE_KEY` env var (Hardhat test account #0, account #1 for agent tests)
- `ensureTestSpace()` creates the test user's space via SDK at module load time
- All commands run with `--host http://localhost:8000 --quiet` for JSON output
- Tests auto-skip with a warning if the local node isn't reachable
- Each test uses `uniqueKey()` for key name isolation between runs

## Test Coverage

| Command | Tested | Notes |
|---------|--------|-------|
| `tc vars list/get/put/delete` | Yes | Full CRUD, --raw, overwrite |
| `tc secrets list/get/put/delete` | Yes | Full CRUD, overwrite |
| `tc vault unlock/put/get/delete/list/head` | Yes | Full CRUD, --prefix, --raw, --output |
| `tc vault grant/revoke/list-grants/get-shared` | Yes | 2-user E2E (admin + agent) with Hardhat accounts #0/#1 |
| `tc node health/status` | Yes | Healthy + unreachable checks |
| `tc profile create/list/show/switch/delete` | Yes | Full lifecycle, error cases |
| `tc doctor` | Yes | All diagnostic checks |
| `tc init --key-only` | Yes | Key generation, custom name |
| `tc kv get/put/delete/list/head` | Yes | Full CRUD, --raw, --prefix, JSON values |
| `tc delegation create/list/info/revoke` | Partial | CLI structure tested; CRUD skips if server lacks /invoke delegation support |
| `tc space *` | No | Server lacks /invoke space support |
| `tc share *` | No | Server lacks /invoke sharing support |
| Error handling & exit codes | Yes | Invalid key, missing key, unreachable host, not found, JSON error output |
| Agent secret access (delegated vault) | Yes | Full flow: store → grant → delegate → fetch; revocation; missing grant |
| `tc auth login` | No | Requires browser |
| `tc init` (full) | No | Requires browser |
