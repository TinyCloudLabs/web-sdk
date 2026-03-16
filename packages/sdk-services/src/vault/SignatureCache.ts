/**
 * Caches vault signatures in IndexedDB, encrypted with a
 * non-extractable CryptoKey. Browser-only — no-ops in Node.
 */

// Minimal type declarations for browser APIs used below.
// The sdk-services tsconfig targets ES2020 without DOM lib;
// these declarations let the file compile while the runtime
// guards (isBrowser()) ensure we never call them in Node.
declare const indexedDB: {
  open(name: string, version?: number): IDBOpenDBRequest;
};
interface IDBOpenDBRequest {
  result: IDBDatabase;
  error: DOMException | null;
  onupgradeneeded: ((this: IDBOpenDBRequest) => void) | null;
  onsuccess: ((this: IDBOpenDBRequest) => void) | null;
  onerror: ((this: IDBOpenDBRequest) => void) | null;
}
interface IDBDatabase {
  objectStoreNames: { contains(name: string): boolean };
  createObjectStore(name: string): void;
  transaction(storeNames: string | string[], mode?: string): IDBTransaction;
}
interface IDBTransaction {
  objectStore(name: string): IDBObjectStore;
}
interface IDBObjectStore {
  get(key: string): IDBRequest;
  put(value: unknown, key: string): IDBRequest;
  delete(key: string): IDBRequest;
  getAllKeys(): IDBRequest;
}
interface IDBRequest<T = unknown> {
  result: T;
  error: DOMException | null;
  onsuccess: ((this: IDBRequest<T>) => void) | null;
  onerror: ((this: IDBRequest<T>) => void) | null;
}
type IDBValidKey = string | number | Date | ArrayBuffer | Uint8Array | IDBValidKey[];

const DB_NAME = "tinycloud-vault-cache";
const DB_VERSION = 1;
const STORE_NAME = "signatures";
const WRAP_KEY_ID = "__wrap_key__";

/** Check whether we're in a browser with IndexedDB + SubtleCrypto support. */
function isBrowser(): boolean {
  try {
    return (
      typeof indexedDB !== "undefined" &&
      typeof crypto !== "undefined" &&
      typeof crypto.subtle !== "undefined"
    );
  } catch {
    return false;
  }
}

/** Open (or create) the IndexedDB database. */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Generic IDB get helper. */
function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** Generic IDB put helper. */
function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** Generic IDB delete helper. */
function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** List all keys in the store. */
function idbKeys(db: IDBDatabase): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAllKeys();
    req.onsuccess = () =>
      resolve((req.result as IDBValidKey[]).filter((k) => typeof k === "string") as string[]);
    req.onerror = () => reject(req.error);
  });
}

interface EncryptedEntry {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

/**
 * Get or create the non-extractable AES-GCM wrapping key.
 * The key is stored directly in IndexedDB (structured-clone preserves CryptoKey).
 */
async function getWrapKey(db: IDBDatabase): Promise<CryptoKey> {
  const existing = await idbGet<CryptoKey>(db, WRAP_KEY_ID);
  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"]
  );
  await idbPut(db, WRAP_KEY_ID, key);
  return key;
}

/** Encrypt signature bytes with the wrap key. */
async function encryptSig(
  wrapKey: CryptoKey,
  sigBytes: Uint8Array
): Promise<EncryptedEntry> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, sigBytes)
  );
  return { iv, ciphertext };
}

/** Decrypt an encrypted entry back to signature bytes. */
async function decryptSig(
  wrapKey: CryptoKey,
  entry: EncryptedEntry
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: entry.iv },
    wrapKey,
    entry.ciphertext
  );
  return new Uint8Array(plaintext);
}

/** Cache key for a given spaceId. */
function cacheKey(spaceId: string): string {
  return `sig:${spaceId}`;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load a cached signature for the given spaceId.
 * Returns null on cache miss or in non-browser environments.
 */
export async function loadCachedSignature(
  spaceId: string
): Promise<Uint8Array | null> {
  if (!isBrowser()) return null;
  try {
    const db = await openDB();
    const entry = await idbGet<EncryptedEntry>(db, cacheKey(spaceId));
    if (!entry) return null;
    const wrapKey = await getWrapKey(db);
    return await decryptSig(wrapKey, entry);
  } catch {
    return null;
  }
}

/**
 * Cache a signature for the given spaceId.
 * No-ops in non-browser environments.
 */
export async function cacheSignature(
  spaceId: string,
  sigBytes: Uint8Array
): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDB();
    const wrapKey = await getWrapKey(db);
    const encrypted = await encryptSig(wrapKey, sigBytes);
    await idbPut(db, cacheKey(spaceId), encrypted);
  } catch {
    // Best-effort — swallow errors
  }
}

/**
 * Clear cached signature(s).
 * If spaceId is provided, clears only that entry; otherwise clears all.
 */
export async function clearSignatureCache(
  spaceId?: string
): Promise<void> {
  if (!isBrowser()) return;
  try {
    const db = await openDB();
    if (spaceId) {
      await idbDelete(db, cacheKey(spaceId));
    } else {
      // Clear all sig entries but keep the wrap key
      const keys = await idbKeys(db);
      for (const k of keys) {
        if (k.startsWith("sig:")) {
          await idbDelete(db, k);
        }
      }
    }
  } catch {
    // Best-effort
  }
}
