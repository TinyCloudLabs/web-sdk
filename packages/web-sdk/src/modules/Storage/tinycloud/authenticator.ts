import {
  completeSessionSetup,
  invoke,
  makeNamespaceId,
  prepareSession,
} from "./module";
import { WalletProvider } from "./walletProvider";
import { SessionConfig, Session } from "./types";

export async function startSession(
  wallet: WalletProvider,
  config?: Partial<SessionConfig>
): Promise<Session> {
  const address = config?.address ?? (await wallet.getAddress());
  const chainId = config?.chainId ?? (await wallet.getChainId());
  const domain = config?.domain ?? window.location.hostname;

  const sessionConfig = {
    address,
    chainId,
    domain,
    issuedAt: config?.issuedAt ?? new Date(Date.now()).toISOString(),
    notBefore: config?.notBefore,
    expirationTime:
      config?.expirationTime ??
      new Date(Date.now() + 1000 * 60 * 60).toISOString(),
    actions: config?.actions ?? {
      kv: { "default/": ["tinycloud.kv/put", "tinycloud.kv/get", "tinycloud.kv/list", "tinycloud.kv/del", "tinycloud.kv/metadata"] },
      capabilities: { "all/": ["tinycloud.capabilities/read"] },
    },
    namespaceId: config?.namespaceId ?? makeNamespaceId(address, chainId, "default"),
    parents: config?.parents,
    jwk: config?.jwk,
  };

  const preparedSession = prepareSession(sessionConfig);

  const signature = await wallet.signMessage(preparedSession.siwe);

  const sessionWithSignature = {
    ...preparedSession,
    signature,
  };

  return completeSessionSetup(
    sessionWithSignature
  )
}

export async function activateSession(
  session: Session,
  url: string
): Promise<Authenticator> {
  const res = await fetch(url + "/delegate", {
    method: "POST",
    headers: session.delegationHeader,
  });

  if (res.status === 200) {
    return new Authenticator(session);
  } else {
    throw {
      status: res.status,
      msg: "Failed to delegate to session key",
    };
  }
}

export class Authenticator {
  private session: Session;
  constructor(session: Session) {
    this.session = session;
  }

  invocationHeaders = (
    service: string,
    action: string,
    path: string
  ): HeadersInit =>
    invoke(this.session, service, path, action);
  getNamespaceId = (): string => this.session.namespaceId;
}
