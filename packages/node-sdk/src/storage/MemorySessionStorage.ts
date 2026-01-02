import { ISessionStorage, PersistedSessionData } from "@tinycloudlabs/sdk-core";

/**
 * In-memory session storage for Node.js.
 *
 * Sessions are stored in memory and lost when the process exits.
 * Suitable for:
 * - Development and testing
 * - Stateless server deployments
 * - Short-lived processes
 *
 * @example
 * ```typescript
 * const storage = new MemorySessionStorage();
 * await storage.save("0x123...", sessionData);
 * const session = await storage.load("0x123...");
 * ```
 */
export class MemorySessionStorage implements ISessionStorage {
  private sessions: Map<string, PersistedSessionData> = new Map();

  /**
   * Save a session for an address.
   */
  async save(address: string, session: PersistedSessionData): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    this.sessions.set(normalizedAddress, session);
  }

  /**
   * Load a session for an address.
   */
  async load(address: string): Promise<PersistedSessionData | null> {
    const normalizedAddress = address.toLowerCase();
    const session = this.sessions.get(normalizedAddress);

    if (!session) {
      return null;
    }

    // Check if session is expired
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt < new Date()) {
      this.sessions.delete(normalizedAddress);
      return null;
    }

    return session;
  }

  /**
   * Clear a session for an address.
   */
  async clear(address: string): Promise<void> {
    const normalizedAddress = address.toLowerCase();
    this.sessions.delete(normalizedAddress);
  }

  /**
   * Check if a session exists for an address.
   */
  exists(address: string): boolean {
    const normalizedAddress = address.toLowerCase();
    const session = this.sessions.get(normalizedAddress);

    if (!session) {
      return false;
    }

    // Check if session is expired
    const expiresAt = new Date(session.expiresAt);
    if (expiresAt < new Date()) {
      this.sessions.delete(normalizedAddress);
      return false;
    }

    return true;
  }

  /**
   * Memory storage is always available.
   */
  isAvailable(): boolean {
    return true;
  }

  /**
   * Clear all sessions.
   */
  clearAll(): void {
    this.sessions.clear();
  }

  /**
   * Get the number of stored sessions.
   */
  size(): number {
    return this.sessions.size;
  }
}
