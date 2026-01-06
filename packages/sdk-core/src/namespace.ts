/**
 * Shared namespace utilities for TinyCloud.
 *
 * These functions are platform-agnostic and can be used by both
 * web-sdk and node-sdk for namespace hosting and session activation.
 */

/**
 * Result of a namespace hosting or session activation attempt.
 */
export interface NamespaceHostResult {
  /** Whether the operation succeeded (2xx status) */
  success: boolean;
  /** HTTP status code */
  status: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Fetch the peer ID from TinyCloud server for namespace hosting.
 *
 * The peer ID identifies the TinyCloud server instance that will host the namespace.
 *
 * @param host - TinyCloud server URL (e.g., "https://node.tinycloud.xyz")
 * @param namespaceId - The namespace ID to host
 * @returns The peer ID string
 * @throws Error if the request fails
 */
export async function fetchPeerId(
  host: string,
  namespaceId: string
): Promise<string> {
  const res = await fetch(
    `${host}/peer/generate/${encodeURIComponent(namespaceId)}`
  );

  if (!res.ok) {
    const error = await res.text().catch(() => res.statusText);
    throw new Error(`Failed to get peer ID: ${res.status} - ${error}`);
  }

  return res.text();
}

/**
 * Submit a namespace hosting delegation to TinyCloud server.
 *
 * This registers a new namespace with the server, allowing the user
 * to store data in it.
 *
 * @param host - TinyCloud server URL
 * @param headers - Delegation headers (from siweToDelegationHeaders)
 * @returns Result indicating success/failure
 */
export async function submitHostDelegation(
  host: string,
  headers: Record<string, string>
): Promise<NamespaceHostResult> {
  const res = await fetch(`${host}/delegate`, {
    method: "POST",
    headers,
  });

  return {
    success: res.ok,
    status: res.status,
    error: res.ok ? undefined : await res.text().catch(() => res.statusText),
  };
}

/**
 * Activate a session with TinyCloud server.
 *
 * This submits the session delegation to the server, enabling the session
 * key to perform operations on behalf of the user.
 *
 * @param host - TinyCloud server URL
 * @param delegationHeader - Session delegation header (from session.delegationHeader)
 * @returns Result indicating success/failure (404 means namespace doesn't exist)
 */
export async function activateSessionWithHost(
  host: string,
  delegationHeader: { Authorization: string }
): Promise<NamespaceHostResult> {
  const res = await fetch(`${host}/delegate`, {
    method: "POST",
    headers: delegationHeader,
  });

  return {
    success: res.ok,
    status: res.status,
    error: res.ok ? undefined : await res.text().catch(() => res.statusText),
  };
}
