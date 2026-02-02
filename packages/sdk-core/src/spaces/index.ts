/**
 * Spaces Module Exports
 *
 * Provides space management functionality for TinyCloud SDK.
 *
 * @packageDocumentation
 */

// Space object
export {
  Space,
  ISpace,
  SpaceConfig,
  ISpaceScopedDelegations,
  ISpaceScopedSharing,
} from "./Space";

// SpaceService
export {
  SpaceService,
  ISpaceService,
  SpaceServiceConfig,
  SpaceErrorCodes,
  SpaceErrorCode,
  createSpaceService,
  // URI utilities
  parseSpaceUri,
  buildSpaceUri,
  // Delegation creation types
  SpaceDelegationParams,
  CreateDelegationFunction,
} from "./SpaceService";
