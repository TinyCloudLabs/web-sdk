/**
 * Web-sdk authorization module.
 *
 * Provides WebUserAuthorization implementing the node-sdk architecture
 * with browser-specific features like wallet popups and modal confirmations.
 *
 * @packageDocumentation
 */

export {
  WebUserAuthorization,
  WebUserAuthorizationConfig,
  WebSignStrategy,
  WalletPopupStrategy,
  defaultWebSignStrategy,
} from "./WebUserAuthorization";

export {
  ModalSpaceCreationHandler,
  defaultWebSpaceCreationHandler,
} from "./WebSpaceCreationHandler";

// Re-export sdk-core authorization types for convenience
export {
  SignStrategy,
  SignRequest,
  SignResponse,
  SignCallback,
  AutoSignStrategy,
  AutoRejectStrategy,
  CallbackStrategy,
  EventEmitterStrategy,
  defaultSignStrategy,
  ISpaceCreationHandler,
  SpaceCreationContext,
  AutoApproveSpaceCreationHandler,
  defaultSpaceCreationHandler,
} from "@tinycloudlabs/sdk-core";
