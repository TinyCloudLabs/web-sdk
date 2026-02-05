import {
  initialized,
  tinycloud,
  tcwSession,
} from "@tinycloud/web-sdk-wasm";

/**
 * Centralized WASM initialization for the TinyCloud SDK.
 * Ensures WASM modules are loaded before any extension operations.
 */
export class WasmInitializer {
  private static isInitialized = false;
  private static tinycloudModule: any;
  private static sessionManager: any;

  /**
   * Ensures WASM modules are initialized. Safe to call multiple times.
   * @returns Promise resolving to initialized WASM modules
   */
  static async ensureInitialized(): Promise<{
    tinycloudModule: any;
    sessionManager: any;
  }> {
    if (!this.isInitialized) {
      await initialized;
      this.tinycloudModule = tinycloud;
      this.sessionManager = new tcwSession.TCWSessionManager();
      (global as any).tinycloudModule = this.tinycloudModule;
      this.isInitialized = true;
    }

    return {
      tinycloudModule: this.tinycloudModule,
      sessionManager: this.sessionManager,
    };
  }

  /**
   * Gets the initialized WASM modules if available.
   * @returns The WASM modules or null if not initialized
   */
  static getModules(): { tinycloudModule: any; sessionManager: any } | null {
    if (!this.isInitialized) {
      return null;
    }
    return {
      tinycloudModule: this.tinycloudModule,
      sessionManager: this.sessionManager,
    };
  }
}
