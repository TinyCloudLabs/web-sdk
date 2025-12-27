import {
  PersistedSession,
  EncryptedPersistedSession,
  SessionPersistenceConfig,
  DEFAULT_PERSISTENCE_CONFIG,
} from './types';
import { debug } from '../../utils/debug';

/**
 * Handles secure persistence and retrieval of session data
 */
export class SessionPersistence {
  private config: SessionPersistenceConfig;

  constructor(config: Partial<SessionPersistenceConfig> = {}) {
    this.config = { ...DEFAULT_PERSISTENCE_CONFIG, ...config };
  }

  /**
   * Get the current configuration
   */
  get configuration(): SessionPersistenceConfig {
    return this.config;
  }

  /**
   * Save a session to persistent storage
   */
  async saveSession(session: PersistedSession): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const storageKey = this.getStorageKey(session.address);

      if (this.config.encryptionEnabled) {
        const encrypted = await this.encryptSession(session);
        this.getStorage().setItem(storageKey, JSON.stringify(encrypted));
      } else {
        this.getStorage().setItem(storageKey, JSON.stringify(session));
      }
    } catch (error) {
      debug.warn('Failed to save session:', error);
      // Don't throw - persistence is not critical
    }
  }

  /**
   * Load a session from persistent storage
   */
  async loadSession(address: string): Promise<PersistedSession | null> {
    if (!this.config.enabled) return null;

    try {
      const storageKey = this.getStorageKey(address);
      const stored = this.getStorage().getItem(storageKey);

      if (!stored) return null;

      const parsed = JSON.parse(stored);

      let session: PersistedSession;
      if (this.config.encryptionEnabled && 'data' in parsed) {
        session = await this.decryptSession(parsed as EncryptedPersistedSession, address);
      } else {
        session = parsed as PersistedSession;
      }

      if (this.isSessionExpired(session)) {
        await this.clearSession(address);
        return null;
      }

      return session;
    } catch (error) {
      debug.warn('Failed to load session:', error);
      await this.clearSession(address);
      return null;
    }
  }

  /**
   * Clear a specific session from storage
   */
  async clearSession(address: string): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const storageKey = this.getStorageKey(address);
      this.getStorage().removeItem(storageKey);
    } catch (error) {
      debug.warn('Failed to clear session:', error);
    }
  }

  /**
   * Clear all expired sessions
   */
  async clearExpiredSessions(): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const storage = this.getStorage();
      const keysToRemove: string[] = [];

      for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);
        if (key?.startsWith(this.config.keyPrefix)) {
          try {
            const stored = storage.getItem(key);
            if (stored) {
              const parsed = JSON.parse(stored);
              // Check expiration from either encrypted or plain format
              const expiresAt = parsed.expiresAt || parsed.data?.expiresAt;
              if (expiresAt && new Date(expiresAt) < new Date()) {
                keysToRemove.push(key);
              }
            }
          } catch {
            // Remove malformed entries
            keysToRemove.push(key);
          }
        }
      }

      keysToRemove.forEach(key => storage.removeItem(key));
    } catch (error) {
      debug.warn('Failed to clear expired sessions:', error);
    }
  }

  /**
   * Check if session persistence is available
   */
  isAvailable(): boolean {
    try {
      const storage = this.getStorage();
      const testKey = `${this.config.keyPrefix}_test`;
      storage.setItem(testKey, 'test');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Encrypt session data
   */
  private async encryptSession(session: PersistedSession): Promise<EncryptedPersistedSession> {
    if (!crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    // Derive encryption key from address only
    const keyMaterial = await this.deriveKeyMaterial(session.address);
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    // Generate random IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt session data
    const sessionData = new TextEncoder().encode(JSON.stringify(session));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      sessionData
    );

    return {
      data: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv),
      version: session.version,
      expiresAt: session.expiresAt,
    };
  }

  /**
   * Decrypt session data
   */
  private async decryptSession(
    encrypted: EncryptedPersistedSession,
    address: string
  ): Promise<PersistedSession> {
    if (!crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    // Derive the same encryption key
    const keyMaterial = await this.deriveKeyMaterial(address);
    const key = await crypto.subtle.importKey(
      'raw',
      keyMaterial,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Decrypt data
    const encryptedData = this.base64ToArrayBuffer(encrypted.data);
    const iv = this.base64ToArrayBuffer(encrypted.iv);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encryptedData
    );

    const sessionJson = new TextDecoder().decode(decrypted);
    return JSON.parse(sessionJson);
  }

  /**
   * Derive encryption key material from address only
   */
  private async deriveKeyMaterial(address: string): Promise<ArrayBuffer> {
    if (!crypto.subtle) {
      throw new Error('Web Crypto API not available');
    }

    // Create deterministic key material from address + domain only
    const domain = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const keySource = `${address.toLowerCase()}_${domain}`;
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keySource);

    // Use PBKDF2 for key derivation
    const importedKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );

    // Salt with domain to prevent cross-site access
    const salt = encoder.encode(`tinycloud_salt_${domain}`);

    return await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 10000,
        hash: 'SHA-256',
      },
      importedKey,
      256 // 32 bytes for AES-256
    );
  }

  /**
   * Generate storage key for a specific address
   */
  private getStorageKey(address: string): string {
    return `${this.config.keyPrefix}_${address.toLowerCase()}`;
  }

  /**
   * Get the appropriate storage implementation
   */
  private getStorage(): Storage {
    const storage = this.config.storage === 'localStorage' ? localStorage : sessionStorage;
    if (!storage) {
      throw new Error(`${this.config.storage} is not available`);
    }
    return storage;
  }

  /**
   * Check if a session has expired
   */
  private isSessionExpired(session: PersistedSession): boolean {
    return new Date(session.expiresAt) < new Date();
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const binary = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}
