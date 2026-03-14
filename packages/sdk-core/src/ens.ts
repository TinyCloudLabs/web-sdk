/**
 * Platform-agnostic ENS resolution interface.
 *
 * Browser implementations use ethers.js provider.
 * Node implementations can use any Ethereum RPC.
 *
 * @packageDocumentation
 */

export interface IENSResolver {
  /** Resolve an ENS name to an Ethereum address */
  resolveAddress(ensName: string): Promise<string | null>;
  /** Reverse-resolve an address to an ENS name */
  resolveName(address: string): Promise<string | null>;
  /** Resolve an ENS name to an avatar URL */
  resolveAvatar?(ensName: string): Promise<string | null>;
}
