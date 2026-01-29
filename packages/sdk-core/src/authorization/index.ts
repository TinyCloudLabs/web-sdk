/**
 * TinyCloud SDK Authorization Module
 *
 * This module provides authorization and capability management
 * for the TinyCloud SDK.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import {
 *   CapabilityKeyRegistry,
 *   ICapabilityKeyRegistry,
 *   createCapabilityKeyRegistry,
 * } from "@tinycloudlabs/sdk-core/authorization";
 *
 * // Create a capability registry
 * const registry = createCapabilityKeyRegistry();
 *
 * // Register a session key with its delegations
 * registry.registerKey(sessionKey, [rootDelegation]);
 *
 * // Get the best key for an operation
 * const key = registry.getKeyForCapability(
 *   "tinycloud://my-space/kv/data",
 *   "tinycloud.kv/get"
 * );
 *
 * if (key) {
 *   // Use this key for the operation
 *   console.log("Using key:", key.id);
 * }
 * ```
 */

export {
  // Class
  CapabilityKeyRegistry,
  // Interface
  ICapabilityKeyRegistry,
  // Factory
  createCapabilityKeyRegistry,
  // Types
  StoredDelegationChain,
  // Error codes
  CapabilityKeyRegistryErrorCodes,
  CapabilityKeyRegistryErrorCode,
} from "./CapabilityKeyRegistry";

// SignStrategy types
export {
  // Request/Response types
  SignRequest,
  SignResponse,
  SignCallback,
  // Strategy types
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
  EventEmitterStrategy,
  SignStrategy,
  // Default
  defaultSignStrategy,
} from "./strategies";

// Space creation handler types
export {
  // Context
  SpaceCreationContext,
  // Interface
  ISpaceCreationHandler,
  // Default implementation
  AutoApproveSpaceCreationHandler,
  // Default instance
  defaultSpaceCreationHandler,
} from "./spaceCreation";
