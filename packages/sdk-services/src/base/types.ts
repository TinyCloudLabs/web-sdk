/**
 * Base Service Types
 *
 * Types specific to the base service infrastructure.
 */

import {
  IService,
  IServiceContext,
  ServiceSession,
} from "../types";

/**
 * Service constructor type for registration.
 * Used by the SDK to instantiate services.
 */
export interface ServiceConstructor<
  TConfig = Record<string, unknown>,
  TService extends IService = IService
> {
  /** Service identifier used for registration */
  readonly serviceName: string;
  /** Create a new instance of the service */
  new (config?: TConfig): TService;
}

/**
 * Service registration entry.
 */
export interface ServiceRegistration {
  /** The service class constructor */
  constructor: ServiceConstructor;
  /** Configuration for this service instance */
  config?: Record<string, unknown>;
}

/**
 * Options for base service operations.
 */
export interface BaseServiceOptions {
  /** Override the default timeout for this operation */
  timeout?: number;
  /** Custom abort signal for this operation */
  signal?: AbortSignal;
}

// Re-export common types for convenience
export type { IService, IServiceContext, ServiceSession };
