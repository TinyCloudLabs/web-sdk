import {
  TinyCloudSession,
  KVService,
  IKVService,
  ServiceSession,
  ServiceContext,
} from "@tinycloudlabs/sdk-core";
import { invoke } from "@tinycloudlabs/node-sdk-wasm";
import { PortableDelegation } from "./delegation";

/**
 * Provides access to a space via a received delegation.
 *
 * This is returned by TinyCloudNode.useDelegation() and provides
 * KV operations on the delegated space.
 */
export class DelegatedAccess {
  private session: TinyCloudSession;
  private delegation: PortableDelegation;
  private host: string;
  private _serviceContext: ServiceContext;
  private _kv: KVService;

  constructor(
    session: TinyCloudSession,
    delegation: PortableDelegation,
    host: string
  ) {
    this.session = session;
    this.delegation = delegation;
    this.host = host;

    // Create service context
    this._serviceContext = new ServiceContext({
      invoke,
      fetch: globalThis.fetch.bind(globalThis),
      hosts: [host],
    });

    // Create and initialize KV service with path prefix from delegation
    // Strip trailing slash to avoid double-slash in paths
    const prefix = delegation.path.replace(/\/$/, '');
    this._kv = new KVService({ prefix });
    this._kv.initialize(this._serviceContext);
    this._serviceContext.registerService('kv', this._kv);

    // Set session on context
    const serviceSession: ServiceSession = {
      delegationHeader: session.delegationHeader,
      delegationCid: session.delegationCid,
      spaceId: session.spaceId,
      verificationMethod: session.verificationMethod,
      jwk: session.jwk,
    };
    this._serviceContext.setSession(serviceSession);
  }

  /**
   * The space ID this access is for.
   */
  get spaceId(): string {
    return this.delegation.spaceId;
  }

  /**
   * The path this access is scoped to.
   */
  get path(): string {
    return this.delegation.path;
  }

  /**
   * KV operations on the delegated space.
   */
  get kv(): IKVService {
    return this._kv;
  }
}
