import { createHash, randomBytes } from "node:crypto";
import { DEFAULT_CHAIN_ID, DEFAULT_OPENKEY_HOST } from "../config/constants.js";
import { ProfileManager } from "../config/profiles.js";
import type { ProfileConfig } from "../config/types.js";
import { generateKey, keyToDID } from "./local-key.js";
import { publicJwkForDelegation, validateDelegationCallbackPayload } from "./browser-auth.js";

export const SHARE_DEVICE_DELEGATION_SECONDS = 30 * 24 * 60 * 60;
export const SHARE_DEVICE_PERMISSIONS = [{
  service: "tinycloud.capabilities",
  space: "applications",
  path: "",
  actions: ["tinycloud.capabilities/read"],
}] as const;

type DeviceStartResponse = {
  transactionId: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
};

type DeviceBinding = {
  transactionId: string;
  sessionDid: string;
  nodeOrigin: string;
  shareOrigin: string;
  permissions: typeof SHARE_DEVICE_PERMISSIONS | Array<Record<string, unknown>>;
  delegationExpiresAt: string;
};

type DevicePollResponse =
  | { status: "pending"; interval: number }
  | { status: "approved"; delegation: Record<string, unknown>; binding: DeviceBinding };

function digest(value: string): string {
  return createHash("sha256").update(value).digest("base64url");
}

function canonicalOrigin(value: string, label: string): string {
  const url = new URL(value);
  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost";
  if (url.origin !== value || (url.protocol !== "https:" && !(loopback && url.protocol === "http:"))) {
    throw new Error(`${label} must be a canonical HTTPS origin`);
  }
  return value;
}

function jsonEqual(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown => Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === "object"
      ? Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]))
      : value;
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function validateStart(value: unknown): DeviceStartResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("OpenKey returned an invalid device authorization response");
  const result = value as Record<string, unknown>;
  if (
    typeof result.transactionId !== "string" || !/^[A-Za-z0-9_-]{20,}$/.test(result.transactionId) ||
    typeof result.userCode !== "string" || !/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(result.userCode) ||
    typeof result.verificationUri !== "string" ||
    typeof result.verificationUriComplete !== "string" ||
    !Number.isSafeInteger(result.expiresIn) || Number(result.expiresIn) < 60 ||
    !Number.isSafeInteger(result.interval) || Number(result.interval) < 1
  ) throw new Error("OpenKey returned an invalid device authorization response");
  canonicalOrigin(new URL(result.verificationUri).origin, "verification URI");
  if (new URL(result.verificationUriComplete).origin !== new URL(result.verificationUri).origin) {
    throw new Error("OpenKey returned an invalid verification URI");
  }
  return result as unknown as DeviceStartResponse;
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new Error(`OpenKey device authorization failed (HTTP ${response.status})`);
  }
}

function errorCode(value: unknown): string | undefined {
  return value && typeof value === "object" && typeof (value as Record<string, unknown>).error === "string"
    ? (value as Record<string, unknown>).error as string
    : undefined;
}

function publicSessionJwk(value: object): object {
  const publicJwk = publicJwkForDelegation(value);
  const record = publicJwk as Record<string, unknown>;
  if (record.kty !== "OKP" || record.crv !== "Ed25519" || typeof record.x !== "string") {
    throw new Error("CLI session key is not a public Ed25519 JWK");
  }
  return publicJwk;
}

function assertApprovedBinding(input: {
  binding: DeviceBinding;
  transactionId: string;
  sessionDid: string;
  nodeOrigin: string;
  shareOrigin: string;
  publicJwk: object;
  delegation: Record<string, unknown>;
}): void {
  if (
    input.binding.transactionId !== input.transactionId ||
    input.binding.sessionDid !== input.sessionDid ||
    input.binding.nodeOrigin !== input.nodeOrigin ||
    input.binding.shareOrigin !== input.shareOrigin ||
    !jsonEqual(input.binding.permissions, SHARE_DEVICE_PERMISSIONS)
  ) throw new Error("OpenKey returned a delegation with the wrong device binding");
  const expiresAt = Date.parse(input.binding.delegationExpiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || expiresAt > Date.now() + SHARE_DEVICE_DELEGATION_SECONDS * 1000 + 30_000) {
    throw new Error("OpenKey returned a delegation outside the requested expiry window");
  }
  if (input.delegation.verificationMethod !== input.sessionDid) {
    throw new Error("OpenKey returned a delegation for a different CLI session DID");
  }
  if (!input.delegation.jwk || typeof input.delegation.jwk !== "object" || !jsonEqual(publicSessionJwk(input.delegation.jwk), input.publicJwk)) {
    throw new Error("OpenKey returned a delegation for a different CLI session key");
  }
  const invalid = validateDelegationCallbackPayload(input.delegation);
  if (invalid) throw new Error(`OpenKey returned an invalid delegation: ${invalid}`);
}

export async function acquireShareDeviceDelegation(input: {
  sessionDid: string;
  jwk: object;
  nodeOrigin: string;
  shareOrigin: string;
  openkeyHost?: string;
  fetchFn?: typeof globalThis.fetch;
  emitInstructions?: (value: { verificationUri: string; verificationUriComplete: string; userCode: string }) => void;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<Record<string, unknown>> {
  const openkeyHost = canonicalOrigin(input.openkeyHost ?? DEFAULT_OPENKEY_HOST, "OpenKey host");
  const nodeOrigin = canonicalOrigin(input.nodeOrigin, "TinyCloud node origin");
  const shareOrigin = canonicalOrigin(input.shareOrigin, "Share origin");
  const fetchFn = input.fetchFn ?? globalThis.fetch;
  const deviceSecret = randomBytes(32).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const publicJwk = publicSessionJwk(input.jwk);
  const startResponse = await fetchFn(`${openkeyHost}/api/device-authorizations`, {
    method: "POST",
    credentials: "omit",
    redirect: "error",
    referrerPolicy: "no-referrer",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({
      deviceSecretHash: digest(deviceSecret),
      codeChallenge: digest(codeVerifier),
      sessionDid: input.sessionDid,
      publicJwk,
      permissions: SHARE_DEVICE_PERMISSIONS,
      nodeOrigin,
      shareOrigin,
      delegationTtlSeconds: SHARE_DEVICE_DELEGATION_SECONDS,
    }),
  });
  const startValue = await responseJson(startResponse);
  if (!startResponse.ok) throw new Error(`OpenKey device authorization failed: ${errorCode(startValue) ?? startResponse.status}`);
  const started = validateStart(startValue);
  (input.emitInstructions ?? ((value) => {
    process.stderr.write(`OpenKey device authorization\nVisit: ${value.verificationUri}\nCode:  ${value.userCode}\n\nWaiting for approval…\n`);
  }))({ verificationUri: started.verificationUri, verificationUriComplete: started.verificationUriComplete, userCode: started.userCode });

  const deadline = Date.now() + started.expiresIn * 1000;
  let interval = started.interval;
  const wait = input.wait ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  while (Date.now() < deadline) {
    await wait(interval * 1000);
    const response = await fetchFn(`${openkeyHost}/api/device-authorizations/token`, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ transactionId: started.transactionId, deviceSecret, codeVerifier }),
    });
    const value = await responseJson(response);
    const code = errorCode(value);
    if (response.status === 429 && code === "slow_down") {
      interval += 1;
      continue;
    }
    if (!response.ok) throw new Error(`OpenKey device authorization failed: ${code ?? response.status}`);
    const result = value as DevicePollResponse;
    if (result.status === "pending") {
      interval = Math.max(interval, result.interval);
      continue;
    }
    if (result.status !== "approved" || !result.delegation || !result.binding) {
      throw new Error("OpenKey returned an invalid device authorization result");
    }
    assertApprovedBinding({ binding: result.binding, transactionId: started.transactionId, sessionDid: input.sessionDid, nodeOrigin, shareOrigin, publicJwk, delegation: result.delegation });
    return result.delegation;
  }
  throw new Error("OpenKey device authorization expired before approval");
}

export function mergePrivateJwkIntoSession(session: Record<string, unknown>, key: object): Record<string, unknown> {
  const sessionJwk = session.jwk;
  if (!sessionJwk || typeof sessionJwk !== "object") return session;
  const sessionJwkRecord = sessionJwk as Record<string, unknown>;
  if (typeof sessionJwkRecord.d === "string" && sessionJwkRecord.d.length > 0) return session;
  const privateParameter = (key as Record<string, unknown>).d;
  if (typeof privateParameter !== "string" || privateParameter.length === 0) return session;
  return { ...session, jwk: { ...sessionJwkRecord, d: privateParameter } };
}

export async function ensureShareDeviceAuthorization(input: {
  profileName: string;
  nodeOrigin: string;
  shareOrigin: string;
  openkeyHost?: string;
  fetchFn?: typeof globalThis.fetch;
  allowReplaceLocal?: boolean;
  emitInstructions?: (value: { verificationUri: string; verificationUriComplete: string; userCode: string }) => void;
  wait?: (milliseconds: number) => Promise<void>;
}): Promise<{ profile: ProfileConfig; delegation: Record<string, unknown> }> {
  let profile = await ProfileManager.getProfile(input.profileName).catch(() => null);
  if (profile?.authMethod === "local" && input.allowReplaceLocal !== true) {
    throw new Error("This profile uses a local owner key. Run `tc auth login --device` explicitly to replace its authentication posture.");
  }
  let key = await ProfileManager.getKey(input.profileName);
  if (!key) {
    const generated = generateKey();
    key = generated.jwk;
    await ProfileManager.setKey(input.profileName, key);
  }
  const sessionDid = keyToDID(key);
  profile = {
    ...profile,
    name: input.profileName,
    host: input.nodeOrigin,
    chainId: profile?.chainId ?? DEFAULT_CHAIN_ID,
    spaceName: profile?.spaceName ?? "applications",
    did: sessionDid,
    sessionDid,
    createdAt: profile?.createdAt ?? new Date().toISOString(),
    posture: "owner-openkey",
    operatorType: profile?.operatorType ?? "human",
    authMethod: "openkey",
    openkeyHost: input.openkeyHost ?? profile?.openkeyHost,
  };
  await ProfileManager.setProfile(input.profileName, profile);

  const delegation = await acquireShareDeviceDelegation({
    sessionDid,
    jwk: key,
    nodeOrigin: input.nodeOrigin,
    shareOrigin: input.shareOrigin,
    openkeyHost: input.openkeyHost ?? profile.openkeyHost,
    fetchFn: input.fetchFn,
    emitInstructions: input.emitInstructions,
    wait: input.wait,
  });
  const session = mergePrivateJwkIntoSession(delegation, key);
  await ProfileManager.setSession(input.profileName, session);
  const updatedProfile: ProfileConfig = {
    ...profile,
    ownerDid: typeof session.ownerDid === "string" ? session.ownerDid : profile.ownerDid,
    spaceId: typeof session.spaceId === "string" ? session.spaceId : profile.spaceId,
  };
  await ProfileManager.setProfile(input.profileName, updatedProfile);
  return { profile: updatedProfile, delegation: session };
}
