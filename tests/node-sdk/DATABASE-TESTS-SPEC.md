# Node SDK — SQL & DuckDB Integration Test Specification

> Generated: 2026-03-08

## Overview

End-to-end integration tests for the SQL and DuckDB services in `@tinycloud/node-sdk`, running against a real tinycloud-node server. Tests validate the full round-trip: SDK signs invocation (WASM) -> HTTP to server -> server validates + executes -> SDK parses response.

These tests use EAV application data patterns (EAV schema, PIVOT views, filtered queries, aggregate analytics) as realistic workloads.

**Location**: `tests/node-sdk/`
**Test Runner**: `bun test`
**Server**: Real tinycloud-node instance (local `cargo run` or remote)

---

## Architectural Decisions

### Real Server, Not Mocks

Tests hit a real tinycloud-node server. This is intentional — the DuckDB service PR review found ~25 bugs across serde alignment, wire format, action names, and security boundaries. HTTP mocks would not have caught any of them.

**Trade-off**: Tests require a running server. Local dev uses `cargo run`, CI uses `node.tinycloud.xyz` (configurable).

### WASM Bindings: Real

Tests use real `@tinycloud/node-sdk-wasm` for signing. This validates the full UCAN invocation chain.

**Build dependency**: `bun run build` in `packages/sdk-rs` must complete first.

### Test Isolation: Fixed Account + Cleanup

- Fixed test private key (Hardhat account #0 by default, overridable via env)
- Fixed space prefix (`sdk-integration-test`)
- Each test file uses a unique database name to avoid cross-test interference
- `afterAll` hooks drop test tables and clean up state
- Parallel test files use distinct database names: `test-sql-query`, `test-duckdb-crud`, etc.

### DuckDbService Wiring

`TinyCloudNode` currently does not wire `DuckDbService`. This spec requires adding a `.duckdb` accessor to `TinyCloudNode`, mirroring the existing `.sql` accessor. This is a prerequisite implementation task.

---

## Prerequisites

### 1. Add DuckDbService to TinyCloudNode

Wire `DuckDbService` in `TinyCloudNode.initializeServices()` and `restoreSession()`:

```typescript
// In initializeServices():
import { DuckDbService, IDuckDbService } from "@tinycloud/sdk-core";

private _duckdb?: DuckDbService;

// After SQL service registration:
this._duckdb = new DuckDbService({});
this._duckdb.initialize(this._serviceContext);
this._serviceContext.registerService('duckdb', this._duckdb);

// Accessor:
get duckdb(): IDuckDbService {
  if (!this._duckdb) {
    throw new Error("Not signed in. Call signIn() first.");
  }
  return this._duckdb;
}
```

Also add `DuckDbService` and `IDuckDbService` to the sdk-core re-exports if not already present.

### 2. Add DuckDB abilities to root delegation

In `initializeV2Services()`, add DuckDB actions to the root delegation:
```typescript
actions: [
  // ... existing KV and SQL actions
  "tinycloud.duckdb/read",
  "tinycloud.duckdb/write",
  "tinycloud.duckdb/admin",
  "tinycloud.duckdb/describe",
  "tinycloud.duckdb/export",
  "tinycloud.duckdb/import",
  "tinycloud.duckdb/*",
],
```

---

## File Structure

```
tests/node-sdk/
├── DATABASE-TESTS-SPEC.md          # This specification
├── setup.ts                        # Server check, auth, shared helpers
├── fixtures/
│   └── crm-schema.ts               # EAV-style CRM schema DDL
├── sql/
│   ├── sql-query.test.ts            # SQL SELECT, params, types
│   ├── sql-execute.test.ts          # SQL INSERT, UPDATE, DELETE
│   ├── sql-batch.test.ts            # SQL transactional batches
│   └── sql-export.test.ts           # SQL database export
├── duckdb/
│   ├── duckdb-query.test.ts         # DuckDB SELECT, params, types
│   ├── duckdb-execute.test.ts       # DuckDB INSERT, UPDATE, DELETE, DDL
│   ├── duckdb-batch.test.ts         # DuckDB transactional batches
│   ├── duckdb-describe.test.ts      # DuckDB schema introspection
│   ├── duckdb-pivot.test.ts         # PIVOT queries (EAV critical path)
│   ├── duckdb-export-import.test.ts # DuckDB binary export + import
│   └── duckdb-security.test.ts      # Allowlist enforcement, blocked operations
└── package.json                     # Test package (bun test, dependencies)
```

---

## Test Infrastructure

### Server Connection (`setup.ts`)

```typescript
// Server URL: local cargo run or remote
const SERVER_URL = process.env.TC_TEST_SERVER ?? "http://localhost:8000";

// Test key: Hardhat account #0 default, env override
const TEST_PRIVATE_KEY = process.env.TC_TEST_PRIVATE_KEY
  ?? "ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const TEST_PREFIX = "sdk-integration-test";
```

**`ensureServer()`**: Before test suite runs, check server is reachable:
```typescript
export async function ensureServer(): Promise<void> {
  try {
    const res = await fetch(`${SERVER_URL}/version`);
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const info = await res.json();
    console.log(`Connected to tinycloud-node v${info.version}`);
  } catch (e) {
    throw new Error(
      `Cannot reach tinycloud-node at ${SERVER_URL}. ` +
      `Start the server with: cd ../tinycloud-node && cargo run\n` +
      `Or set TC_TEST_SERVER to point to a running instance.\n` +
      `Error: ${e}`
    );
  }
}
```

**`createTestClient()`**: Create and sign in a TinyCloudNode:
```typescript
export async function createTestClient(): Promise<TinyCloudNode> {
  const client = new TinyCloudNode({
    privateKey: TEST_PRIVATE_KEY,
    host: SERVER_URL,
    prefix: TEST_PREFIX,
    autoCreateSpace: true,
  });
  await client.signIn();
  return client;
}
```

**Shared client**: Tests within a file share one signed-in client (created in `beforeAll`). Different test files use different database names to avoid collision.

### CRM Schema Fixtures (`fixtures/crm-schema.ts`)

EAV-style CRM schema for realistic test data:

```typescript
export const CRM_SCHEMA = [
  // Core tables (EAV pattern)
  `CREATE TABLE IF NOT EXISTS objects (
    id VARCHAR PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    icon VARCHAR DEFAULT 'table',
    default_view VARCHAR DEFAULT 'table',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS fields (
    id VARCHAR PRIMARY KEY,
    object_id VARCHAR NOT NULL REFERENCES objects(id),
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL DEFAULT 'text',
    required BOOLEAN DEFAULT FALSE,
    default_value VARCHAR,
    enum_values JSON,
    enum_colors JSON,
    related_object_id VARCHAR,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS entries (
    id VARCHAR PRIMARY KEY,
    object_id VARCHAR NOT NULL REFERENCES objects(id),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,

  `CREATE TABLE IF NOT EXISTS entry_fields (
    id VARCHAR PRIMARY KEY,
    entry_id VARCHAR NOT NULL REFERENCES entries(id),
    field_id VARCHAR NOT NULL REFERENCES fields(id),
    value VARCHAR,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(entry_id, field_id)
  )`,
];

export const CRM_SEED = {
  objects: [
    // people, company, task object definitions
  ],
  fields: [
    // Full Name, Email, Phone, Company, Status for people
    // Company Name, Industry, Website for company
    // Title, Status (enum), Priority (enum), Due Date for task
  ],
  entries: [
    // 10-20 sample contacts, 5 companies, 10 tasks
  ],
};

// PIVOT view SQL (the critical EAV pattern)
export function pivotViewSql(objectId: string, fieldNames: string[]): string {
  const fieldList = fieldNames.map(f => `'${f}'`).join(', ');
  return `
    PIVOT (
      SELECT e.id, e.created_at, e.updated_at, f.name as field_name, ef.value
      FROM entries e
      JOIN entry_fields ef ON ef.entry_id = e.id
      JOIN fields f ON f.id = ef.field_id
      WHERE e.object_id = '${objectId}'
    ) ON field_name IN (${fieldList}) USING first(value)
  `;
}
```

### Package Configuration (`package.json`)

```json
{
  "name": "@tinycloud/node-sdk-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test",
    "test:sql": "bun test sql/",
    "test:duckdb": "bun test duckdb/",
    "test:ci": "TC_TEST_SERVER=https://node.tinycloud.xyz bun test"
  },
  "dependencies": {
    "@tinycloud/node-sdk": "workspace:*",
    "@tinycloud/sdk-services": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

---

## Test Categories

### 1. Auth Prerequisite (`setup.ts` — beforeAll)

Minimal auth validation to ensure the test harness works before running database tests.

```
beforeAll (shared across all test files)
  ✓ server is reachable at configured URL
  ✓ signIn completes without error
  ✓ client has valid spaceId after signIn
  ✓ client.sql is accessible (ISQLService)
  ✓ client.duckdb is accessible (IDuckDbService)
```

If any of these fail, all tests skip with a clear error message.

---

### 2. SQL Service Tests

#### 2.1 Query (`sql/sql-query.test.ts`)

**Database**: `test-sql-query`

```
describe('SQL query')
  beforeAll
    - Create test table via execute:
      CREATE TABLE contacts (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT,
        age INTEGER,
        score REAL,
        active BOOLEAN,
        created_at TEXT
      )
    - Insert 10 sample rows

  describe('basic SELECT')
    ✓ SELECT * returns all rows with correct column names
    ✓ SELECT with WHERE clause filters correctly
    ✓ SELECT with ORDER BY returns sorted results
    ✓ SELECT with LIMIT returns correct count
    ✓ SELECT COUNT(*) returns aggregate
    ✓ response has columns, rows, rowCount fields

  describe('parameterized queries')
    ✓ SELECT with ? placeholder and string param
    ✓ SELECT with ? placeholder and integer param
    ✓ SELECT with multiple params
    ✓ SELECT with NULL param

  describe('type handling')
    ✓ INTEGER values round-trip correctly
    ✓ REAL values round-trip correctly
    ✓ TEXT values round-trip correctly
    ✓ BOOLEAN values round-trip correctly
    ✓ NULL values round-trip correctly

  describe('joins')
    ✓ SELECT with INNER JOIN returns joined rows
    ✓ SELECT with LEFT JOIN includes nulls

  describe('error cases')
    ✓ invalid SQL returns error result (not throw)
    ✓ referencing nonexistent table returns error
    ✓ result.ok is false with error.code set

  afterAll
    - DROP TABLE contacts, related tables
```

#### 2.2 Execute (`sql/sql-execute.test.ts`)

**Database**: `test-sql-execute`

```
describe('SQL execute')
  describe('DDL')
    ✓ CREATE TABLE succeeds, returns changes: 0
    ✓ CREATE TABLE IF NOT EXISTS is idempotent
    ✓ ALTER TABLE ADD COLUMN succeeds

  describe('INSERT')
    ✓ INSERT single row returns changes: 1
    ✓ INSERT with params binds correctly
    ✓ INSERT multiple rows returns correct changes count
    ✓ response has changes and lastInsertRowId fields

  describe('UPDATE')
    ✓ UPDATE matching rows returns correct changes count
    ✓ UPDATE with WHERE clause restricts scope
    ✓ UPDATE zero rows returns changes: 0

  describe('DELETE')
    ✓ DELETE with WHERE returns correct changes count
    ✓ DELETE all rows returns total count

  describe('schema option')
    ✓ execute with schema: [...] creates table before INSERT
    ✓ schema is idempotent (IF NOT EXISTS)

  afterAll
    - Clean up test tables
```

#### 2.3 Batch (`sql/sql-batch.test.ts`)

**Database**: `test-sql-batch`

```
describe('SQL batch')
  ✓ batch executes multiple statements sequentially
  ✓ batch returns results array with per-statement changes
  ✓ batch with mixed DDL and DML works
  ✓ batch with params on individual statements

  afterAll
    - Clean up test tables
```

#### 2.4 Export (`sql/sql-export.test.ts`)

**Database**: `test-sql-export`

```
describe('SQL export')
  beforeAll
    - Create table and insert data

  ✓ export returns a Blob
  ✓ exported Blob is non-empty
  ✓ exported Blob starts with SQLite magic bytes (53 51 4c 69)

  afterAll
    - Clean up
```

---

### 3. DuckDB Service Tests

#### 3.1 Query (`duckdb/duckdb-query.test.ts`)

**Database**: `test-duckdb-query`

```
describe('DuckDB query')
  beforeAll
    - Create test tables and insert data via execute/batch

  describe('basic SELECT')
    ✓ SELECT * returns all rows
    ✓ SELECT with WHERE clause filters correctly
    ✓ SELECT with ORDER BY returns sorted results
    ✓ SELECT with LIMIT/OFFSET paginates correctly
    ✓ SELECT COUNT(*), SUM(), AVG() returns aggregates
    ✓ response has columns, rows, rowCount fields
    ✓ column names in response match SELECT clause

  describe('parameterized queries')
    ✓ query with params array binds positional params
    ✓ query with string param
    ✓ query with integer param
    ✓ query with NULL param

  describe('DuckDB type handling')
    ✓ INTEGER values round-trip
    ✓ BIGINT values round-trip (no truncation for values < i64::MAX)
    ✓ DOUBLE values round-trip
    ✓ VARCHAR values round-trip
    ✓ BOOLEAN values round-trip
    ✓ TIMESTAMP values round-trip
    ✓ NULL values round-trip
    ✓ JSON values round-trip (as string)
    ✓ HUGEINT returns without truncation

  describe('joins and subqueries')
    ✓ JOIN between tables returns combined rows
    ✓ subquery in WHERE clause works
    ✓ CTE (WITH clause) works

  describe('window functions')
    ✓ ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)
    ✓ SUM() OVER (ORDER BY ... ROWS BETWEEN ...)
    ✓ RANK() / DENSE_RANK()

  describe('GROUP BY')
    ✓ GROUP BY with HAVING clause
    ✓ GROUP BY with multiple columns
    ✓ GROUP BY ROLLUP

  describe('date/time functions')
    ✓ CURRENT_TIMESTAMP works
    ✓ date_trunc, date_part functions
    ✓ date range filtering with BETWEEN

  describe('error cases')
    ✓ invalid SQL returns error result (ok: false)
    ✓ syntax error includes useful message
    ✓ nonexistent table returns error
    ✓ does NOT throw — returns Result

  afterAll
    - DROP test tables
```

#### 3.2 Execute (`duckdb/duckdb-execute.test.ts`)

**Database**: `test-duckdb-execute`

```
describe('DuckDB execute')
  describe('DDL')
    ✓ CREATE TABLE succeeds
    ✓ CREATE TABLE IF NOT EXISTS is idempotent
    ✓ CREATE VIEW succeeds
    ✓ CREATE INDEX succeeds
    ✓ ALTER TABLE ADD COLUMN succeeds
    ✓ DROP TABLE succeeds
    ✓ DROP VIEW succeeds

  describe('INSERT')
    ✓ INSERT single row returns changes: 1
    ✓ INSERT with params
    ✓ INSERT INTO ... SELECT from another table
    ✓ response has changes field (no lastInsertRowId — DuckDB doesn't support it)

  describe('UPDATE')
    ✓ UPDATE returns correct changes count
    ✓ UPDATE with parameterized WHERE clause

  describe('DELETE')
    ✓ DELETE with WHERE returns correct changes count

  describe('schema initialization')
    ✓ execute with schema option creates table before INSERT
    ✓ schema is idempotent on subsequent calls

  describe('transactions')
    ✓ BEGIN + statements + COMMIT via sequential executes
    ✓ BEGIN + statements + ROLLBACK discards changes

  afterAll
    - Clean up test tables
```

#### 3.3 Batch (`duckdb/duckdb-batch.test.ts`)

**Database**: `test-duckdb-batch`

```
describe('DuckDB batch')
  ✓ batch with DDL + DML executes in order
  ✓ batch returns results array with per-statement changes
  ✓ batch with transactional: true rolls back on failure
  ✓ batch with transactional: false continues past failures
  ✓ batch with params on individual statements

  afterAll
    - Clean up
```

#### 3.4 Describe (`duckdb/duckdb-describe.test.ts`)

**Database**: `test-duckdb-describe`

```
describe('DuckDB describe')
  beforeAll
    - Create tables and views

  describe('tables')
    ✓ describe returns SchemaInfo with tables array
    ✓ each table has name and columns
    ✓ columns have name, type, nullable fields
    ✓ column type is string (e.g., "INTEGER", "VARCHAR")
    ✓ nullable is boolean (not string)
    ✓ field names are "type" and "nullable" (not "dataType" / "isNullable")

  describe('views')
    ✓ describe returns views array
    ✓ each view has name and sql

  describe('after schema change')
    ✓ adding a column is reflected in next describe
    ✓ dropping a table removes it from describe

  afterAll
    - Clean up
```

#### 3.5 PIVOT Queries (`duckdb/duckdb-pivot.test.ts`)

**Database**: `test-duckdb-pivot`

This is the critical EAV path — data denormalized via PIVOT.

```
describe('DuckDB PIVOT (EAV CRM pattern)')
  beforeAll
    - Create full EAV schema (objects, fields, entries, entry_fields)
    - Seed with people object: fields [Full Name, Email, Phone, Status]
    - Seed with 10 entry rows, each with 4 entry_field values
    - Seed with task object: fields [Title, Status, Priority, Due Date]
    - Seed with 5 task entries

  describe('basic PIVOT')
    ✓ PIVOT query denormalizes EAV to flat rows
    ✓ result columns match field names from PIVOT IN clause
    ✓ result row count matches entry count
    ✓ NULL fields produce NULL in pivoted output

  describe('PIVOT as view')
    ✓ CREATE VIEW v_people AS (PIVOT ...) succeeds
    ✓ SELECT * FROM v_people returns denormalized rows
    ✓ SELECT with WHERE on pivoted column filters correctly
    ✓ SELECT with ORDER BY on pivoted column sorts correctly

  describe('analytics on pivoted data')
    ✓ COUNT(*) with GROUP BY on Status field
    ✓ filtering with LIKE on pivoted text column
    ✓ date range filter on pivoted date column
    ✓ CTE wrapping PIVOT for filter injection (EAV pattern):
      WITH __report_data AS (SELECT * FROM v_people)
      SELECT * FROM __report_data WHERE "Status" = 'Active'

  describe('UNPIVOT')
    ✓ UNPIVOT query converts wide table back to EAV format

  afterAll
    - DROP all test tables and views
```

#### 3.6 Export & Import (`duckdb/duckdb-export-import.test.ts`)

**Database**: `test-duckdb-export` (export), `test-duckdb-import` (import)

```
describe('DuckDB export')
  beforeAll
    - Create table and insert data

  ✓ export returns a Blob
  ✓ exported Blob is non-empty
  ✓ export after INSERT includes the new data

describe('DuckDB import')
  ✓ import accepts Uint8Array of valid DuckDB file
  ✓ after import, query returns expected data
  ✓ import with invalid data returns error (not crash)
  ✓ import replaces existing database content

describe('round-trip')
  ✓ export from db A, import into db B, query B matches A

  afterAll
    - Clean up both databases
```

#### 3.7 Security Enforcement (`duckdb/duckdb-security.test.ts`)

**Database**: `test-duckdb-security`

Validates the allowlist and security boundaries from the server side.

```
describe('DuckDB security (allowlist enforcement)')
  describe('blocked statements (non-admin)')
    ✓ COPY TO returns permission error
    ✓ INSTALL extension returns permission error
    ✓ LOAD extension returns permission error
    ✓ ATTACH database returns permission error
    ✓ CREATE MACRO returns permission error

  describe('blocked functions')
    ✓ read_csv() in SELECT returns error
    ✓ parquet_scan() in SELECT returns error
    ✓ read_parquet() returns error

  describe('SET restrictions')
    ✓ SET enable_external_access = true returns error
    ✓ SET allow_unsigned_extensions = true returns error
    ✓ SET non-security variable returns error for non-admin

  describe('allowed operations')
    ✓ SELECT works
    ✓ INSERT works (with write ability)
    ✓ CREATE TABLE works (with write ability)
    ✓ BEGIN / COMMIT / ROLLBACK work
    ✓ EXPLAIN SELECT works

  afterAll
    - Clean up
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TC_TEST_SERVER` | `http://localhost:8000` | tinycloud-node server URL |
| `TC_TEST_PRIVATE_KEY` | Hardhat account #0 | Ethereum private key for test user |

---

## Running Tests

```bash
# Prerequisites: build WASM + SDK
cd js-sdk && bun run build

# Start local server (separate terminal)
cd tinycloud-node && cargo run

# Run all database tests
cd js-sdk/tests/node-sdk && bun test

# Run just SQL tests
bun test sql/

# Run just DuckDB tests
bun test duckdb/

# Run just PIVOT tests
bun test duckdb/duckdb-pivot.test.ts

# Run against remote server (CI)
TC_TEST_SERVER=https://node.tinycloud.xyz bun test
```

---

## Success Criteria

1. All SQL query/execute/batch/export round-trips pass
2. All DuckDB query/execute/batch/describe/export/import round-trips pass
3. PIVOT queries work end-to-end (EAV critical path)
4. Security boundaries enforced (blocked statements return errors)
5. Wire format correct: ColumnInfo uses `type`/`nullable`, ExecuteResponse has `changes` (no `lastInsertRowId` for DuckDB)
6. No `as any` in test code — proper type checking
7. Tests clean up after themselves (no orphaned tables across runs)
8. Tests run in < 60 seconds against local server
9. Clear error message when server is not reachable

---

## Implementation Order

1. **Wire DuckDbService into TinyCloudNode** (prerequisite)
2. **setup.ts + fixtures/** (test infrastructure)
3. **sql/sql-query.test.ts** (simplest, validates harness works)
4. **sql/sql-execute.test.ts** + **sql-batch.test.ts** + **sql-export.test.ts**
5. **duckdb/duckdb-query.test.ts** (validates DuckDB wire format)
6. **duckdb/duckdb-execute.test.ts** + **duckdb-batch.test.ts**
7. **duckdb/duckdb-describe.test.ts** (validates ColumnInfo serde fix)
8. **duckdb/duckdb-pivot.test.ts** (EAV critical path)
9. **duckdb/duckdb-export-import.test.ts**
10. **duckdb/duckdb-security.test.ts** (validates allowlist)

---

## Out of Scope

- **Arrow IPC parsing**: The application doesn't use Arrow format. Arrow response path is tested in Rust unit tests. Defer SDK-side Arrow parsing tests until an app needs it.
- **Delegation-scoped DuckDB**: Testing caveats (table/column restrictions) on DuckDB via delegated access. Important but requires delegation test infrastructure first.
- **Concurrent access**: Multiple clients writing to the same DuckDB simultaneously. Actor model handles this server-side; test separately.
- **Performance benchmarks**: No latency or throughput targets in this spec.
- **KV service tests**: Separate concern, separate spec.
