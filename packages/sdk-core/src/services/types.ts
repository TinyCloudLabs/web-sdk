/**
 * Headers type - compatible with both browser and Node.js.
 * Maps to HeadersInit in browser environments.
 *
 * @deprecated Use `ServiceHeaders` from `@tinycloudlabs/sdk-services` instead.
 */
export type ServiceHeaders = Record<string, string> | [string, string][];

/**
 * Service types supported by TinyCloud.
 * Used for factory pattern and service identification.
 *
 * @deprecated Use the service class directly with `tinycloud.getService()` instead.
 */
export enum ServiceType {
  KV = "kv",
  // Future services:
  // SQL = "sql",
  // IPFS = "ipfs",
}

/**
 * Common session type for service operations.
 * This is the minimal session interface needed for invoke operations.
 * Both TinyCloudSession and web-sdk Session can be cast to this.
 *
 * @deprecated Use `ServiceSession` from `@tinycloudlabs/sdk-services` instead.
 */
export interface ServiceSession {
  /** The delegation header containing the UCAN */
  delegationHeader: { Authorization: string };
  /** The delegation CID */
  delegationCid: string;
  /** The space ID for this session */
  spaceId: string;
  /** The verification method DID */
  verificationMethod: string;
  /** The session key JWK (required for invoke) */
  jwk: object;
}

/**
 * Invoke function signature - platform-specific implementation injected via DI.
 * Both node-sdk-wasm and web-sdk-wasm export this with identical signature.
 *
 * @deprecated Use `InvokeFunction` from `@tinycloudlabs/sdk-services` instead.
 *
 * @param session - The service session with delegation data
 * @param service - Service name (e.g., "kv")
 * @param path - Resource path or key
 * @param action - Action to perform (e.g., "tinycloud.kv/get")
 * @returns Headers to include in the request
 */
export type InvokeFunction = (
  session: ServiceSession,
  service: string,
  path: string,
  action: string
) => ServiceHeaders;

/**
 * Fetch request options - compatible with standard fetch API.
 *
 * @deprecated Use `FetchRequestInit` from `@tinycloudlabs/sdk-services` instead.
 */
export interface FetchRequestInit {
  method?: string;
  headers?: ServiceHeaders;
  body?: Blob | string;
}

/**
 * Fetch response interface - compatible with standard Response.
 *
 * @deprecated Use `FetchResponse` from `@tinycloudlabs/sdk-services` instead.
 */
export interface FetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: {
    get(name: string): string | null;
  };
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * Fetch function signature - allows for custom fetch implementations.
 * Compatible with both browser fetch and Node.js fetch.
 *
 * @deprecated Use `FetchFunction` from `@tinycloudlabs/sdk-services` instead.
 */
export type FetchFunction = (
  url: string,
  init?: FetchRequestInit
) => Promise<FetchResponse>;
