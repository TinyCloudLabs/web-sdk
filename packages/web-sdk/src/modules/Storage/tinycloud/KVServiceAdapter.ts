import { KVService, IKVService, ServiceSession } from "@tinycloudlabs/sdk-core";
import { invoke } from "./module";
import { Session } from "./types";

/**
 * Create a KVService instance from web-sdk Session.
 *
 * This adapter bridges the web-sdk Session type to the sdk-core KVService,
 * allowing platform-agnostic code to use the shared KV service implementation.
 *
 * @param host - The TinyCloud host URL
 * @param session - The web-sdk Session
 * @returns An IKVService instance
 *
 * @example
 * ```typescript
 * const session = await tinycloud.space();
 * const kvService = createKVService("https://tinycloud.example.com", session);
 *
 * // Use the KV service
 * await kvService.put("key", { data: "value" });
 * const result = await kvService.get("key");
 * ```
 */
export function createKVService(host: string, session: Session): IKVService {
  const serviceSession: ServiceSession = {
    delegationHeader: session.delegationHeader,
    delegationCid: session.delegationCid,
    spaceId: session.spaceId,
    verificationMethod: session.verificationMethod,
    jwk: session.jwk,
  };

  return new KVService({
    host,
    session: serviceSession,
    invoke,
  });
}
