import { ISessionStorage, PersistedSessionData, validatePersistedSessionData } from "@tinycloud/sdk-core";

const STORAGE_PREFIX = "tinycloud:session:";

export class BrowserSessionStorage implements ISessionStorage {
  save(address: string, data: PersistedSessionData): Promise<void> {
    localStorage.setItem(STORAGE_PREFIX + address.toLowerCase(), JSON.stringify(data));
    return Promise.resolve();
  }

  load(address: string): Promise<PersistedSessionData | null> {
    const raw = localStorage.getItem(STORAGE_PREFIX + address.toLowerCase());
    if (!raw) return Promise.resolve(null);
    try {
      const parsed = JSON.parse(raw);
      const result = validatePersistedSessionData(parsed);
      if (!result.ok) return Promise.resolve(null);
      // Check for stale sessions (orbitId/namespaceId migration)
      if (!result.data.tinycloudSession?.spaceId) {
        this.clear(address);
        return Promise.resolve(null);
      }
      return Promise.resolve(result.data);
    } catch {
      return Promise.resolve(null);
    }
  }

  clear(address: string): Promise<void> {
    localStorage.removeItem(STORAGE_PREFIX + address.toLowerCase());
    return Promise.resolve();
  }

  exists(address: string): boolean {
    return localStorage.getItem(STORAGE_PREFIX + address.toLowerCase()) !== null;
  }

  isAvailable(): boolean {
    try {
      localStorage.setItem('__tc_test', '1');
      localStorage.removeItem('__tc_test');
      return true;
    } catch {
      return false;
    }
  }
}
