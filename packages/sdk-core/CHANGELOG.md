# @tinycloudlabs/sdk-core

## 0.2.0

### Minor Changes

- a2b4b66: Create sdk-core package with shared interfaces and TinyCloud class

  - ISigner: Platform-agnostic signer interface
  - ISessionStorage: Session persistence abstraction
  - IUserAuthorization: Main authorization interface
  - ITinyCloudStorage: Storage operations interface
  - TinyCloud: Unified SDK class that accepts IUserAuthorization

  This package enables code sharing between web-sdk and node-sdk while
  allowing platform-specific implementations for signing and session storage.

### Patch Changes

- @tinycloudlabs/web-core@0.3.1
