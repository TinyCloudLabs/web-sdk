import { createPublicClient, encodeFunctionData, http, type Address } from "viem";
import { multiaddrToUri } from "@multiformats/multiaddr-to-uri";
import { TCWProviderWeb3 } from "@tinycloudlabs/web-core/client";
import { providers } from "ethers";
const REGISTRY_ABI = [
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "getNode",
    outputs: [{ internalType: "string", name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "account", type: "address" }],
    name: "hasNode",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;
export const REGISTRY_CONTRACT_ADDRESS = {
  1: "0xbA1bf1B4C72d779f3dd21a8f29a70A82fD4dc3B7",
  11155111: "0x89e5DEc611f357b7274B3d74fF3E2e03075ec1F8"
}
export interface RegistryConfig {
  provider: providers.Web3Provider;
}

/**
 * Registry provides access to the TinyCloud Registry contract for resolving
 * account addresses to their associated node identifiers.
 */
export class Registry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: providers.Web3Provider;
  /**
   * Creates a new instance of the Registry class.
   *
   * @param config - Configuration options for the Registry
   * @param config.rpcUrl - The RPC URL to connect to the blockchain
   * @param config.contractAddress - The address of the Registry contract
   */
  constructor(config: RegistryConfig) {
    this.provider = config.provider;
  }

  /**
   * Gets the node identifier associated with an account address.
   *
   * @param account - The account address to look up
   * @returns A Promise containing the node identifier string
   *
   * @example
   * ```ts
   * const registry = new Registry({
   *   rpcUrl: 'https://mainnet.base.org',
   *   contractAddress: '0x...'
   * });
   * const node = await registry.getNode('0x1234...');
   * console.log(node); // 'my-node-id'
   * ```
   */
  async getNode(account: Address): Promise<string> {
    const chainId = await this.provider.getSigner().getChainId();
    const contractAddress = REGISTRY_CONTRACT_ADDRESS[chainId];
    const node = await this.provider.call({
      data: encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "getNode",
        args: [account]
      }),
      chainId,
      to: contractAddress
    });
    return multiaddrToUri(node);
  }

  async addressNode(): Promise<string> {
    const address = await this.provider.getSigner().getAddress();
    const node = await this.getNode(address as `0x${string}`);
    return multiaddrToUri(node);
  }





  /**
   * Checks if an account has a registered node.
   *
   * @param account - The account address to check
   * @returns A Promise containing a boolean indicating if the account has a node
   *
   * @example
   * ```ts
   * const hasNode = await registry.hasNode('0x1234...');
   * if (hasNode) {
   *   const node = await registry.getNode('0x1234...');
   * }
   * ```
   */
  async hasNode(account: Address): Promise<boolean> {
    const chainId = await this.provider.getSigner().getChainId();
    const contractAddress = REGISTRY_CONTRACT_ADDRESS[chainId];
    const result = await this.provider.call({
      data: encodeFunctionData({
        abi: REGISTRY_ABI,
        functionName: "hasNode",
        args: [account]
      }),
      chainId,
      to: contractAddress
    });
    return !!result;
  }
}

export default Registry;
