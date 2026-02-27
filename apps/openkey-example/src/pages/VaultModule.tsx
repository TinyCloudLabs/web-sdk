import { useState, useCallback } from 'react';
import { TinyCloudWeb } from '@tinycloud/web-sdk';
import { providers } from 'ethers';
import Input from '../components/Input';
import Button from '../components/Button';

interface IVaultModule {
  tcw: TinyCloudWeb;
  web3Provider: providers.Web3Provider;
}

/**
 * VaultModule demonstrates the Data Vault (encrypted KV) API.
 *
 * Features:
 * - Unlock vault (derives encryption keys from wallet signature)
 * - Put: encrypt and store data
 * - Get: retrieve and decrypt data
 * - List: list vault keys
 * - Delete: remove encrypted data
 * - Head: view metadata without decrypting
 */
function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) {
    const msg = (err as { message: unknown }).message;
    return typeof msg === 'string' ? msg : JSON.stringify(err);
  }
  return JSON.stringify(err);
}

function VaultModule({ tcw, web3Provider }: IVaultModule) {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Key list
  const [keys, setKeys] = useState<string[]>([]);
  const [listLoading, setListLoading] = useState(false);

  // Put form
  const [putKey, setPutKey] = useState('');
  const [putValue, setPutValue] = useState('');
  const [putLoading, setPutLoading] = useState(false);

  // Get result
  const [getResult, setGetResult] = useState<string | null>(null);
  const [getLoading, setGetLoading] = useState(false);

  // Head result
  const [headResult, setHeadResult] = useState<string | null>(null);

  const clearMessages = () => {
    setError(null);
    setSuccess(null);
  };

  // === Unlock ===
  const handleUnlock = useCallback(async () => {
    setUnlocking(true);
    clearMessages();

    try {
      const signer = web3Provider.getSigner();
      const result = await tcw.vault.unlock(signer);
      if (result.ok) {
        setIsUnlocked(true);
        setSuccess('Vault unlocked. Encryption keys derived from wallet signature.');
      } else {
        console.error('[Vault] Unlock failed:', result.error);
        setError(`Unlock failed: ${formatError(result.error)}`);
      }
    } catch (err) {
      console.error('[Vault] Unlock error:', err);
      setError(`Unlock error: ${formatError(err)}`);
    }

    setUnlocking(false);
  }, [tcw, web3Provider]);

  // === List ===
  const handleList = useCallback(async () => {
    setListLoading(true);
    clearMessages();

    const result = await tcw.vault.list();
    if (result.ok) {
      setKeys(result.data);
    } else {
      console.error('[Vault] List failed:', result.error);
      setError(`List failed: ${formatError(result.error)}`);
    }

    setListLoading(false);
  }, [tcw]);

  // === Put ===
  const handlePut = useCallback(async () => {
    if (!putKey || !putValue) {
      setError('Key and value are required.');
      return;
    }

    setPutLoading(true);
    clearMessages();

    // Try to parse as JSON, fall back to raw string
    let value: unknown;
    try {
      value = JSON.parse(putValue);
    } catch {
      value = putValue;
    }

    const result = await tcw.vault.put(putKey, value);
    if (result.ok) {
      setSuccess(`Encrypted and stored: ${putKey}`);
      setPutKey('');
      setPutValue('');
      handleList();
    } else {
      console.error('[Vault] Put failed:', result.error);
      setError(`Put failed: ${formatError(result.error)}`);
    }

    setPutLoading(false);
  }, [tcw, putKey, putValue, handleList]);

  // === Get ===
  const handleGet = useCallback(async (key: string) => {
    setGetLoading(true);
    clearMessages();
    setGetResult(null);
    setHeadResult(null);

    const result = await tcw.vault.get(key);
    if (result.ok) {
      const valueStr = typeof result.data.value === 'string'
        ? result.data.value
        : JSON.stringify(result.data.value, null, 2);
      setGetResult(`Key: ${key}\nKey ID: ${result.data.keyId}\nValue: ${valueStr}`);
    } else {
      console.error('[Vault] Get failed:', result.error);
      setError(`Get failed: ${formatError(result.error)}`);
    }

    setGetLoading(false);
  }, [tcw]);

  // === Delete ===
  const handleDelete = useCallback(async (key: string) => {
    clearMessages();

    const result = await tcw.vault.delete(key);
    if (result.ok) {
      setSuccess(`Deleted: ${key}`);
      setKeys(prev => prev.filter(k => k !== key));
      setGetResult(null);
      setHeadResult(null);
    } else {
      console.error('[Vault] Delete failed:', result.error);
      setError(`Delete failed: ${formatError(result.error)}`);
    }
  }, [tcw]);

  // === Head ===
  const handleHead = useCallback(async (key: string) => {
    clearMessages();
    setHeadResult(null);
    setGetResult(null);

    const result = await tcw.vault.head(key);
    if (result.ok) {
      setHeadResult(JSON.stringify(result.data, null, 2));
    } else {
      console.error('[Vault] Head failed:', result.error);
      setError(`Head failed: ${formatError(result.error)}`);
    }
  }, [tcw]);

  return (
    <div className="w-full">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xl font-heading text-text">Data Vault (Encrypted KV)</h3>
          <p className="text-sm text-text/70">
            Client-side encrypted storage. Data is encrypted before leaving your device
            using AES-256-GCM with keys derived from your wallet signature.
          </p>
        </div>

        {error && (
          <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-base border-2 border-green-300 bg-green-50 p-3">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Unlock Section */}
        {!isUnlocked ? (
          <div className="space-y-4">
            <div className="rounded-base border-2 border-dashed border-border/50 bg-bw/50 p-6 text-center">
              <p className="text-text/70 mb-4">
                Vault is locked. Unlock to derive encryption keys from your wallet.
              </p>
              <Button
                variant="default"
                onClick={handleUnlock}
                loading={unlocking}
              >
                Unlock Vault
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-base border border-green-200">
              <span>Vault is unlocked</span>
            </div>

            <div className="h-px w-full bg-border/20" />

            {/* Put Section */}
            <div className="space-y-4">
              <h4 className="text-lg font-heading text-text">Store Encrypted Data</h4>
              <Input
                label="Key"
                value={putKey}
                onChange={setPutKey}
                className="w-full"
              />
              <Input
                label="Value"
                value={putValue}
                onChange={setPutValue}
                className="w-full"
                helperText="JSON or plain text. Will be encrypted before storage."
              />
              <Button
                variant="default"
                onClick={handlePut}
                loading={putLoading}
                className="w-full"
              >
                Encrypt & Store
              </Button>
            </div>

            <div className="h-px w-full bg-border/20" />

            {/* List Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-heading text-text">Vault Keys</h4>
                <Button
                  variant="neutral"
                  size="sm"
                  onClick={handleList}
                  loading={listLoading}
                >
                  Refresh
                </Button>
              </div>

              {keys.length === 0 ? (
                <div className="rounded-base border-2 border-dashed border-border/50 bg-bw/50 p-8 text-center">
                  <p className="text-text/70">No vault keys. Store something to get started.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {keys.map(key => (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-base border-2 border-border/30 bg-bw p-3"
                    >
                      <div className="font-mono text-sm text-text truncate mr-3">{key}</div>
                      <div className="flex space-x-2 flex-shrink-0">
                        <Button variant="neutral" size="sm" onClick={() => handleGet(key)} loading={getLoading}>
                          Get
                        </Button>
                        <Button variant="neutral" size="sm" onClick={() => handleHead(key)}>
                          Head
                        </Button>
                        <Button variant="neutral" size="sm" onClick={() => handleDelete(key)}>
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Get Result */}
            {getResult && (
              <div className="rounded-base border-2 border-border/30 bg-bw p-4">
                <h4 className="text-sm font-heading text-text mb-2">Decrypted Value</h4>
                <pre className="text-sm text-text/80 font-mono whitespace-pre-wrap break-all bg-bg p-3 rounded">
                  {getResult}
                </pre>
              </div>
            )}

            {/* Head Result */}
            {headResult && (
              <div className="rounded-base border-2 border-border/30 bg-bw p-4">
                <h4 className="text-sm font-heading text-text mb-2">Metadata (Head)</h4>
                <pre className="text-sm text-text/80 font-mono whitespace-pre-wrap break-all bg-bg p-3 rounded">
                  {headResult}
                </pre>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default VaultModule;
