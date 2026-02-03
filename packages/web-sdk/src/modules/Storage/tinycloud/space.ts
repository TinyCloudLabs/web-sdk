import { Authenticator } from './authenticator';
import { generateHostSIWEMessage, siweToDelegationHeaders } from './module';
import { WalletProvider } from './walletProvider';
import { Capabilities, CapSummary } from './capabilities';
import { HostConfig } from './types';

/**
 * A connection to a space in a TinyCloud instance.
 *
 * This class provides methods for interacting with a space. Construct an instance of this class using {@link TinyCloud.space}.
 */
export class SpaceConnection {
  private spaceId: string;
  private caps: Capabilities;

  /** @ignore */
  constructor(tinycloudUrl: string, authn: Authenticator) {
    this.spaceId = authn.getSpaceId();
    this.caps = new Capabilities(tinycloudUrl, authn);
  }

  /** Get the id of the connected space.
   *
   * @returns The id of the connected space.
   */
  id(): string {
    return this.spaceId;
  }

  async sessions(): Promise<{ [cid: string]: CapSummary }> {
    return await this.caps.get('all');
  }
}

/** Response from tinycloud requests.
 *
 * The methods on {@link SpaceConnection} return a Response that may have `data` property. See the
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

export const hostSpace = async (
  wallet: WalletProvider,
  tinycloudUrl: string,
  spaceId: string,
  domain: string = window.location.hostname
): Promise<Response> => {
  // Validate required parameters
  if (!spaceId || typeof spaceId !== 'string') {
    throw new Error(`TinyCloud: Invalid spaceId: ${spaceId}`);
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
    tinycloudUrl + `/peer/generate/${encodeURIComponent(spaceId)}`
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
    spaceId,
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
