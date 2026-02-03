/**
 * Protocol version checking for SDK-to-node compatibility.
 *
 * @packageDocumentation
 */

export class ProtocolMismatchError extends Error {
  name = "ProtocolMismatchError" as const;
  constructor(
    public readonly sdkProtocol: number,
    public readonly nodeProtocol: number,
    public readonly nodeVersion: string,
    public readonly host: string
  ) {
    super(
      `SDK protocol version ${sdkProtocol} is incompatible with node protocol version ${nodeProtocol} (node v${nodeVersion}) at ${host}. ` +
        (sdkProtocol < nodeProtocol
          ? "Please update your SDK."
          : "Please update the TinyCloud node.")
    );
  }
}

export class VersionCheckError extends Error {
  name = "VersionCheckError" as const;
  constructor(
    public readonly host: string,
    public readonly cause?: Error
  ) {
    super(
      `Failed to check version at ${host}. Ensure the node is running v1.0.0+ and the /version endpoint is accessible.`
    );
  }
}

/**
 * Check that the SDK protocol version matches the node's protocol version.
 *
 * @param host - The TinyCloud node host URL
 * @param sdkProtocol - The SDK's protocol version (from WASM)
 * @param fetchFn - Fetch implementation (defaults to globalThis.fetch)
 * @throws VersionCheckError if the /version endpoint is unreachable
 * @throws ProtocolMismatchError if protocol versions don't match
 */
export async function checkNodeVersion(
  host: string,
  sdkProtocol: number,
  fetchFn: typeof globalThis.fetch = globalThis.fetch.bind(globalThis)
): Promise<void> {
  let response: Response;
  try {
    response = await fetchFn(`${host}/version`, {
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    throw new VersionCheckError(host, err as Error);
  }

  if (!response.ok) {
    throw new VersionCheckError(host);
  }

  const data = (await response.json()) as {
    protocol: number;
    version: string;
    features: string[];
  };

  if (sdkProtocol !== data.protocol) {
    throw new ProtocolMismatchError(
      sdkProtocol,
      data.protocol,
      data.version,
      host
    );
  }
}
