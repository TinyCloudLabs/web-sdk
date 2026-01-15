import { createPublicClient, http, type Address } from "viem";

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

export interface RegistryConfig {
  rpcUrl: string;
  contractAddress: Address;
}

/**
 * Registry provides access to the TinyCloud Registry contract for resolving
 * account addresses to their associated node identifiers.
 */
export class Registry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private client: any;
  private contractAddress: Address;

  /**
   * Creates a new instance of the Registry class.
   *
   * @param config - Configuration options for the Registry
   * @param config.rpcUrl - The RPC URL to connect to the blockchain
   * @param config.contractAddress - The address of the Registry contract
   */
  constructor(config: RegistryConfig) {
    this.contractAddress = config.contractAddress;
    this.client = createPublicClient({
      transport: http(config.rpcUrl),
    });
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
    const node = await this.client.readContract({
      address: this.contractAddress,
      abi: REGISTRY_ABI,
      functionName: "getNode",
      args: [account],
    });
    return node;
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
    const result = await this.client.readContract({
      address: this.contractAddress,
      abi: REGISTRY_ABI,
      functionName: "hasNode",
      args: [account],
    });
    return result;
  }
}

export default Registry;
