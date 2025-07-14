import init from "../pkg/tinycloud_web_sdk_rs.js";
import { getWasmBinary } from "./wasm-loader.js";
import * as lib from "../pkg/tinycloud_web_sdk_rs.js";

// Initialize WASM using chunked loader
export const initialized: Promise<void> = getWasmBinary()
  .then(wasmBinary => init(wasmBinary))
  .then(() => lib.initPanicHook());

export namespace tcwSession {
  export import TCWSessionManager = lib.TCWSessionManager;
  export import SiweConfig = lib.SiweConfig;
  export import ExtraFields = lib.ExtraFields;
}

export namespace tinycloud {
  export import completeSessionSetup = lib.completeSessionSetup;
  export import generateHostSIWEMessage = lib.generateHostSIWEMessage;
  export import siweToDelegationHeaders = lib.siweToDelegationHeaders;
  export import invoke = lib.invoke;
  export import makeOrbitId = lib.makeOrbitId;
  export import prepareSession = lib.prepareSession;
  export import Session = lib.Session;
  export import SessionConfig = lib.SessionConfig;
  export import HostConfig = lib.HostConfig;
}
