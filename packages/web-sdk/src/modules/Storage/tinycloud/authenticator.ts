import {
  completeSessionSetup,
  invoke,
  makeOrbitId,
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
      kv: { "": ["kv/put", "kv/get", "kv/list", "kv/del", "kv/metadata"] },
      capabilities: { "": ["kv/read"] },
    },
    orbitId: config?.orbitId ?? makeOrbitId(address, chainId),
    parents: config?.parents,
    jwk: config?.jwk,
  };

  const stringifiedConfig = JSON.stringify(sessionConfig);

  const preparedSessionString = prepareSession(stringifiedConfig);

  const preparedSession = JSON.parse(preparedSessionString);

  const signature = await wallet.signMessage(preparedSession.siwe);

  const sessionWithSignature = {
    ...preparedSession,
    signature,
  };

  const stringifiedSessionWithSignature = JSON.stringify(sessionWithSignature);

  const completedSessionString = await completeSessionSetup(
    stringifiedSessionWithSignature
  );

  const completedSession = JSON.parse(completedSessionString);

  return completedSession;
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
  private orbitId: string;
  private serializedSession: string;
  constructor(session: Session) {
    this.orbitId = `${session.namespace}:${session.orbitId}`;
    this.serializedSession = JSON.stringify(session);
  }

  invocationHeaders = (
    service: string,
    action: string,
    path: string
  ): HeadersInit =>
    JSON.parse(invoke(this.serializedSession, service, path, action));
  getOrbitId = (): string => this.orbitId;
}
