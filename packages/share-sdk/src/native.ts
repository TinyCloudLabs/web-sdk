import { fromBase64Url, toBase64Url } from "@tinycloud/share-envelope";

/** The fragment-only link format for the TinyCloud-native bearer slice. */
export const NATIVE_SHARE_FRAGMENT_PARAMETER = "tc-share";

export interface NativeShareOwner {
  readonly kv: {
    put(path: string, value: Uint8Array): Promise<{ readonly ok: boolean }>;
  };
  createDelegation(params: {
    readonly path: string;
    readonly actions: string[];
    readonly delegateDID: string;
    readonly expiryMs: number;
    readonly disableSubDelegation: boolean;
    readonly includePublicSpace: boolean;
  }): Promise<unknown>;
}

export interface NativeShareRecipient {
  readonly did: string;
  /** Private receiver key material. Keep it in the URL fragment only. */
  exportSessionKey(): object;
  useDelegation(delegation: unknown): Promise<{
    readonly kv: { get(path: string): Promise<{ readonly ok: boolean; readonly data?: { readonly data: unknown } }> };
  }>;
}

export interface NativeShareLink {
  readonly version: 1;
  readonly delegation: unknown;
  readonly recipientSessionKey: object;
}

function assertPath(path: string): void {
  if (!path || path.startsWith("/") || path.endsWith("/") || path.includes("..") || path.includes("//")) {
    throw new TypeError("native share path must be one canonical TinyCloud KV key");
  }
}

function encodePayload(link: NativeShareLink): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(link)));
}

/**
 * Store bytes at the owner's node, then issue one bounded ordinary delegation
 * to a session-only recipient key. No Share API or registry is contacted.
 */
export async function createNativeShare(
  owner: NativeShareOwner,
  recipient: NativeShareRecipient,
  input: { readonly path: string; readonly bytes: Uint8Array; readonly expiresInMs: number },
): Promise<NativeShareLink> {
  assertPath(input.path);
  if (!Number.isSafeInteger(input.expiresInMs) || input.expiresInMs <= 0) {
    throw new TypeError("native share expiry must be a positive millisecond duration");
  }
  const written = await owner.kv.put(input.path, input.bytes.slice());
  if (!written.ok) throw new Error("owner node rejected the shared bytes");
  const delegation = await owner.createDelegation({
    path: input.path,
    actions: ["tinycloud.kv/get"],
    delegateDID: recipient.did,
    expiryMs: input.expiresInMs,
    disableSubDelegation: true,
    includePublicSpace: false,
  });
  return { version: 1, delegation, recipientSessionKey: recipient.exportSessionKey() };
}

/** Compose a viewer URL without ever putting the receiver key on the wire. */
export function nativeShareUrl(viewerOrigin: string, link: NativeShareLink): string {
  const url = new URL(viewerOrigin);
  if (url.origin !== viewerOrigin || url.protocol !== "https:") {
    throw new TypeError("viewer origin must be a canonical HTTPS origin");
  }
  url.hash = `${NATIVE_SHARE_FRAGMENT_PARAMETER}=${encodePayload(link)}`;
  return url.toString();
}

/** Parse the fragment-only share payload. Servers only receive the URL before '#'. */
export function parseNativeShareUrl(value: string): NativeShareLink {
  const url = new URL(value);
  const params = new URLSearchParams(url.hash.slice(1));
  const encoded = params.get(NATIVE_SHARE_FRAGMENT_PARAMETER);
  if (!encoded || params.size !== 1) throw new TypeError("missing native share fragment");
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(encoded))); } catch { throw new TypeError("invalid native share fragment"); }
  if (!parsed || typeof parsed !== "object") throw new TypeError("invalid native share payload");
  const payload = parsed as Record<string, unknown>;
  if (payload.version !== 1 || !("delegation" in payload) || !payload.recipientSessionKey || typeof payload.recipientSessionKey !== "object") {
    throw new TypeError("invalid native share payload");
  }
  return { version: 1, delegation: payload.delegation, recipientSessionKey: payload.recipientSessionKey as object };
}

/** Read through the recipient's normal TinyCloud invocation path. */
export async function openNativeShare(
  recipient: Pick<NativeShareRecipient, "useDelegation">,
  link: NativeShareLink,
): Promise<Uint8Array> {
  const access = await recipient.useDelegation(link.delegation);
  const read = await access.kv.get("");
  if (!read.ok || !(read.data?.data instanceof Uint8Array)) {
    throw new Error("owner node denied the shared read");
  }
  return read.data.data.slice();
}
