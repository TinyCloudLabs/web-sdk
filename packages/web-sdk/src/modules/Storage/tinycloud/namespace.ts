import { Authenticator } from './authenticator';
import { KV } from './kv';
import { generateHostSIWEMessage, siweToDelegationHeaders } from './module';
import { WalletProvider } from './walletProvider';
import { Capabilities, CapSummary } from './capabilities';
import { HostConfig } from './types';

/**
 * a connection to a namespace in a TinyCloud instance.
 *
 * This class provides methods for interacting with a namespace. Construct an instance of this class using {@link TinyCloud.namespace}.
 */
export class NamespaceConnection {
  private namespaceId: string;
  private kv: KV;
  private caps: Capabilities;

  /** @ignore */
  constructor(tinycloudUrl: string, authn: Authenticator) {
    this.namespaceId = authn.getNamespaceId();
    this.kv = new KV(tinycloudUrl, authn);
    this.caps = new Capabilities(tinycloudUrl, authn);
  }

  /** Get the id of the connected namespace.
   *
   * @returns The id of the connected namespace.
   */
  id(): string {
    return this.namespaceId;
  }

  /** Store an object in the connected namespace.
   *
   * Supports storing values that are of type string,
   * {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object | Object},
   * and values that are a {@link https://developer.mozilla.org/en-US/docs/Web/API/Blob | Blob} or Blob-like
   * (e.g. {@link https://developer.mozilla.org/en-US/docs/Web/API/File | File}).
   * ```ts
   * await namespaceConnection.put('a', 'value');
   * await namespaceConnection.put('b', {x: 10});
   *
   * let blob: Blob = new Blob(['value'], {type: 'text/plain'});
   * await namespaceConnection.put('c', blob);
   *
   * let file: File = fileList[0];
   * await namespaceConnection.put('d', file);
   * ```
   *
   * @param key The key with which the object is indexed.
   * @param value The value to be stored.
   * @param req Optional request parameters. Request Headers can be passed via the `headers` property.
   * @returns A {@link Response} without the `data` property.
   */
  async put(key: string, value: any, req?: Request): Promise<Response> {
    if (value === null || value === undefined) {
      return Promise.reject(
        `TypeError: value of type ${typeof value} cannot be stored.`
      );
    }

    const transformResponse = (response: FetchResponse) => {
      const { ok, status, statusText, headers } = response;
      return { ok, status, statusText, headers };
    };

    let blob: Blob;
    if (value instanceof Blob) {
      blob = value;
    } else if (typeof value === 'string') {
      blob = new Blob([value], { type: 'text/plain' });
    } else if (value.constructor && value.constructor.name === 'Object') {
      blob = new Blob([JSON.stringify(value)], { type: 'application/json' });
    } else {
      return Promise.reject(
        `TypeError: value of type ${typeof value} cannot be stored.`
      );
    }

    return this.kv.put(key, blob, req?.headers || {}).then(transformResponse);
  }

  /** Retrieve an object from the connected namespace.
   *
   * String and Object values, along with
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/Blob | Blobs}
   * of type `text/plain` or `application/json` are converted into their respective
   * types on retrieval:
   * ```ts
   * await namespaceConnection.put('string', 'value');
   * await namespaceConnection.put('json', {x: 10});
   *
   * let blob = new Blob(['value'], {type: 'text/plain'});
   * await namespaceConnection.put('stringBlob', blob);
   *
   * let blob = new Blob([{x: 10}], {type: 'application/json'});
   * await namespaceConnection.put('jsonBlob', blob);
   *
   * let stringData: string = await namespaceConnection.get('string').then(({ data }) => data);
   * let jsonData: {x: number} = await namespaceConnection.get('json').then(({ data }) => data);
   * let stringBlobData: string = await namespaceConnection.get('stringBlob').then(({ data }) => data);
   * let jsonBlobData: {x: number} = await namespaceConnection.get('jsonBlob').then(({ data }) => data);
   * ```
   *
   * If the object has any other MIME type then a Blob will be returned:
   * ```ts
   * let blob = new Blob([new ArrayBuffer(8)], {type: 'image/gif'});
   * await namespaceConnection.put('gif', blob);
   * let gifData: Blob = await namespaceConnection.get('gif').then(({ data }) => data);
   * ```
   *
   * Alternatively you can retrieve any object as a
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream | ReadableStream},
   * by supplying request parameters:
   * ```ts
   * let data = await namespaceConnection.get('key', {streamBody: true}).then(
   *   ({ data }: { data?: ReadableStream }) => {
   *     // consume the stream
   *   }
   * );
   * ```
   *
   * @param key The key with which the object is indexed.
   * @param req Optional request parameters.
   * @returns A {@link Response} with the `data` property (see possible types in the documentation above).
   */
  async get(key: string, req?: Request): Promise<Response> {
    const request = req || {};
    const streamBody = request.streamBody || false;

    const transformResponse = async (response: FetchResponse) => {
      const { ok, status, statusText, headers } = response;
      const type: string | null = headers.get('content-type');
      const data = !ok
        ? undefined
        : streamBody
          ? response.body
          : await // content type was not stored, let the caller decide how to handle the blob
            (!type
              ? response.blob()
              : type.startsWith('text/')
                ? response.text()
                : type === 'application/json'
                  ? response.json()
                  : response.blob());
      return { ok, status, statusText, headers, data };
    };

    return this.kv.get(key).then(transformResponse);
  }

  /** Delete an object from the connected namespace.
   *
   * @param key The key with which the object is indexed.
   * @param req Optional request parameters (unused).
   * @returns A {@link Response} without the `data` property.
   */
  async delete(key: string, req?: Request): Promise<Response> {
    const transformResponse = (response: FetchResponse) => {
      const { ok, status, statusText, headers } = response;
      return { ok, status, statusText, headers };
    };

    return this.kv.del(key).then(transformResponse);
  }

  /**
   * Delete all objects with the specified key prefix from the connected namespace.
   *
   * @param prefix Optional key prefix for filtering the objects to remove. Removes all objects if not specified.
   * @returns A Promise of an array of {@link Response} objects for each delete operation performed.
   */
  async deleteAll(prefix = ''): Promise<Response[]> {
    const kr = await this.kv.list(prefix);
    if (!kr.ok) return [kr];
    const keys: string[] = await kr.json();
    return await Promise.all(keys.map(key => this.delete(key)));
  }

  /** List objects in the connected namespace.
   *
   * The list of keys is retrieved as a list of strings:
   * ```ts
   * let keys: string[] = await namespaceConnection.list().then(({ data }) => data);
   * ```
   * Optionally, you can retrieve the list of objects as a
   * {@link https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream | ReadableStream},
   * by supplying request parameters:
   * ```ts
   * let data = await namespaceConnection.list("", {streamBody: true}).then(
   *   ({ data }: { data?: ReadableStream }) => {
   *     // consume the stream
   *   }
   * );
   * ```
   *
   * @param prefix The prefix that the returned keys should have.
   * @param req Optional request parameters.
   * @returns A {@link Response} with the `data` property as a string[].
   */
  async list(prefix = '', req?: Request): Promise<Response> {
    const request = req || {};
    const streamBody = request.streamBody || false;

    const transformResponse = async (response: FetchResponse) => {
      const { ok, status, statusText, headers } = response;
      const data = !ok
        ? undefined
        : streamBody
          ? response.body
          : await response.json();

      return { ok, status, statusText, headers, data };
    };

    return this.kv.list(prefix).then(transformResponse);
  }

  /** Retrieve metadata about an object from the connected namespace.
   *
   * @param key The key with which the object is indexed.
   * @param req Optional request parameters (unused).
   * @returns A {@link Response} without the `data` property.
   */
  async head(key: string, req?: Request): Promise<Response> {
    const transformResponse = (response: FetchResponse) => {
      const { ok, status, statusText, headers } = response;
      return { ok, status, statusText, headers };
    };

    return this.kv.head(key).then(transformResponse);
  }

  async sessions(): Promise<{ [cid: string]: CapSummary }> {
    return await this.caps.get('all');
  }
}

/** Optional request parameters.
 *
 * Not all options are applicable on every {@link NamespaceConnection} method. See the documentation
 * of each method to discover what options are supported.
 */
export type Request = {
  /** Request to receive the data as a {@link https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream | ReadableStream}. */
  streamBody?: boolean;
  /** Add additional entries to the request HTTP Headers. */
  headers?: { [key: string]: string };
};

/** Response from tinycloud requests.
 *
 * The methods on {@link NamespaceConnection} return a Response that may have `data` property. See the
 * documentation of each method to discover whether a method will return data and what type you
 * can expect.
 */
export type Response = {
  /** Whether the request was successful or not. */
  ok: boolean;
  /** The HTTP status code of the response from TinyCloud. */
  status: number;
  /** The textual representation of the HTTP status of the response from TinyCloud. */
  statusText: string;
  /** Metadata about the object and the request. */
  headers: Headers;
  /** The body of the response from TinyCloud. */
  data?: any;
};

type FetchResponse = globalThis.Response;

export const hostNamespace = async (
  wallet: WalletProvider,
  tinycloudUrl: string,
  namespaceId: string,
  domain: string = window.location.hostname
): Promise<Response> => {
  // Validate required parameters
  if (!namespaceId || typeof namespaceId !== 'string') {
    throw new Error(`TinyCloud: Invalid namespaceId: ${namespaceId}`);
  }
  if (!domain || typeof domain !== 'string') {
    throw new Error(`TinyCloud: Invalid domain: ${domain}`);
  }

  const address = await wallet.getAddress();
  const chainId = await wallet.getChainId();

  if (!address || typeof address !== 'string') {
    throw new Error(`TinyCloud: Invalid wallet address: ${address}`);
  }
  if (chainId === undefined || chainId === null) {
    throw new Error(`TinyCloud: Invalid chain ID: ${chainId}`);
  }

  const issuedAt = new Date(Date.now()).toISOString();
  const peerResponse = await fetch(
    tinycloudUrl + `/peer/generate/${encodeURIComponent(namespaceId)}`
  );

  if (!peerResponse.ok) {
    throw new Error(`TinyCloud: Failed to generate peer ID: ${peerResponse.status} ${peerResponse.statusText}`);
  }

  const peerId = await peerResponse.text();
  if (!peerId || typeof peerId !== 'string') {
    throw new Error(`TinyCloud: Invalid peer ID received: ${peerId}`);
  }

  const config: HostConfig = {
    address,
    chainId: Number(chainId),
    domain,
    issuedAt,
    namespaceId,
    peerId,
  };
  const siwe = generateHostSIWEMessage(config);
  const signature = await wallet.signMessage(siwe);
  const hostHeaders = siweToDelegationHeaders(
    { siwe, signature }
  );
  return fetch(tinycloudUrl + '/delegate', {
    method: 'POST',
    headers: hostHeaders,
  }).then(({ ok, status, statusText, headers }: FetchResponse) => ({
    ok,
    status,
    statusText,
    headers,
  }));
};
