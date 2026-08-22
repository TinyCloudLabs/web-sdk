/** Fragment-only adapter for TinyCloud's public SharingService. */
export const NATIVE_SHARE_FRAGMENT_PARAMETER = "tc1";

export interface NativeSharingService {
  generate(params: { readonly path: string; readonly actions: string[]; readonly expiry: Date }): Promise<{ readonly ok: true; readonly data: { readonly token: string } } | { readonly ok: false; readonly error: { readonly message: string } }>;
  receive(token: string, options: { readonly autoSubdelegate: false; readonly useSessionKey: false }): Promise<unknown>;
}

function canonicalViewerUrl(viewerOrigin: string): URL {
  const url = new URL(viewerOrigin);
  if (url.protocol !== "https:" || url.origin !== viewerOrigin || url.pathname !== "/" || url.search || url.hash) throw new TypeError("viewer origin must be a canonical HTTPS origin");
  return url;
}

/** Generate exactly one read-only TinyCloud delegation and put its tc1 token in the fragment. */
export async function createNativeShare(sharing: NativeSharingService, input: { readonly path: string; readonly expiresAt: Date; readonly viewerOrigin: string }): Promise<string> {
  if (!input.path || input.path.startsWith("/") || input.path.endsWith("/") || input.path.includes("..") || input.path.includes("//")) throw new TypeError("native share path must be one canonical TinyCloud KV key");
  const generated = await sharing.generate({ path: input.path, actions: ["tinycloud.kv/get"], expiry: input.expiresAt });
  if (!generated.ok) throw new Error(generated.error.message);
  const url = canonicalViewerUrl(input.viewerOrigin);
  url.hash = `${NATIVE_SHARE_FRAGMENT_PARAMETER}=${encodeURIComponent(generated.data.token)}`;
  return url.toString();
}

/** Extract only a single tc1 fragment. Path/query/mixed legacy forms are refused. */
export function parseNativeShareUrl(value: string): string {
  const url = new URL(value);
  if (url.search || url.pathname !== "/") throw new TypeError("native shares must carry tc1 only in the URL fragment");
  const fragment = new URLSearchParams(url.hash.slice(1));
  const token = fragment.get(NATIVE_SHARE_FRAGMENT_PARAMETER);
  if (!token || fragment.size !== 1 || !token.startsWith("tc1:")) throw new TypeError("missing native share fragment");
  return token;
}

/** Receive through the public SDK without creating another transport protocol. */
export async function openNativeShare(sharing: NativeSharingService, link: string): Promise<unknown> {
  return sharing.receive(parseNativeShareUrl(link), { autoSubdelegate: false, useSessionKey: false });
}
