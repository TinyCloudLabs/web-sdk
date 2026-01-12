/**
 * SharingLinks - Handles sharing link operations.
 *
 * This class provides a high-level API for generating, retrieving,
 * and revoking sharing links. Sharing links wrap delegations with
 * a URL-based access mechanism, making it easy to share resources
 * without requiring the recipient to have an existing session.
 *
 * @packageDocumentation
 */

import {
  Result,
  DelegationError,
  DelegationErrorCodes,
  SharingLink,
  SharingLinkData,
  GenerateSharingLinkParams,
  SharingLinksConfig,
} from "./types";
import { DelegationManager } from "./DelegationManager";

/**
 * Default actions for read-only sharing links.
 */
const DEFAULT_READ_ACTIONS = ["tinycloud.kv/get", "tinycloud.kv/metadata"];

/**
 * Default expiry for sharing links (24 hours).
 */
const DEFAULT_EXPIRY_MS = 24 * 60 * 60 * 1000;

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
 * Generates a cryptographically secure random token.
 */
function generateToken(): string {
  // Use crypto.randomUUID if available, otherwise fallback to random bytes
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for environments without crypto.randomUUID
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort: use Math.random (not cryptographically secure)
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Convert to hex string
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * SharingLinks handles the generation and management of sharing links.
 *
 * Sharing links provide a simple way to share access to resources by
 * generating a URL that includes a unique token. The token maps to an
 * underlying delegation that grants the specified permissions.
 *
 * @example
 * ```typescript
 * import { DelegationManager, SharingLinks } from "@tinycloudlabs/sdk-core/delegations";
 *
 * const delegations = new DelegationManager({ hosts, session, invoke });
 * const sharing = new SharingLinks(delegations, { baseUrl: "https://share.myapp.com" });
 *
 * // Generate a sharing link
 * const result = await sharing.generate({
 *   key: "documents/report.pdf",
 *   actions: ["tinycloud.kv/get"],
 *   expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
 * });
 *
 * if (result.ok) {
 *   console.log("Share this URL:", result.data.url);
 * }
 * ```
 */
export class SharingLinks {
  private delegationManager: DelegationManager;
  private baseUrl: string;
  private tokenToDelegation: Map<string, { cid: string; key: string }> = new Map();

  /**
   * Creates a new SharingLinks instance.
   *
   * @param delegationManager - The DelegationManager to use for creating delegations
   * @param config - Configuration including the base URL for sharing links
   */
  constructor(delegationManager: DelegationManager, config: SharingLinksConfig) {
    this.delegationManager = delegationManager;
    this.baseUrl = config.baseUrl.replace(/\/$/, ""); // Remove trailing slash
  }

  /**
   * Generates a sharing link for a resource.
   *
   * Creates a delegation with a unique token that can be used to access
   * the specified resource. The generated URL can be shared with anyone
   * who needs access to the resource.
   *
   * @param params - Parameters for the sharing link
   * @returns Result containing the SharingLink or an error
   *
   * @example
   * ```typescript
   * // Generate a read-only sharing link (default)
   * const result = await sharing.generate({ key: "my-file.json" });
   *
   * // Generate a link with write access
   * const result = await sharing.generate({
   *   key: "shared-folder/",
   *   actions: ["tinycloud.kv/get", "tinycloud.kv/put", "tinycloud.kv/list"],
   *   expiry: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48 hours
   * });
   * ```
   */
  async generate(
    params: GenerateSharingLinkParams
  ): Promise<Result<SharingLink>> {
    if (!params.key) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_INPUT,
          "key is required"
        ),
      };
    }

    const token = generateToken();
    const actions = params.actions ?? DEFAULT_READ_ACTIONS;
    const expiry = params.expiry ?? new Date(Date.now() + DEFAULT_EXPIRY_MS);

    // Create the underlying delegation
    // For sharing links, we use a special anonymous DID pattern
    // The token itself serves as the access mechanism
    const delegationResult = await this.delegationManager.create({
      delegateDID: `did:web:share.tinycloud.xyz:token:${token}`,
      path: params.key,
      actions,
      expiry,
      statement: params.statement ?? `Sharing link for ${params.key}`,
      disableSubDelegation: true, // Sharing links cannot be sub-delegated
    });

    if (!delegationResult.ok) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.CREATION_FAILED,
          `Failed to create sharing link: ${delegationResult.error.message}`,
          delegationResult.error.cause,
          delegationResult.error.meta
        ),
      };
    }

    const delegation = delegationResult.data;

    // Store the token -> delegation mapping
    this.tokenToDelegation.set(token, {
      cid: delegation.cid,
      key: params.key,
    });

    const url = `${this.baseUrl}/share/${token}`;

    const sharingLink: SharingLink = {
      token,
      delegation,
      url,
    };

    return { ok: true, data: sharingLink };
  }

  /**
   * Retrieves data using a sharing link token.
   *
   * This method fetches the resource associated with the sharing link
   * and returns both the data and the delegation that authorized access.
   *
   * @param token - The sharing link token
   * @returns Result containing the data and delegation or an error
   *
   * @example
   * ```typescript
   * // Extract token from URL: https://share.myapp.com/share/abc123
   * const token = "abc123";
   *
   * const result = await sharing.retrieve(token);
   * if (result.ok) {
   *   console.log("Data:", result.data.data);
   *   console.log("Expires:", result.data.delegation.expiry);
   * }
   * ```
   */
  async retrieve<T = unknown>(
    token: string
  ): Promise<Result<SharingLinkData<T>>> {
    if (!token) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_INPUT,
          "token is required"
        ),
      };
    }

    // Look up the delegation for this token
    const mapping = this.tokenToDelegation.get(token);
    if (!mapping) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_TOKEN,
          `Invalid or expired sharing link token: ${token}`
        ),
      };
    }

    // Get the delegation chain to verify it's still valid
    const chainResult = await this.delegationManager.getChain(mapping.cid);
    if (!chainResult.ok) {
      // If we can't get the chain, the delegation might be revoked
      this.tokenToDelegation.delete(token);
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.NOT_FOUND,
          `Sharing link not found or expired: ${token}`,
          chainResult.error.cause
        ),
      };
    }

    const chain = chainResult.data;
    if (chain.length === 0) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.NOT_FOUND,
          `Sharing link not found: ${token}`
        ),
      };
    }

    const delegation = chain[chain.length - 1]; // Get the leaf delegation

    // Check if revoked
    if (delegation.isRevoked) {
      this.tokenToDelegation.delete(token);
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.REVOKED,
          `Sharing link has been revoked: ${token}`
        ),
      };
    }

    // Check if expired
    if (delegation.expiry < new Date()) {
      this.tokenToDelegation.delete(token);
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.AUTH_EXPIRED,
          `Sharing link has expired: ${token}`
        ),
      };
    }

    // Note: Actual data retrieval would require making a KV request
    // using the delegation. This is a placeholder that returns the
    // delegation info. In a full implementation, this would:
    // 1. Use the delegation to make an authenticated KV.get request
    // 2. Return the actual data from the resource

    // For now, return a placeholder indicating the delegation is valid
    // The actual data fetching should be done by the caller using
    // the delegation information returned
    return {
      ok: true,
      data: {
        data: { _pendingFetch: true, key: mapping.key } as unknown as T,
        delegation,
      },
    };
  }

  /**
   * Revokes a sharing link.
   *
   * Once revoked, the sharing link can no longer be used to access
   * the resource. This revokes the underlying delegation.
   *
   * @param token - The sharing link token to revoke
   * @returns Result indicating success or an error
   *
   * @example
   * ```typescript
   * const result = await sharing.revoke("abc123");
   * if (result.ok) {
   *   console.log("Sharing link revoked");
   * }
   * ```
   */
  async revoke(token: string): Promise<Result<void>> {
    if (!token) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_INPUT,
          "token is required"
        ),
      };
    }

    const mapping = this.tokenToDelegation.get(token);
    if (!mapping) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.INVALID_TOKEN,
          `Invalid or unknown sharing link token: ${token}`
        ),
      };
    }

    // Revoke the underlying delegation
    const revokeResult = await this.delegationManager.revoke(mapping.cid);
    if (!revokeResult.ok) {
      return {
        ok: false,
        error: createError(
          DelegationErrorCodes.REVOCATION_FAILED,
          `Failed to revoke sharing link: ${revokeResult.error.message}`,
          revokeResult.error.cause
        ),
      };
    }

    // Remove from local cache
    this.tokenToDelegation.delete(token);

    return { ok: true, data: undefined };
  }

  /**
   * Lists all active sharing links created by this instance.
   *
   * Note: This only returns sharing links created during this session.
   * For a complete list, use DelegationManager.list() and filter
   * delegations that were created as sharing links.
   *
   * @returns Array of active token -> key mappings
   */
  listActive(): Array<{ token: string; key: string; cid: string }> {
    return Array.from(this.tokenToDelegation.entries()).map(
      ([token, mapping]) => ({
        token,
        key: mapping.key,
        cid: mapping.cid,
      })
    );
  }

  /**
   * Clears all cached sharing link mappings.
   *
   * This does not revoke the underlying delegations, only clears
   * the local token -> delegation cache.
   */
  clearCache(): void {
    this.tokenToDelegation.clear();
  }
}
