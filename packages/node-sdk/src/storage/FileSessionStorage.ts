import { ISessionStorage, PersistedSessionData, validatePersistedSessionData } from "@tinycloudlabs/sdk-core";
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { dirname, join } from "path";

/**
 * File-based session storage for Node.js.
 *
 * Sessions are persisted to the file system and survive process restarts.
 * Suitable for:
 * - CLI applications
 * - Long-running server processes
 * - Development environments
 *
 * @example
 * ```typescript
 * const storage = new FileSessionStorage("/tmp/tinycloud-sessions");
 * await storage.save("0x123...", sessionData);
 * // Session persists across process restarts
 * ```
 */
export class FileSessionStorage implements ISessionStorage {
  private readonly baseDir: string;

  /**
   * Create a new FileSessionStorage.
   *
   * @param baseDir - Directory to store session files (default: ~/.tinycloud/sessions)
   */
  constructor(baseDir?: string) {
    this.baseDir = baseDir || this.getDefaultDir();
    this.ensureDirectoryExists();
  }

  /**
   * Get the default session storage directory.
   */
  private getDefaultDir(): string {
    const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
    return join(home, ".tinycloud", "sessions");
  }

  /**
   * Ensure the storage directory exists.
   */
  private ensureDirectoryExists(): void {
    if (!existsSync(this.baseDir)) {
      mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Get the file path for an address.
   */
  private getFilePath(address: string): string {
    const normalizedAddress = address.toLowerCase();
    // Use a hash of the address to avoid filesystem issues
    const filename = `${normalizedAddress.replace("0x", "")}.json`;
    return join(this.baseDir, filename);
  }

  /**
   * Save a session for an address.
   */
  async save(address: string, session: PersistedSessionData): Promise<void> {
    const filePath = this.getFilePath(address);
    const data = JSON.stringify(session, null, 2);
    writeFileSync(filePath, data, "utf-8");
  }

  /**
   * Load a session for an address.
   */
  async load(address: string): Promise<PersistedSessionData | null> {
    const filePath = this.getFilePath(address);

    if (!existsSync(filePath)) {
      return null;
    }

    try {
      const data = readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(data);

      // Validate loaded data against schema
      const validation = validatePersistedSessionData(parsed);
      if (!validation.ok) {
        console.warn(`Invalid session data for ${address}:`, validation.error.message);
        // Clean up invalid session
        unlinkSync(filePath);
        return null;
      }

      const session = validation.data;

      // Check if session is expired
      const expiresAt = new Date(session.expiresAt);
      if (expiresAt < new Date()) {
        // Clean up expired session
        unlinkSync(filePath);
        return null;
      }

      return session;
    } catch (error) {
      // Invalid JSON or read error - remove the file
      try {
        unlinkSync(filePath);
      } catch {
        // Ignore cleanup errors
      }
      return null;
    }
  }

  /**
   * Clear a session for an address.
   */
  async clear(address: string): Promise<void> {
    const filePath = this.getFilePath(address);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  /**
   * Check if a session exists for an address.
   */
  exists(address: string): boolean {
    const filePath = this.getFilePath(address);
    if (!existsSync(filePath)) {
      return false;
    }

    try {
      const data = readFileSync(filePath, "utf-8");
      const session: PersistedSessionData = JSON.parse(data);

      // Check if session is expired
      const expiresAt = new Date(session.expiresAt);
      if (expiresAt < new Date()) {
        // Clean up expired session
        unlinkSync(filePath);
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if file system storage is available.
   */
  isAvailable(): boolean {
    try {
      this.ensureDirectoryExists();
      return existsSync(this.baseDir);
    } catch {
      return false;
    }
  }
}
