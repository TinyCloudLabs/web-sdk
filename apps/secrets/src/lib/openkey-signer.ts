import type { OpenKey } from '@openkey/sdk';

/**
 * Adapter that bridges OpenKey widget signing to the signer interface
 * that vault.unlock() expects.
 */
export class OpenKeyVaultSigner {
  private openkey: OpenKey;
  private keyId: string;

  constructor(openkey: OpenKey, keyId: string) {
    this.openkey = openkey;
    this.keyId = keyId;
  }

  async signMessage(message: string): Promise<string> {
    const result = await this.openkey.signMessage({
      message,
      keyId: this.keyId,
    });
    return result.signature;
  }
}
