import { startSession, activateSession } from './authenticator';
import { hostNamespace, NamespaceConnection } from './namespace';
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
   * @param wallet The controller of the namespace that you wish to access.
   * @param config Optional configuration for TinyCloud.
   */
  constructor(wallet: WalletProvider, config: TinyCloudOptions) {
    this.config = {
      hosts: config.hosts,
    };
    this.wallet = wallet;
  }

  /** Make a connection to a namespace.
   *
   * This method handles the creation and connection to a namespace in TinyCloud. This method should
   * usually be used without providing any ConnectionOptions:
   * ```ts
   * let namespaceConnection = await tinycloud.namespace();
   * ```
   * In this case the namespace ID will be derived from the wallet's address. The wallet will be
   * asked to sign a message delegating access to a session key for 1 hour. If the namespace does not
   * already exist in the TinyCloud instance, then the wallet will be asked to sign another message
   * to permit the TinyCloud instance to host the namespace.
   *
   * @param config Optional parameters to configure the namespace connection.
   * @returns Returns undefined if the TinyCloud instance was unable to host the namespace.
   */
  async namespace(
    config: Partial<SessionConfig> = {}
  ): Promise<NamespaceConnection | undefined> {
    // TODO: support multiple urls for tinycloud.
    const tinycloudUrl = this.config.hosts[0];
    const sessionInfo = await startSession(this.wallet, config);

    return await activateSession(sessionInfo, tinycloudUrl)
      .catch(async ({ status, msg }) => {
        if (status === 404) {
          const { status: hostStatus, statusText } = await hostNamespace(
            this.wallet,
            tinycloudUrl,
            sessionInfo.namespaceId,
            config.domain
          );
          if (hostStatus === 200) {
            return await activateSession(sessionInfo, tinycloudUrl);
          } else {
            throw new Error('Failed to open new Namespace: ' + statusText);
          }
        } else {
          throw new Error('Failed to delegate to session key: ' + msg);
        }
      })
      .then(authn => new NamespaceConnection(tinycloudUrl, authn));
  }
}

export const invoke = (
  url: string,
  params: { headers: HeadersInit; body?: Blob }
) => fetch(url + '/invoke', { method: 'POST', ...params });
