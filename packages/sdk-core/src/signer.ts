/**
 * Bytes representation as an array of integers.
 */
export type Bytes = ArrayLike<number>;

/**
 * Platform-agnostic signer interface.
 *
 * This interface defines the minimal signing capabilities required by TinyCloud.
 * It can be implemented by browser wallets (via ethers.js Signer), private key
 * signers in Node.js, or hardware wallets.
 */
export interface ISigner {
  /**
   * Returns the account address.
   */
  getAddress(): Promise<string>;

  /**
   * Returns the chain ID that this signer is connected to.
   */
  getChainId(): Promise<number>;

  /**
   * Signs a message and returns the signature.
   * @param message - The message to sign (string or bytes)
   * @returns The signature as a hex string (format: "0x<65 bytes>")
   */
  signMessage(message: Bytes | string): Promise<string>;
}
