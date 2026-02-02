# Spec: Adding Zod Runtime Validation to web-sdk

**Status:** Draft
**Author:** Claude (with user input)
**Date:** 2026-02-02
**Breaking Change:** Yes (semver major bump required)

## Overview

Add Zod for runtime validation across the web-sdk packages to catch data corruption, malformed API responses, and invalid user input at runtime rather than relying solely on TypeScript compile-time checks.

## Problem Statement

The current codebase has no runtime validation. All validation is done through:
- Manual `typeof`/`instanceof` checks (inconsistent, verbose)
- Type casting after `JSON.parse()` (unsafe, silent failures)
- Regex matching for URIs (fragile, no error context)
- Silent fallbacks on parse errors (masks bugs)

This has caused real bugs:
- Session data corruption goes undetected until later failures
- Sharing links with malformed data cause cryptic errors
- API response changes break clients silently

## Solution

Adopt Zod as the runtime validation library with the following approach:

### Core Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Schema strategy | **Zod as source of truth** | Derive TS types via `z.infer<>`, eliminates duplication |
| Error handling | **Result pattern everywhere** | Wrap all validation in `Result<T, ValidationError>` |
| Bundle size | **Zod is acceptable** | ~12KB min+gzip is worth the safety benefits |
| Strictness | **Strict, no backwards compat** | Invalid data = error. Clean slate approach. |
| Schema location | **Co-located with types** | `types.ts` → `types.schema.ts` next to each other |
| WASM boundary | **Debug-only validation** | Validate in dev builds, skip in prod (Rust already validates) |
| Date handling | **Keep as strings internally** | Store ISO strings, parse to Date only at usage points |
| Performance | **Validate at entry points only** | One-time cost per operation, trust data internally after |
| Testing | **Schema unit tests + existing integration** | Test schemas independently, rely on integration tests for flow |
| Format validation | **Defer to existing parsers** | Use `z.string()` then call `parseSpaceUri()` etc. |
| Schema export | **JSON Schema via zod-to-json-schema** | Enable documentation and external tool integration |

### Breaking Change Strategy

This is a **semver major bump** (e.g., 1.x → 2.0.0):
- Old sharing links may fail validation
- Corrupted session data will error instead of silently degrading
- API response changes will surface as validation errors

## Implementation Plan

### Phase 1: Foundation (node-sdk first)

Start with node-sdk as it's lower risk (server-side, can iterate before web bundle).

**First domain: Delegations/sharing** (recent bugs here, high value)

1. Add Zod dependency to node-sdk
2. Create `src/delegations/types.schema.ts`:
   ```typescript
   import { z } from "zod";

   export const DelegationSchema = z.object({
     cid: z.string(),
     delegateDID: z.string(),
     delegatorDID: z.string().optional(),
     spaceId: z.string(),
     path: z.string(),
     actions: z.array(z.string()),
     expiry: z.string().datetime(), // ISO string, not Date
     isRevoked: z.boolean(),
     createdAt: z.string().datetime().optional(),
     parentCid: z.string().optional(),
     authHeader: z.string().optional(),
     allowSubDelegation: z.boolean().optional(),
   });

   export type Delegation = z.infer<typeof DelegationSchema>;
   ```

3. Create validation wrapper:
   ```typescript
   import { Result } from "@tinycloudlabs/sdk-core";

   export function validateDelegation(data: unknown): Result<Delegation, ValidationError> {
     const result = DelegationSchema.safeParse(data);
     if (!result.success) {
       return {
         ok: false,
         error: {
           code: "VALIDATION_ERROR",
           message: result.error.message,
           service: "delegation",
           meta: { issues: result.error.issues }
         }
       };
     }
     return { ok: true, data: result.data };
   }
   ```

4. Apply to `receiveShare()` and `useDelegation()` entry points

### Phase 2: Expand to sdk-core

Migrate shared types used across packages:

- `PersistedSessionData` schema
- `EncodedShareData` schema
- `JWK` schema
- `ServiceSession` schema
- Configuration schemas (partial validation, lenient for optional fields)

### Phase 3: sdk-services

- API response schemas for `/invoke`, `/delegate` endpoints
- `KVService` response parsing
- `SpaceService` delegation list responses

### Phase 4: web-sdk

- Browser-specific schemas
- Storage value validation (Blob/String/Object discrimination)
- Configuration validation

### Phase 5: Polish

- Add `zod-to-json-schema` for documentation export
- Add debug-only WASM output validation
- Performance audit of validation overhead

## File Structure

```
packages/
├── sdk-core/
│   └── src/
│       ├── delegations/
│       │   ├── types.ts          # Re-export from schema
│       │   └── types.schema.ts   # Zod schemas, source of truth
│       ├── storage.ts
│       └── storage.schema.ts
├── node-sdk/
│   └── src/
│       ├── delegation.ts
│       └── delegation.schema.ts
└── sdk-services/
    └── src/
        └── kv/
            ├── types.ts
            └── types.schema.ts
```

## Validation Error Type

```typescript
export interface ValidationError {
  code: "VALIDATION_ERROR";
  message: string;
  service: string;
  cause?: Error;
  meta?: {
    issues: z.ZodIssue[];
    path?: string;
  };
}
```

## Testing Strategy

1. **Schema unit tests**: Test each schema with valid/invalid inputs
   ```typescript
   describe("DelegationSchema", () => {
     it("accepts valid delegation", () => {
       const result = DelegationSchema.safeParse(validDelegation);
       expect(result.success).toBe(true);
     });

     it("rejects missing required fields", () => {
       const result = DelegationSchema.safeParse({});
       expect(result.success).toBe(false);
       expect(result.error.issues).toContainEqual(
         expect.objectContaining({ path: ["cid"] })
       );
     });
   });
   ```

2. **Integration tests**: Existing tests catch regressions in flows

3. **Error message snapshots**: Optional, for catching unintended error format changes

## Success Criteria

- [ ] All `JSON.parse()` calls wrapped with schema validation
- [ ] All API response parsing uses schemas
- [ ] No `as T` type casts for external data
- [ ] Validation errors include actionable context (field path, expected type)
- [ ] Bundle size increase < 15KB
- [ ] No performance regression in hot paths (< 5ms overhead per operation)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Bundle size bloat | Monitor with bundlewatch, tree-shake unused validators |
| Migration breaks existing users | Semver major bump, clear changelog |
| Schema drift from actual API | Generate schemas from OpenAPI spec if available |
| Performance overhead | Validate at entry points only, not on every access |

## Dependencies

- `zod` (^3.22.0) - Core validation library
- `zod-to-json-schema` (^3.22.0) - Optional, for documentation export

## Timeline

Not estimated. Work is tracked via Linear epic with sub-tasks per domain/package.

## References

- [Zod Documentation](https://zod.dev)
- [zod-to-json-schema](https://github.com/StefanTerdell/zod-to-json-schema)
- Existing Result pattern in `@tinycloudlabs/sdk-services/types.ts`
