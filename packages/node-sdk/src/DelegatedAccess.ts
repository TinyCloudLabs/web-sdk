import {
  TinyCloudSession,
  KVService,
  IKVService,
  ServiceSession,
} from "@tinycloudlabs/sdk-core";
import { invoke } from "@tinycloudlabs/node-sdk-wasm";
import { PortableDelegation } from "./delegation";

/**
 * Provides access to a namespace via a received delegation.
 *
 * This is returned by TinyCloudNode.useDelegation() and provides
 * KV operations on the delegated namespace.
 */
export class DelegatedAccess {
  private session: TinyCloudSession;
  private delegation: PortableDelegation;
  private host: string;
  private _kv: IKVService;

  constructor(
    session: TinyCloudSession,
    delegation: PortableDelegation,
    host: string
  ) {
    this.session = session;
    this.delegation = delegation;
    this.host = host;

    this._kv = new KVService({
      host,
      session: session as ServiceSession,
      invoke,
      pathPrefix: delegation.path,
    });
  }

  /**
   * The namespace ID this access is for.
   */
  get namespaceId(): string {
    return this.delegation.namespaceId;
  }

  /**
   * The path this access is scoped to.
   */
  get path(): string {
    return this.delegation.path;
  }

  /**
   * KV operations on the delegated namespace.
   */
  get kv(): IKVService {
    return this._kv;
  }
}
