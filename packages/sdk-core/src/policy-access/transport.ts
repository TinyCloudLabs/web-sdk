import { PolicyAccessError } from "./errors";

export interface PolicyAccessHttpRequest {
  readonly method: "POST" | "GET";
  readonly url: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: unknown;
}

export interface PolicyAccessHttpResponse {
  readonly status: number;
  readonly body: unknown;
  /** Non-redirected final URL, so callers can detect an interposed hop. */
  readonly finalUrl: string;
}

export interface PolicyAccessTransport {
  request(
    request: PolicyAccessHttpRequest,
  ): Promise<PolicyAccessHttpResponse>;
}

/**
 * Origins a policy-access flow is ever allowed to contact.
 *
 * A browser cannot pin resolved IP addresses the way a server-side requester
 * can, so the browser profile pins **origins** instead and refuses anything
 * else. The allowlist is built from the caller's own trusted configuration —
 * never from bytes that arrived in the invitation.
 */
export interface PolicyAccessOriginPolicy {
  readonly allowedOrigins: readonly string[];
  /**
   * Path prefixes this flow must never request. TinyCloud Node is a generic
   * capability/storage enforcer in this architecture, so Share-specific node
   * routes are a hard boundary violation rather than a fallback.
   */
  readonly forbiddenPathPrefixes?: readonly string[];
}

export const DEFAULT_FORBIDDEN_PATH_PREFIXES: readonly string[] = [
  "/share/",
];

export interface CreateFetchPolicyAccessTransportOptions {
  readonly fetchFn?: typeof fetch;
  readonly originPolicy: PolicyAccessOriginPolicy;
  /**
   * Records every request for boundary assertions. Tests and production
   * traces use this to prove there were zero `/share/*` and zero identity
   * -provider calls in the successful flow.
   */
  readonly onRequest?: (entry: {
    readonly method: string;
    readonly url: string;
  }) => void;
}

function normalizeOrigin(value: string): string {
  return new URL(value).origin;
}

/**
 * A browser-safe transport for the policy-access flow: no redirects, no
 * credentials, no cookies, and a hard origin allowlist.
 */
export function createFetchPolicyAccessTransport(
  options: CreateFetchPolicyAccessTransportOptions,
): PolicyAccessTransport {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  if (typeof fetchFn !== "function") {
    throw new PolicyAccessError(
      "access-descriptor-invalid",
      "no fetch implementation is available",
    );
  }
  const allowed = new Set(
    options.originPolicy.allowedOrigins.map(normalizeOrigin),
  );
  const forbidden =
    options.originPolicy.forbiddenPathPrefixes ??
    DEFAULT_FORBIDDEN_PATH_PREFIXES;

  return {
    async request(request) {
      const url = new URL(request.url);
      if (!allowed.has(url.origin)) {
        throw new PolicyAccessError(
          "origin-not-allowed",
          `policy-access refused an egress to an unpinned origin: ${url.origin}`,
        );
      }
      for (const prefix of forbidden) {
        if (url.pathname.startsWith(prefix)) {
          throw new PolicyAccessError(
            "origin-not-allowed",
            `policy-access refused a forbidden path: ${url.pathname}`,
          );
        }
      }
      options.onRequest?.({ method: request.method, url: request.url });
      let response: Response;
      try {
        response = await fetchFn(url, {
          method: request.method,
          redirect: "error",
          credentials: "omit",
          headers: {
            accept: "application/json",
            ...(request.body === undefined
              ? {}
              : { "content-type": "application/json" }),
            ...(request.headers ?? {}),
          },
          ...(request.body === undefined
            ? {}
            : { body: JSON.stringify(request.body) }),
        });
      } catch (error) {
        throw new PolicyAccessError(
          "node-unreachable",
          `request to ${url.origin}${url.pathname} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      const text = await response.text();
      let body: unknown = undefined;
      if (text.length > 0) {
        try {
          body = JSON.parse(text);
        } catch {
          body = text;
        }
      }
      return { status: response.status, body, finalUrl: response.url || request.url };
    },
  };
}
