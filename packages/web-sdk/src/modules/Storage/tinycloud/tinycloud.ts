import { startSession, activateSession } from './authenticator';
import { hostSpace, SpaceConnection } from './space';
import { WalletProvider } from './walletProvider';
import { SessionConfig } from './types';

/** Configuration for [[TinyCloud]]. */
export type TinyCloudOptions = {
  /** The TinyCloud hosts that you wish to connect to.
   *
   * Currently only a single host is supported, but for future compatibility this property is
   * expected to be a list. Only the first host in the list will be used.
   */
  hosts: string[];
};

/** An object for interacting with TinyCloud instances. */
export class TinyCloud {
  private config: TinyCloudOptions;
  private wallet: WalletProvider;

  /**
   * @param wallet The controller of the space that you wish to access.
   * @param config Optional configuration for TinyCloud.
   */
  constructor(wallet: WalletProvider, config: TinyCloudOptions) {
    this.config = {
      hosts: config.hosts,
    };
    this.wallet = wallet;
  }

  /** Make a connection to a space.
   *
   * This method handles the creation and connection to a space in TinyCloud. This method should
   * usually be used without providing any ConnectionOptions:
   * ```ts
   * let spaceConnection = await tinycloud.space();
   * ```
   * In this case the space ID will be derived from the wallet's address. The wallet will be
   * asked to sign a message delegating access to a session key for 1 hour. If the space does not
   * already exist in the TinyCloud instance, then the wallet will be asked to sign another message
   * to permit the TinyCloud instance to host the space.
   *
   * @param config Optional parameters to configure the space connection.
   * @returns Returns undefined if the TinyCloud instance was unable to host the space.
   */
  async space(
    config: Partial<SessionConfig> = {}
  ): Promise<SpaceConnection | undefined> {
    // TODO: support multiple urls for tinycloud.
    const tinycloudUrl = this.config.hosts[0];
    const sessionInfo = await startSession(this.wallet, config);

    return await activateSession(sessionInfo, tinycloudUrl)
      .catch(async ({ status, msg }) => {
        if (status === 404) {
          const { status: hostStatus, statusText } = await hostSpace(
            this.wallet,
            tinycloudUrl,
            sessionInfo.spaceId,
            config.domain
          );
          if (hostStatus === 200) {
            return await activateSession(sessionInfo, tinycloudUrl);
          } else {
            throw new Error('Failed to open new Space: ' + statusText);
          }
        } else {
          throw new Error('Failed to delegate to session key: ' + msg);
        }
      })
      .then(authn => new SpaceConnection(tinycloudUrl, authn));
  }
}

export const invoke = (
  url: string,
  params: { headers: HeadersInit; body?: Blob }
) => fetch(url + '/invoke', { method: 'POST', ...params });
