import init from "../pkg/tinycloud_web_sdk_rs.js";
// @ts-ignore
import wasm from "../pkg/tinycloud_web_sdk_rs_bg.wasm";

import * as lib from "../pkg/tinycloud_web_sdk_rs.js";

export const initialized: Promise<void> = init(wasm()).then(() =>
  lib.initPanicHook()
);

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
  export import makeNamespaceId = lib.makeNamespaceId;
  export import prepareSession = lib.prepareSession;
  export import Session = lib.Session;
  export import SessionConfig = lib.SessionConfig;
  export import HostConfig = lib.HostConfig;
  export import ensureEip55 = lib.ensureEip55;
}
