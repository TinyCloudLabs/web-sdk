import { OpenKey, OpenKeyEIP1193Provider } from '@openkey/sdk';
import { TinyCloudWeb } from '@tinycloud/web-sdk';
import { OpenKeyVaultSigner } from './openkey-signer';

const TINYCLOUD_HOST = 'https://node.tinycloud.xyz';
const OPENKEY_URL = 'https://openkey.so';

let openkey: OpenKey | null = null;
let tc: any | null = null;

export function getOpenKey(): OpenKey {
  if (!openkey) {
    openkey = new OpenKey({ baseUrl: OPENKEY_URL });
  }
  return openkey;
}

export interface ConnectResult {
  address: string;
  keyId: string;
}

export async function connect(): Promise<ConnectResult> {
  const ok = getOpenKey();
  const result = await ok.connect();
  return {
    address: result.address,
    keyId: result.keyId,
  };
}

export async function initAndUnlock(keyId: string, authResult: ConnectResult): Promise<any> {
  const ok = getOpenKey();

  // Create EIP-1193 provider from OpenKey
  const provider = new OpenKeyEIP1193Provider(ok, authResult);

  // Initialize TinyCloudWeb
  tc = new TinyCloudWeb({
    host: TINYCLOUD_HOST,
    provider,
    prefix: 'secrets',
    autoCreateSpace: true,
  });

  await tc.signIn();

  // Create signer and unlock vault
  const signer = new OpenKeyVaultSigner(ok, keyId);
  const unlockResult = await tc.vault.unlock(signer);
  if (!unlockResult.ok) {
    throw new Error(`Vault unlock failed: ${(unlockResult as any).error?.message}`);
  }

  return tc;
}

export function getTinyCloud(): any | null {
  return tc;
}
