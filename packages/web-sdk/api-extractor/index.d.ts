/**
 * A set of tools and utilities to help you build your app with TinyCloud
 * @packageDocumentation
 */

export * from '../dist/tcw';
export * from '../dist/modules';
export * from '../dist/index';

/**
 * Re-exported from siwe for Sign-in with Ethereum message
 * @public
 */
export interface SiweMessage {
  domain: string;
  address: string;
  statement?: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}