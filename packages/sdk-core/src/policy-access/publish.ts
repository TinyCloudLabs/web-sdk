/**
 * Sender half of the accountless policy-access flow.
 *
 * The reader half (`./access`) assumes the Policy Engine already knows the
 * policy it is being asked about. Something has to put it there. Before this,
 * the only way in was the engine's boot-time `signedObjects` load, so a policy
 * had to exist on disk before the process started — which is why applications
 * ended up publishing their policies to an application-shaped route on some
 * other service instead of to the engine that actually decides.
 *
 * `publishSignedPolicyObjects` posts owner-signed objects to the engine's
 * `POST /policy/v0/signed-objects` route. It is the same registration contract
 * the boot loader applies, reached at runtime: the engine re-verifies every
 * object and judges authority itself. Nothing here is trusted by the engine —
 * this module only assembles, pins egress, and reports failures in the
 * policy-access vocabulary.
 *
 * Nothing in this module is application-specific. A publisher supplies signed
 * objects and an endpoint; it does not supply a schema, a route, or a claim.
 */
import { PolicyAccessError } from "./errors";
import type { PolicyAccessTransport } from "./transport";

/** The frozen route the engine exposes for owner-signed registration. */
export const POLICY_REGISTRATION_PATH = "/policy/v0/signed-objects" as const;

/**
 * The signed-object families the registration route accepts. Anything else —
 * notably `GrantChallenge`, which is nonce-bearing state the engine mints for
 * itself — is refused here as well as by the engine, so a caller mistake never
 * turns into an engine round-trip.
 */
export const REGISTRABLE_SIGNED_OBJECT_SCHEMAS: readonly string[] = [
  "xyz.tinycloud.auth/key-authorization/v0",
  "xyz.tinycloud.auth/key-status/v0",
  "xyz.tinycloud.policy/engine-record/v0",
  "xyz.tinycloud.policy/policy/v0",
  "xyz.tinycloud.policy/status/v0",
];

export interface PublishSignedPolicyObjectsInput {
  /** Standalone Policy Engine origin, e.g. `https://policy.example.com`. */
  readonly endpoint: string;
  /**
   * Owner-signed objects, in any order. The engine validates the batch as a
   * whole and commits nothing unless every object passes.
   */
  readonly signedObjects: readonly unknown[];
  readonly transport: PolicyAccessTransport;
}

export interface PublishSignedPolicyObjectsResult {
  /** Policy ids the engine now holds, in the order it reported them. */
  readonly registeredPolicyIds: readonly string[];
}

function registrationEndpoint(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new PolicyAccessError(
      "access-descriptor-invalid",
      "policy engine endpoint must be an absolute origin",
    );
  }
  const loopback = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (
    (parsed.protocol !== "https:" && !(loopback && parsed.protocol === "http:")) ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    throw new PolicyAccessError(
      "access-descriptor-invalid",
      "policy engine endpoint must be a canonical HTTPS origin (HTTP is allowed only on loopback)",
    );
  }
  return `${parsed.origin}${POLICY_REGISTRATION_PATH}`;
}

function schemaOf(value: unknown): string | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return undefined;
  }
  const schema = (value as { schema?: unknown }).schema;
  return typeof schema === "string" ? schema : undefined;
}

/**
 * Register owner-signed policy objects with a running Policy Engine.
 *
 * The engine is the authority: it re-verifies canonicalization, digest,
 * content-addressed id, and signature on every object, and applies the same
 * authority and `PolicyEngineRecord` coverage rules it applies at boot. A
 * rejection here means the engine refused, not that this client disagreed.
 */
export async function publishSignedPolicyObjects(
  input: PublishSignedPolicyObjectsInput,
): Promise<PublishSignedPolicyObjectsResult> {
  if (input.signedObjects.length === 0) {
    throw new PolicyAccessError(
      "access-descriptor-invalid",
      "policy publication requires at least one signed object",
    );
  }
  for (const object of input.signedObjects) {
    const schema = schemaOf(object);
    if (schema === undefined) {
      throw new PolicyAccessError(
        "access-descriptor-invalid",
        "every published object must be a signed object with a schema",
      );
    }
    if (!REGISTRABLE_SIGNED_OBJECT_SCHEMAS.includes(schema)) {
      throw new PolicyAccessError(
        "access-descriptor-invalid",
        `the policy registration contract does not accept ${schema}`,
      );
    }
  }

  const response = await input.transport.request({
    method: "POST",
    url: registrationEndpoint(input.endpoint),
    body: { signedObjects: input.signedObjects },
  });
  if (response.status !== 200) {
    const error =
      typeof response.body === "object" &&
      response.body !== null &&
      !Array.isArray(response.body)
        ? (response.body as { error?: { code?: unknown } }).error
        : undefined;
    const code = typeof error?.code === "string" ? error.code : undefined;
    throw new PolicyAccessError(
      "engine-denied",
      `policy engine refused the registration${code === undefined ? "" : `: ${code}`}`,
      { status: response.status, ...(code === undefined ? {} : { denialCode: code }) },
    );
  }
  const body =
    typeof response.body === "object" &&
    response.body !== null &&
    !Array.isArray(response.body)
      ? (response.body as { registeredPolicyIds?: unknown })
      : undefined;
  const registered = body?.registeredPolicyIds;
  if (
    !Array.isArray(registered) ||
    registered.some((value) => typeof value !== "string")
  ) {
    throw new PolicyAccessError(
      "engine-response-invalid",
      "policy engine registration response did not report registered policy ids",
    );
  }
  return { registeredPolicyIds: registered as readonly string[] };
}
