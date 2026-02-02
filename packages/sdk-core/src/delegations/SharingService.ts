/**
 * SharingService - v2 sharing link service with embedded private keys.
 *
 * This service implements the v2 sharing specification, which embeds private keys
 * directly in sharing links. This allows recipients to exercise delegations
 * without requiring prior session setup.
 *
 * Key differences from v1 SharingLinks:
 * - Private keys are embedded in the link (not just tokens)
 * - Recipients can optionally sub-delegate to their own session key
 * - Pre-configured KV service returned for immediate use
 *
 * @packageDocumentation
 */

import type {
  IKVService,
  ServiceSession,
  InvokeFunction,
  FetchFunction,
} from "@tinycloudlabs/sdk-services";
import type {
  Result,
  DelegationError,
  Delegation,
  KeyInfo,
  KeyProvider,
  GenerateShareParams,
  ShareLink,
  ShareLinkData,
  ShareSchema,
  JWK,
  IngestOptions,
  CreateDelegationParams,
  CreateDelegationWasmParams,
  CreateDelegationWasmResult,
} from "./types";
import { DelegationErrorCodes } from "./types";
import type { DelegationManager } from "./DelegationManager";
import type { ICapabilityKeyRegistry } from "../authorization/CapabilityKeyRegistry";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default actions for read-only sharing links.
 */
const DEFAULT_READ_ACTIONS = ["tinycloud.kv/get", "tinycloud.kv/metadata"];

/**
 * Default expiry for sharing links (24 hours).
 */
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Prefix for the base64 schema.
 */
const BASE64_PREFIX = "tc1:";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Creates a DelegationError with the given parameters.
 */
function createError(
  code: string,
  message: string,
  cause?: Error,
  meta?: Record<string, unknown>
): DelegationError {
  return {
    code,
    message,
    service: "delegation",
    cause,
    meta,
  };
}

/**
 * Base64 encode for URLs (URL-safe base64).
 */
function base64UrlEncode(data: string): string {
  // Use btoa for browser, Buffer for Node.js
  let base64: string;
  if (typeof btoa !== "undefined") {
    base64 = btoa(unescape(encodeURIComponent(data)));
  } else if (typeof Buffer !== "undefined") {
    base64 = Buffer.from(data, "utf-8").toString("base64");
  } else {
    throw new Error("No base64 encoding available");
  }
  // Make URL-safe
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Base64 decode for URLs (URL-safe base64).
 */
function base64UrlDecode(encoded: string): string {
  // Restore standard base64
  let base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  while (base64.length % 4) {
    base64 += "=";
  }
  // Decode
  if (typeof atob !== "undefined") {
    return decodeURIComponent(escape(atob(base64)));
  } else if (typeof Buffer !== "undefined") {
    return Buffer.from(base64, "base64").toString("utf-8");
  } else {
    throw new Error("No base64 decoding available");
  }
}

// =============================================================================
// Types
// =============================================================================

/**
 * Data encoded in a sharing link.
 */
export interface EncodedShareData {
  /** Private key in JWK format (includes d parameter) */
  key: JWK;
  /** DID of the key */
  keyDid: string;
  /** The delegation granting access */
  delegation: Delegation;
  /** Resource path this link grants access to */
  path: string;
  /** TinyCloud host URL */
  host: string;
  /** Space ID */
  spaceId: string;
  /** Schema version */
  version: 1;
}

/**
 * Options for receiving a sharing link.
 */
export interface ReceiveOptions {
  /**
   * Whether to automatically create a sub-delegation to the current session key.
   * Default: true
   */
  autoSubdelegate?: boolean;
  /**
   * Whether to use the current session key for operations (requires autoSubdelegate).
   * Default: true
   */
  useSessionKey?: boolean;
  /**
   * Ingestion options passed to CapabilityKeyRegistry.
   */
  ingestOptions?: IngestOptions;
}

/**
 * Result of receiving a sharing link.
 */
export interface ShareAccess {
  /** The delegation that was received/created */
  delegation: Delegation;
  /** Key info for the received key */
  key: KeyInfo;
  /** Pre-configured KV service for the shared path */
  kv: IKVService;
  /** The space ID */
  spaceId: string;
  /** The path prefix for this share */
  path: string;
}

/**
 * Configuration for SharingService.
 */
export interface SharingServiceConfig {
  /** TinyCloud host URLs */
  hosts: string[];
  /**
   * Active session for authentication.
   * Required for generate(), optional for receive().
   */
  session?: ServiceSession;
  /** Platform-specific invoke function */
  invoke: InvokeFunction;
  /** Optional custom fetch implementation */
  fetch?: FetchFunction;
  /** Key provider for cryptographic operations */
  keyProvider: KeyProvider;
  /** Capability key registry for key/delegation management */
  registry: ICapabilityKeyRegistry;
  /**
   * Delegation manager for creating delegations (used if createDelegation not provided).
   * Required for generate(), optional for receive().
   */
  delegationManager?: DelegationManager;
  /** Factory for creating KV service instances */
  createKVService: (config: {
    hosts: string[];
    session: ServiceSession;
    invoke: InvokeFunction;
    fetch?: FetchFunction;
    pathPrefix?: string;
  }) => IKVService;
  /** Base URL for sharing links (e.g., "https://share.myapp.com") */
  baseUrl?: string;
  /**
   * Custom delegation creation function. When provided, this is used instead
   * of delegationManager.create(). This allows platforms to use their own
   * delegation creation logic (e.g., SIWE-based /delegate endpoint).
   */
  createDelegation?: (params: CreateDelegationParams) => Promise<Result<Delegation, DelegationError>>;
  /**
   * WASM function for client-side delegation creation.
   * When provided, this is preferred over server-side creation (createDelegation/delegationManager).
   * Creates UCAN delegations directly without requiring server roundtrip.
   */
  createDelegationWasm?: (params: CreateDelegationWasmParams) => CreateDelegationWasmResult;
  /**
   * Path prefix for KV operations.
   * When set, paths passed to generate() are prefixed with this value.
   * This ensures the share path matches the session's authorized paths.
   */
  pathPrefix?: string;
  /**
   * Session expiry time.
   * When set, sharing link expiry is clamped to not exceed this value.
   */
  sessionExpiry?: Date;
}

/**
 * Interface for the SharingService.
 */
export interface ISharingService {
  /**
   * Generate a sharing link with an embedded private key.
   *
   * This creates a new session key, delegates to it, and encodes
   * the key and delegation into a shareable link.
   */
  generate(params: GenerateShareParams): Promise<Result<ShareLink, DelegationError>>;

  /**
   * Receive and activate a sharing link.
   *
   * Decodes the link, ingests the key into the registry, and optionally
   * creates a sub-delegation to the current session key.
   */
  receive(link: string, options?: ReceiveOptions): Promise<Result<ShareAccess, DelegationError>>;

  /**
   * Encode sharing data into a link string.
   */
  encodeLink(data: EncodedShareData, schema?: ShareSchema): string;

  /**
   * Decode a link string into sharing data.
   */
  decodeLink(link: string): EncodedShareData;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * SharingService - v2 sharing link service with embedded private keys.
 *
 * @example
 * ```typescript
 * import { SharingService } from "@tinycloudlabs/sdk-core/delegations";
 *
 * const sharing = new SharingService({
 *   hosts: ["https://node.tinycloud.xyz"],
 *   session,
 *   invoke,
 *   keyProvider,
 *   registry,
 *   delegationManager,
 *   createKVService,
 *   baseUrl: "https://share.myapp.com"
 * });
 *
 * // Generate a sharing link
 * const result = await sharing.generate({
 *   path: "/kv/documents/report.pdf",
 *   actions: ["tinycloud.kv/get"],
 *   expiry: new Date("2024-12-31")
 * });
 *
 * if (result.ok) {
 *   console.log("Share this URL:", result.data.url);
 * }
 *
 * // Receive a sharing link
 * const receiveResult = await sharing.receive(shareUrl);
 * if (receiveResult.ok) {
 *   // Use the pre-configured KV service
 *   const data = await receiveResult.data.kv.get("report.pdf");
 * }
 * ```
 */
export class SharingService implements ISharingService {
  private hosts: string[];
  private session?: ServiceSession;
  private invoke: InvokeFunction;
  private fetchFn: FetchFunction;
  private keyProvider: KeyProvider;
  private registry: ICapabilityKeyRegistry;
  private delegationManager?: DelegationManager;
  private createKVService: SharingServiceConfig["createKVService"];
  private baseUrl: string;
  private createDelegationFn?: SharingServiceConfig["createDelegation"];
  private createDelegationWasmFn?: SharingServiceConfig["createDelegationWasm"];
  private pathPrefix: string;
  private sessionExpiry?: Date;

  /**
   * Creates a new SharingService instance.
   */
  constructor(config: SharingServiceConfig) {
    this.hosts = config.hosts;
    this.session = config.session;
    this.invoke = config.invoke;
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.keyProvider = config.keyProvider;
    this.registry = config.registry;
    this.delegationManager = config.delegationManager;
    this.createKVService = config.createKVService;
    this.baseUrl = (config.baseUrl ?? "").replace(/\/$/, ""); // Remove trailing slash
    this.createDelegationFn = config.createDelegation;
    this.createDelegationWasmFn = config.createDelegationWasm;
    this.pathPrefix = config.pathPrefix ?? "";
    this.sessionExpiry = config.sessionExpiry;
  }

  /**
   * Gets the primary host URL.
   */
  private get host(): string {
    return this.hosts[0];
  }

  /**
   * Updates the session (e.g., after re-authentication).
   */
  public updateSession(session: ServiceSession): void {
    this.session = session;
  }

  /**
   * Updates the service configuration.
   * Used to add full capabilities (session, delegationManager, createDelegation, createDelegationWasm) after signIn.
   */
  public updateConfig(config: Partial<Pick<SharingServiceConfig, "session" | "delegationManager" | "createDelegation" | "createDelegationWasm" | "sessionExpiry">>): void {
    if (config.session !== undefined) {
      this.session = config.session;
    }
    if (config.delegationManager !== undefined) {
      this.delegationManager = config.delegationManager;
    }
    if (config.createDelegation !== undefined) {
      this.createDelegationFn = config.createDelegation;
    }
    if (config.createDelegationWasm !== undefined) {
      this.createDelegationWasmFn = config.createDelegationWasm;
    }
    if (config.sessionExpiry !== undefined) {
      this.sessionExpiry = config.sessionExpiry;
    }
  }

  /**
   * Generate a sharing link with an embedded private key.
   *
   * Flow:
   * 1. Spawn new session key (unique per share)
   * 2. Create delegation from current session to spawned key
   * 3. Package: { key (with private!), delegation, path, host }
   * 4. Encode based on schema (base64 for now)
   * 5. Return link string
   */
  async generate(params: GenerateShareParams): Promise<Result<ShareLink, DelegationError>> {
    // Require session for generating (not for receiving)
    if (!this.session) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.NOT_INITIALIZED,
          "Session required for generating sharing links. Call signIn() first."
        ),
      };
    }

    // Require delegation capability
    if (!this.createDelegationWasmFn && !this.createDelegationFn && !this.delegationManager) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.NOT_INITIALIZED,
          "DelegationManager, createDelegation, or createDelegationWasm function required for generating sharing links."
        ),
      };
    }

    // Validate path
    if (!params.path) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_INPUT,
          "path is required"
        ),
      };
    }

    const actions = params.actions ?? DEFAULT_READ_ACTIONS;
    const requestedExpiry = params.expiry ?? new Date(Date.now() + DEFAULT_EXPIRY_MS);
    // Clamp expiry to session expiry if set
    const expiry = this.sessionExpiry && requestedExpiry > this.sessionExpiry
      ? this.sessionExpiry
      : requestedExpiry;
    const schema: ShareSchema = params.schema ?? "base64";

    // Build full path with prefix (matches how KVService stores data)
    // If pathPrefix is "demo-app" and path is "hello", fullPath is "demo-app/hello"
    const fullPath = this.pathPrefix
      ? `${this.pathPrefix}/${params.path}`.replace(/\/+/g, "/") // Normalize slashes
      : params.path;

    // Only base64 schema is implemented in v1
    if (schema !== "base64") {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_INPUT,
          `Schema '${schema}' not implemented. Only 'base64' is supported.`
        ),
      };
    }

    // Step 1: Spawn a new session key unique to this share
    let keyId: string;
    let keyDid: string;
    let keyJwk: JWK;

    try {
      const shareKeyName = `share:${Date.now()}:${Math.random().toString(36).substring(2, 10)}`;
      keyId = await this.keyProvider.createSessionKey(shareKeyName);
      keyDid = await this.keyProvider.getDID(keyId);
      keyJwk = this.keyProvider.getJWK(keyId) as JWK;

      // Ensure the private key is included
      if (!keyJwk.d) {
        return {
          ok: false,
          error: createError(
            DelegationErrorCodes.CREATION_FAILED,
            "KeyProvider did not return private key (d parameter) in JWK"
          ),
        };
      }
    } catch (err) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.CREATION_FAILED,
          `Failed to generate session key for share: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        ),
      };
    }

    // Step 2: Create delegation from current session to spawned key
    // Prefer client-side WASM creation, fall back to server-side
    let delegation: Delegation;

    if (this.createDelegationWasmFn) {
      // Client-side delegation creation via WASM
      try {
        // Strip fragment from DID URL to get plain DID for UCAN audience
        // getDID() returns "did:key:z6Mk...#z6Mk..." but audience needs "did:key:z6Mk..."
        const plainDID = keyDid.split('#')[0];

        const wasmResult = this.createDelegationWasmFn({
          session: this.session,
          delegateDID: plainDID,
          spaceId: this.session.spaceId,
          path: fullPath,
          actions,
          expirationSecs: Math.floor(expiry.getTime() / 1000),
        });

        // Register the delegation with the server
        // The server needs to know about this delegation for proof chain validation
        const registerRes = await this.fetchFn(`${this.host}/delegate`, {
          method: "POST",
          headers: {
            Authorization: wasmResult.delegation, // The UCAN JWT
          },
        });

        if (!registerRes.ok) {
          const errorText = await registerRes.text();
          return {
            ok: false,
            error: createError(
              DelegationErrorCodes.CREATION_FAILED,
              `Failed to register delegation with server: ${registerRes.status} ${errorText}`
            ),
          };
        }

        delegation = {
          cid: wasmResult.cid,
          delegateDID: wasmResult.delegateDID,
          spaceId: this.session.spaceId,
          path: wasmResult.path,
          actions: wasmResult.actions,
          expiry: wasmResult.expiry,
          isRevoked: false,
          authHeader: wasmResult.delegation, // The UCAN JWT (no Bearer prefix - SDK adds it internally)
          allowSubDelegation: true,
          createdAt: new Date(),
        };
      } catch (err) {
        return {
          ok: false,
          error: createError(
            DelegationErrorCodes.CREATION_FAILED,
            `Failed to create delegation via WASM: ${err instanceof Error ? err.message : String(err)}`,
            err instanceof Error ? err : undefined
          ),
        };
      }
    } else {
      // Server-side delegation creation (fallback)
      const delegationParams: CreateDelegationParams = {
        delegateDID: keyDid,
        path: fullPath,
        actions,
        expiry,
        statement: params.description ?? `Share access for ${params.path}`,
        disableSubDelegation: false, // Allow sub-delegation for auto-subdelegate flow
      };

      const delegationResult = this.createDelegationFn
        ? await this.createDelegationFn(delegationParams)
        // delegationManager is guaranteed to exist by the guard check above
        : await this.delegationManager!.create(delegationParams);

      if (!delegationResult.ok) {
        return {
          ok: false,
          error: createError(
            DelegationErrorCodes.CREATION_FAILED,
            `Failed to create delegation for share: ${delegationResult.error.message}`,
            delegationResult.error.cause,
            delegationResult.error.meta
          ),
        };
      }

      delegation = delegationResult.data;
    }

    // Step 3: Package the share data
    const shareData: EncodedShareData = {
      key: keyJwk,
      keyDid,
      delegation,
      path: fullPath,
      host: this.host,
      spaceId: this.session.spaceId,
      version: 1,
    };

    // Step 4: Encode the link
    const encodedData = this.encodeLink(shareData, schema);

    // Step 5: Build the full URL
    const baseUrl = params.baseUrl ?? this.baseUrl;
    const url = baseUrl ? `${baseUrl}/share/${encodedData}` : encodedData;

    const shareLink: ShareLink = {
      token: encodedData,
      url,
      delegation,
      schema,
      expiresAt: expiry,
      description: params.description,
    };

    return { ok: true, data: shareLink };
  }

  /**
   * Receive and activate a sharing link.
   *
   * Flow:
   * 1. Decode link -> extract { key, delegation, path, host }
   * 2. Ingest key into CapabilityKeyRegistry
   * 3. If autoSubdelegate (default true) + useSessionKey:
   *    - Create sub-delegation from ingested key -> current session
   *    - Register sub-delegation capabilities
   * 4. Return ShareAccess with pre-configured KV service
   */
  async receive(
    link: string,
    options: ReceiveOptions = {}
  ): Promise<Result<ShareAccess, DelegationError>> {
    const {
      autoSubdelegate = true,
      useSessionKey = true,
      ingestOptions,
    } = options;

    // Step 1: Decode the link
    let shareData: EncodedShareData;
    try {
      shareData = this.decodeLink(link);
    } catch (err) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_TOKEN,
          `Failed to decode sharing link: ${err instanceof Error ? err.message : String(err)}`,
          err instanceof Error ? err : undefined
        ),
      };
    }

    // Validate the decoded data
    if (!shareData.key || !shareData.key.d) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_TOKEN,
          "Sharing link does not contain a valid private key"
        ),
      };
    }

    if (!shareData.delegation) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_TOKEN,
          "Sharing link does not contain a delegation"
        ),
      };
    }

    // Check delegation expiry
    const delegationExpiry = new Date(shareData.delegation.expiry);
    if (delegationExpiry < new Date()) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.AUTH_EXPIRED,
          "Sharing link has expired"
        ),
      };
    }

    // Check delegation revocation
    if (shareData.delegation.isRevoked) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.REVOKED,
          "Sharing link has been revoked"
        ),
      };
    }

    // Step 2: Create KeyInfo and ingest into registry
    const keyInfo: KeyInfo = {
      id: `ingested:${shareData.keyDid}`,
      did: shareData.keyDid,
      type: "ingested",
      jwk: shareData.key,
      priority: 2, // Ingested keys have lowest priority
    };

    this.registry.ingestKey(keyInfo, shareData.delegation, ingestOptions);

    // The delegation and key to use for operations
    let activeDelegation = shareData.delegation;
    let activeKey = keyInfo;

    // Step 3: Auto-subdelegate if requested
    if (autoSubdelegate && useSessionKey && this.session) {
      try {
        // Get current session key DID
        // Note: We need to create a sub-delegation from the ingested key to the session key
        // This requires the session key DID, which should be available from the session

        // For now, we'll register the ingested key's capabilities directly
        // The auto-subdelegation would require additional infrastructure to sign with the ingested key
        // This is a simplification - full implementation would sign a new delegation with the ingested key

        // TODO: Implement full auto-subdelegation when signing infrastructure is available
        // For now, the ingested key can be used directly via the registry

      } catch (err) {
        // Log but don't fail - can still use the ingested key directly
        console.warn("Auto-subdelegation failed, using ingested key directly:", err);
      }
    }

    // Step 4: Create pre-configured KV service for the shared path
    // Construct session from share data - no need for existing session
    // Use the authHeader if available, otherwise fall back to constructing from CID
    const authHeader = shareData.delegation.authHeader ?? `Bearer ${shareData.delegation.cid}`;
    const shareSession: ServiceSession = {
      delegationHeader: { Authorization: authHeader },
      delegationCid: shareData.delegation.cid,
      spaceId: shareData.spaceId,
      verificationMethod: shareData.keyDid,
      jwk: shareData.key,
    };

    const kvService = this.createKVService({
      hosts: [shareData.host],
      session: shareSession,
      invoke: this.invoke,
      fetch: this.fetchFn,
      pathPrefix: shareData.path,
    });

    const shareAccess: ShareAccess = {
      delegation: activeDelegation,
      key: activeKey,
      kv: kvService,
      spaceId: shareData.spaceId,
      path: shareData.path,
    };

    return { ok: true, data: shareAccess };
  }

  /**
   * Encode sharing data into a link string.
   *
   * @param data - The share data to encode
   * @param schema - The encoding schema (default: "base64")
   * @returns Encoded link string
   */
  encodeLink(data: EncodedShareData, schema: ShareSchema = "base64"): string {
    if (schema !== "base64") {
      throw new Error(`Schema '${schema}' not implemented. Only 'base64' is supported.`);
    }

    const jsonString = JSON.stringify(data);
    const encoded = base64UrlEncode(jsonString);
    return `${BASE64_PREFIX}${encoded}`;
  }

  /**
   * Decode a link string into sharing data.
   *
   * @param link - The encoded link string (may include URL prefix)
   * @returns Decoded share data
   */
  decodeLink(link: string): EncodedShareData {
    // Extract the encoded data from the link
    let encoded = link;

    // Handle full URL format: https://share.example.com/share/tc1:...
    if (link.includes("/share/")) {
      const parts = link.split("/share/");
      encoded = parts[parts.length - 1];
    }

    // Handle query parameter format: ?share=tc1:...
    if (link.includes("?share=")) {
      const url = new URL(link);
      encoded = url.searchParams.get("share") ?? encoded;
    }

    // Remove the schema prefix
    if (!encoded.startsWith(BASE64_PREFIX)) {
      throw new Error(`Invalid sharing link format. Expected prefix '${BASE64_PREFIX}'`);
    }

    const base64Data = encoded.slice(BASE64_PREFIX.length);
    const jsonString = base64UrlDecode(base64Data);

    const data = JSON.parse(jsonString) as EncodedShareData;

    // Validate version
    if (data.version !== 1) {
      throw new Error(`Unsupported sharing link version: ${data.version}`);
    }

    // Convert delegation expiry back to Date if it's a string
    if (typeof data.delegation.expiry === "string") {
      data.delegation.expiry = new Date(data.delegation.expiry);
    }

    return data;
  }
}

/**
 * Create a new SharingService instance.
 */
export function createSharingService(config: SharingServiceConfig): ISharingService {
  return new SharingService(config);
}
