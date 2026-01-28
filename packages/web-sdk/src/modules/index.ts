export * from "./UserAuthorization";
export * from "./Storage";
export * from "./tcw";
export { TinyCloudWeb } from "./tcw";

// Re-export new auth module types for convenience
export {
  WebUserAuthorization,
  WebUserAuthorizationConfig,
  WebSignStrategy,
  WalletPopupStrategy,
  defaultWebSignStrategy,
  ModalSpaceCreationHandler,
  defaultWebSpaceCreationHandler,
} from "../authorization";
