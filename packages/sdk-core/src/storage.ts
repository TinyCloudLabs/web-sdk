/**
 * Session storage types and interfaces.
 *
 * Types are derived from Zod schemas in storage.schema.ts.
 *
 * @packageDocumentation
 */

// Re-export types from schema (source of truth)
export {
  // Types
  type PersistedTinyCloudSession,
  type TinyCloudSession,
  type PersistedSessionData,
  type EnsData,
  type ValidationError,
  // Schemas (for advanced use cases)
  PersistedTinyCloudSessionSchema,
  TinyCloudSessionSchema,
  PersistedSessionDataSchema,
  EnsDataSchema,
  // Validation functions
  validatePersistedSessionData,
  validateTinyCloudSession,
  validatePersistedTinyCloudSession,
} from "./storage.schema";

// Import types for use in this file
import type { PersistedSessionData } from "./storage.schema";

/**
 * Session storage interface.
 *
 * Abstracts how sessions are persisted across different platforms.
 * - Browser: localStorage
 * - Node.js: file system or memory
 */
export interface ISessionStorage {
  /**
   * Save a session for an address.
   * @param address - Ethereum address (key for lookup)
   * @param session - Session data to persist
   */
  save(address: string, session: PersistedSessionData): Promise<void>;

  /**
   * Load a session for an address.
   * @param address - Ethereum address
   * @returns Session data or null if not found
   */
  load(address: string): Promise<PersistedSessionData | null>;

  /**
   * Clear a session for an address.
   * @param address - Ethereum address
   */
  clear(address: string): Promise<void>;

  /**
   * Check if a session exists for an address (synchronous check).
   * @param address - Ethereum address
   * @returns true if session exists
   */
  exists(address: string): boolean;

  /**
   * Check if the storage backend is available.
   * @returns true if storage can be used
   */
  isAvailable(): boolean;
}
