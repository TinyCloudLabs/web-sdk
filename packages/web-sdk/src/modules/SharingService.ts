/**
 * SharingService - Self-contained sharing with encoded links.
 *
 * This class provides a high-level API for generating and retrieving
 * self-contained sharing links. Unlike SharingLinks which relies on
 * external token lookup, SharingService bundles all necessary session
 * data directly into the encoded share string.
 *
 * The encoded share contains:
 * - path: The key to retrieve
 * - tinycloudHost: The server host
 * - session: A TinyCloud session with delegation for the shared resource
 *
 * @packageDocumentation
 */

import { initialized, tcwSession } from "@tinycloudlabs/web-sdk-wasm";
import { generateNonce, SiweMessage } from "siwe";
import { activateSession } from "./Storage/tinycloud/authenticator";
import { SpaceConnection } from "./Storage/tinycloud/space";
import {
  prepareSession,
  completeSessionSetup,
  makeSpaceId,
} from "./Storage/tinycloud/module";
import type { Session } from "./Storage/tinycloud/types";
import type { IUserAuthorization } from "./UserAuthorization";

/**
 * Error type for sharing operations.
 */
export interface SharingError {
  /** Error code for programmatic handling */
  code: string;
  /** Human-readable error message */
  message: string;
  /** Original error if wrapping another error */
  cause?: Error;
  /** Additional metadata about the error */
  meta?: Record<string, unknown>;
}

/**
 * Error codes for sharing operations.
 */
export const SharingErrorCodes = {
  /** Invalid input parameters */
  INVALID_INPUT: "INVALID_INPUT",
  /** Failed to create session key */
  KEY_GENERATION_FAILED: "KEY_GENERATION_FAILED",
  /** Failed to sign the delegation */
  SIGNING_FAILED: "SIGNING_FAILED",
  /** Failed to activate session with server */
  ACTIVATION_FAILED: "ACTIVATION_FAILED",
  /** Failed to encode/decode share data */
  ENCODING_FAILED: "ENCODING_FAILED",
  /** Failed to fetch shared data */
  FETCH_FAILED: "FETCH_FAILED",
  /** User not signed in */
  NOT_SIGNED_IN: "NOT_SIGNED_IN",
} as const;

export type SharingErrorCode =
  (typeof SharingErrorCodes)[keyof typeof SharingErrorCodes];

/**
 * Result type pattern for sharing operations.
 */
export type SharingResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SharingError };

/**
 * Parameters for generating a share.
 */
export interface SharingGenerateParams {
  /** Actions to authorize (defaults to read-only: kv/get, kv/metadata) */
  actions?: string[];
  /** When the share expires (defaults to 24 hours) */
  expiry?: Date;
  /** Optional statement for the SIWE message */
  statement?: string;
}

/**
 * Result from retrieving shared data.
 */
export interface SharingRetrieveResult<T> {
  /** The shared data */
  data: T;
  /** The path/key that was retrieved */
  path: string;
}

/**
 * The bundle of data encoded in a share string.
 */
interface ShareBundle {
  /** The key/path to retrieve */
  path: string;
  /** The TinyCloud host URL */
  tinycloudHost: string;
  /** The TinyCloud session with delegation */
  session: Session;
}

/**
 * Default actions for read-only sharing.
 */
const DEFAULT_READ_ACTIONS = ["tinycloud.kv/get", "tinycloud.kv/metadata"];

/**
 * Default expiry for shares (24 hours).
 */
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a SharingError with the given parameters.
 */
function createError(
  code: string,
  message: string,
  cause?: Error,
  meta?: Record<string, unknown>
): SharingError {
  return {
    code,
    message,
    cause,
    meta,
  };
}

/**
 * SharingService provides self-contained sharing functionality.
 *
 * Shares are encoded as base64 strings containing all the data needed
 * to retrieve the shared resource, including a delegated session.
 *
 * @example
 * ```typescript
 * import { SharingService } from "@tinycloudlabs/web-sdk";
 *
 * // After signing in with UserAuthorization
 * const sharing = new SharingService({
 *   userAuth,
 *   hosts: ["https://node.tinycloud.xyz"],
 *   sessionManager,
 * });
 *
 * // Generate a share for a key
 * const encodedShare = await sharing.generate("documents/report.json");
 *
 * // Retrieve using the encoded share (can be done by anyone with the share)
 * const result = await sharing.retrieve(encodedShare);
 * if (result.ok) {
 *   console.log("Shared data:", result.data.data);
 * }
 * ```
 */
export class SharingService {
  private userAuth: IUserAuthorization;
  private hosts: string[];
  private sessionManager: tcwSession.TCWSessionManager;

  /**
   * Creates a new SharingService instance.
   *
   * @param config - Configuration for the sharing service
   * @param config.userAuth - UserAuthorization instance for signing and address
   * @param config.hosts - TinyCloud host URLs
   * @param config.sessionManager - WASM session manager from tcwSession
   */
  constructor(config: {
    userAuth: IUserAuthorization;
    hosts: string[];
    sessionManager: tcwSession.TCWSessionManager;
  }) {
    this.userAuth = config.userAuth;
    this.hosts = config.hosts;
    this.sessionManager = config.sessionManager;
  }

  /**
   * Generates a self-contained share for a resource key.
   *
   * Creates a new delegation with a unique session key that grants
   * access to the specified resource. The delegation and all necessary
   * data are encoded into a base64 string.
   *
   * @param key - The resource key/path to share
   * @param params - Optional parameters for the share
   * @returns Base64 encoded share string
   *
   * @example
   * ```typescript
   * // Generate a read-only share (default)
   * const share = await sharing.generate("my-file.json");
   *
   * // Generate a share with custom expiry
   * const share = await sharing.generate("shared-data", {
   *   expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
   * });
   * ```
   */
  async generate(key: string, params?: SharingGenerateParams): Promise<string> {
    // Validate input
    if (!key) {
      throw new Error("Key is required for generating a share");
    }

    // Validate user is signed in
    const address = this.userAuth.address();
    const chainId = this.userAuth.chainId();
    if (!address || !chainId) {
      throw new Error("User must be signed in to generate a share");
    }

    const actions = params?.actions ?? DEFAULT_READ_ACTIONS;
    const expiry = params?.expiry ?? new Date(Date.now() + DEFAULT_EXPIRY_MS);
    const host = this.hosts[0];

    // Create a unique session key for this share
    const shareKeyId = `share-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    let keyId: string;
    try {
      keyId = this.sessionManager.createSessionKey(shareKeyId);
    } catch (err) {
      throw new Error(
        `Failed to create session key: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Get JWK and DID for the share session key
    const jwkString = this.sessionManager.jwk(keyId);
    if (!jwkString) {
      throw new Error("Failed to get JWK for session key");
    }
    const jwk = JSON.parse(jwkString);

    let delegateDID: string;
    try {
      delegateDID = this.sessionManager.getDID(keyId);
    } catch (err) {
      throw new Error(
        `Failed to get DID for session key: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Get the space ID from the current session
    const spaceId = this.userAuth.getSpaceId();
    if (!spaceId) {
      throw new Error("Space ID not available. Ensure space exists.");
    }

    // Get domain for SIWE message
    const domain =
      typeof window !== "undefined" ? window.location.hostname : "localhost";

    // Build actions object for prepareSession
    // Map the actions to the correct format: { service: { path: [actions] } }
    const actionsMap: { [service: string]: { [path: string]: string[] } } = {
      kv: { [`${key}`]: actions },
    };

    // Prepare the session with ReCap capabilities for the specific path
    const now = new Date();
    const prepared = prepareSession({
      actions: actionsMap,
      address,
      chainId,
      domain,
      issuedAt: now.toISOString(),
      expirationTime: expiry.toISOString(),
      spaceId,
      jwk,
    });

    // Sign the SIWE message
    let signature: string;
    try {
      signature = await this.userAuth.signMessage(prepared.siwe);
    } catch (err) {
      throw new Error(
        `Failed to sign share delegation: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Complete session setup
    const completedSession = completeSessionSetup({
      ...prepared,
      signature,
    });

    // Create the session object to bundle
    const session: Session = {
      delegationHeader: completedSession.delegationHeader,
      delegationCid: completedSession.delegationCid,
      jwk,
      spaceId,
      verificationMethod: delegateDID,
    };

    // Activate the session with the host to ensure it's valid
    try {
      await activateSession(session, host);
    } catch (err) {
      throw new Error(
        `Failed to activate share session: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    // Bundle and encode
    const bundle: ShareBundle = {
      path: key,
      tinycloudHost: host,
      session,
    };

    const encoded = this.encodeBundle(bundle);
    return encoded;
  }

  /**
   * Retrieves data using a self-contained encoded share.
   *
   * Decodes the share string to extract the session and path,
   * activates the session with the server, and fetches the data.
   *
   * @param encodedShare - The base64 encoded share string
   * @returns Result containing the data and path or an error
   *
   * @example
   * ```typescript
   * const result = await sharing.retrieve<{ message: string }>(encodedShare);
   * if (result.ok) {
   *   console.log("Data:", result.data.data);
   *   console.log("Path:", result.data.path);
   * } else {
   *   console.error("Error:", result.error.message);
   * }
   * ```
   */
  async retrieve<T = unknown>(
    encodedShare: string
  ): Promise<SharingResult<SharingRetrieveResult<T>>> {
    if (!encodedShare) {
      return {
        ok: false,
        error: createError(
          SharingErrorCodes.INVALID_INPUT,
          "Encoded share is required"
        ),
      };
    }

    // Decode the bundle
    let bundle: ShareBundle;
    try {
      bundle = this.decodeBundle(encodedShare);
    } catch (err) {
      return {
        ok: false,
        error: createError(
          SharingErrorCodes.ENCODING_FAILED,
          `Failed to decode share: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        ),
      };
    }

    const { path, tinycloudHost, session } = bundle;

    // Activate the session with the host
    let authn;
    try {
      authn = await activateSession(session, tinycloudHost);
    } catch (err) {
      return {
        ok: false,
        error: createError(
          SharingErrorCodes.ACTIVATION_FAILED,
          `Failed to activate share session: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        ),
      };
    }

    // Create SpaceConnection and fetch data
    const space = new SpaceConnection(tinycloudHost, authn);

    try {
      const response = await space.get(path);
      if (!response.ok) {
        return {
          ok: false,
          error: createError(
            SharingErrorCodes.FETCH_FAILED,
            `Failed to fetch shared data: ${response.status} ${response.statusText}`,
            undefined,
            { status: response.status, statusText: response.statusText }
          ),
        };
      }

      return {
        ok: true,
        data: {
          data: response.data as T,
          path,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error: createError(
          SharingErrorCodes.FETCH_FAILED,
          `Failed to fetch shared data: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        ),
      };
    }
  }

  /**
   * Encodes a ShareBundle to a base64 string.
   */
  private encodeBundle(bundle: ShareBundle): string {
    const json = JSON.stringify(bundle);
    // Use btoa for browser, Buffer for Node.js
    if (typeof btoa === "function") {
      return btoa(json);
    } else if (typeof Buffer !== "undefined") {
      return Buffer.from(json, "utf-8").toString("base64");
    }
    throw new Error("No base64 encoding method available");
  }

  /**
   * Decodes a base64 string to a ShareBundle.
   */
  private decodeBundle(encoded: string): ShareBundle {
    let json: string;
    // Use atob for browser, Buffer for Node.js
    if (typeof atob === "function") {
      json = atob(encoded);
    } else if (typeof Buffer !== "undefined") {
      json = Buffer.from(encoded, "base64").toString("utf-8");
    } else {
      throw new Error("No base64 decoding method available");
    }

    const bundle = JSON.parse(json) as ShareBundle;

    // Validate bundle structure
    if (!bundle.path || !bundle.tinycloudHost || !bundle.session) {
      throw new Error("Invalid share bundle structure");
    }
    if (
      !bundle.session.delegationHeader ||
      !bundle.session.spaceId ||
      !bundle.session.jwk
    ) {
      throw new Error("Invalid session structure in share bundle");
    }

    return bundle;
  }
}

/**
 * Configuration for creating a SharingService instance.
 */
export interface SharingServiceConfig {
  /** UserAuthorization instance for signing and address */
  userAuth: IUserAuthorization;
  /** TinyCloud host URLs */
  hosts: string[];
  /** WASM session manager from tcwSession */
  sessionManager: tcwSession.TCWSessionManager;
}

/**
 * Creates a new SharingService instance.
 *
 * @param config - Configuration for the sharing service
 * @returns SharingService instance
 */
export function createSharingService(
  config: SharingServiceConfig
): SharingService {
  return new SharingService(config);
}
