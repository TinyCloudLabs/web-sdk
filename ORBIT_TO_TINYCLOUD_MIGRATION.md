# Orbit to TinyCloud Migration Guide

This guide documents all the changes needed to rename "Orbit" references to "TinyCloud" throughout the codebase.

## Overview
An "orbit" represents a user's namespace in the TinyCloud system. We are renaming this concept to simply "TinyCloud" to simplify the terminology and make it more intuitive for users.

**Example transformation:**
- "Failed to open new TinyCloud Orbit" → "Failed to create a new TinyCloud"
- "Create Your Orbit" → "Create Your TinyCloud"

## Migration Strategy
Change everything - both UI text AND technical names/APIs, except for external service calls that we cannot modify.

## Files to Update

### 1. User-facing UI Text Updates

#### packages/web-sdk/src/notifications/OrbitCreationModal.ts
- **Line 56**: `<h2 class="modal-title">Create Your Orbit</h2>` → `Create Your TinyCloud`
- **Line 66**: `An orbit is a zone where your signature is required...` → `A TinyCloud is a zone where your signature is required...`
- **Line 79**: `<span class="button-text">Create Orbit</span>` → `Create TinyCloud`
- **Line 374**: Comment `// Orbit creation succeeded` → `// TinyCloud creation succeeded`
- **Line 378**: `console.error('Failed to create orbit:', error);` → `Failed to create TinyCloud:`

### 2. Interface and Class Renaming

#### packages/web-sdk/src/notifications/OrbitCreationModal.ts
- **Line 1**: `OrbitCreationModalOptions` → `TinyCloudCreationModalOptions`
- **Line 2**: `onCreateOrbit: () => Promise<void>` → `onCreateTinyCloud: () => Promise<void>`
- **Line 6**: `OrbitCreationResult` → `TinyCloudCreationResult`
- **Line 11**: `TinyCloudOrbitModal` → `TinyCloudModal`
- **Line 12**: `OrbitCreationModalOptions` → `TinyCloudCreationModalOptions`
- **Line 15**: `OrbitCreationResult` → `TinyCloudCreationResult`
- **Line 16**: `Promise<OrbitCreationResult>` → `Promise<TinyCloudCreationResult>`
- **Line 18**: Constructor parameter type update
- **Line 25**: Promise generic type update
- **Line 30**: Return type update
- **Line 365**: `handleCreateOrbit` → `handleCreateTinyCloud`
- **Line 373**: `onCreateOrbit()` → `onCreateTinyCloud()`
- **Line 418**: `customElements.define('tinycloud-orbit-modal'` → `'tinycloud-modal'`

#### packages/web-sdk/src/notifications/ModalManager.ts
- **Line 1**: Import statement updates for renamed types
- **Line 5**: `TinyCloudOrbitModal` → `TinyCloudModal`
- **Line 16**: `showOrbitCreationModal` → `showTinyCloudCreationModal`
- **Line 21**: `new TinyCloudOrbitModal` → `new TinyCloudModal`
- **Line 52**: Export function rename

#### packages/web-sdk/src/notifications/index.ts
- **Line 6**: Export statement updates for renamed types
- **Line 7**: Export function rename

### 3. Internal SDK Method Names

#### packages/web-sdk/src/modules/Storage/interfaces.ts
- **Line 99**: `hostOrbit(tcwSession?: TCWClientSession): Promise<void>;` → `hostTinyCloud(...)`
- **Line 126**: Comment about automatically creating orbit → TinyCloud
- **Line 127**: Comment about manually creating orbit → TinyCloud
- **Line 131**: `autoCreateOrbit?: boolean;` → `autoCreateTinyCloud?: boolean;`

#### packages/web-core/src/core/TinyCloudDataVault.ts (search needed)
- Search for: `orbitId()`, `createOrbit()`, `hostOrbit()` methods
- Rename to: `tinyCloudId()`, `createTinyCloud()`, `hostTinyCloud()`

#### packages/web-sdk-rs/src/index.ts
- **Line 22**: `makeOrbitId` → Keep as-is if external API call, otherwise rename to `makeTinyCloudId`

### 4. Documentation Updates

#### architecture.md
- **Line 174**: `// Orbit Management` → `// TinyCloud Management`
- **Line 175**: `orbitId(): string` → `tinyCloudId(): string`
- **Line 176**: `createOrbit(name?: string): Promise<string>` → `createTinyCloud(name?: string): Promise<string>`
- **Line 267**: `makeOrbitId` → Keep as-is if external API, otherwise rename
- **Line 354**: `Orbit Management` → `TinyCloud Management`
- **Line 359**: `User Orbit` → `User TinyCloud`
- **Line 398**: `/orbit/{orbitId}/{key}` → Keep as-is if external API endpoint
- **Line 405**: Same API endpoint consideration
- **Line 571**: `Orbit Federation` → `TinyCloud Federation`

### 5. Error Messages and Logs

Search project-wide for:
- `"orbit"` in error messages, console.log statements
- `"Orbit"` in user-facing error messages
- Update to use "TinyCloud" terminology

### 6. Variable Names and Comments

Search for:
- Variable names containing `orbit` (e.g., `orbitId`, `currentOrbit`)
- Comments mentioning orbits
- Function parameters with orbit names

### 7. Test Files (if any)

Search for:
- Test descriptions mentioning "orbit"
- Mock data or fixtures with orbit references
- Test variable names

## External API Considerations

**DO NOT CHANGE** the following if they are external service calls:
- API endpoint paths like `/orbit/{orbitId}/{key}`
- Rust WASM bindings that call external services
- Any network requests to services outside this repository

## Testing After Migration

1. **Build verification**: `npm run build` (or equivalent)
2. **Type checking**: `npm run typecheck` (or equivalent)
3. **Linting**: `npm run lint` (or equivalent)
4. **Unit tests**: Run test suite to ensure no broken references
5. **Manual testing**: Test orbit/TinyCloud creation flow in browser

## Migration Checklist

- [ ] Update all user-facing text
- [ ] Rename interfaces and types
- [ ] Update class names and methods
- [ ] Update export statements
- [ ] Update import statements
- [ ] Update documentation
- [ ] Update error messages
- [ ] Search and update variable names
- [ ] Update comments
- [ ] Verify external API calls remain unchanged
- [ ] Run build and type checking
- [ ] Run tests
- [ ] Manual testing of TinyCloud creation

## Notes

- This is a breaking change for any consumers of the SDK
- Consider versioning strategy (major version bump)
- Update any external documentation or README files
- Consider deprecation warnings before full removal in gradual migration
