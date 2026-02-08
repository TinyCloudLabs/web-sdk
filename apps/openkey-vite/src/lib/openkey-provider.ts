import type { OpenKey } from "@openkey/sdk";

/**
 * EIP-1193 compatible provider that routes signing to OpenKey.
 * TinyCloudWeb treats this like any browser wallet.
 */
export class OpenKeyEIP1193Provider {
  private openkey: OpenKey;
  private address: string;
  private keyId: string;

  constructor(openkey: OpenKey, authResult: { address: string; keyId: string }) {
    this.openkey = openkey;
    this.address = authResult.address;
    this.keyId = authResult.keyId;
  }

  async request({
    method,
    params,
  }: {
    method: string;
    params?: any[];
  }): Promise<any> {
    switch (method) {
      case "eth_accounts":
      case "eth_requestAccounts":
        return [this.address];
      case "eth_chainId":
        return "0x1";
      case "personal_sign": {
        // EIP-1193: params[0] = hex message, params[1] = address
        const hexMessage = params![0];
        const message = hexToString(hexMessage);
        const result = await this.openkey.signMessage({
          message,
          keyId: this.keyId,
        });
        return result.signature;
      }
      case "eth_getBalance":
        return "0x0";
      default:
        throw new Error(`Unsupported method: ${method}`);
    }
  }
}

function hexToString(hex: string): string {
  const cleaned = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(
    cleaned.match(/.{1,2}/g)!.map((b) => parseInt(b, 16))
  );
  return new TextDecoder().decode(bytes);
}
