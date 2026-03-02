import { useState } from 'react';
import { TinyCloudWeb, TinyCloud, makePublicSpaceId } from '@tinycloud/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';

interface IPublicSpaceModule {
  tcw: TinyCloudWeb | null;
  tinyCloudHost: string;
}

/**
 * PublicSpaceModule demonstrates the public space API.
 *
 * - Read public data: Enter an Ethereum address and read their public space data
 *   using TinyCloud.readPublicKey() (static, no auth needed).
 * - Write to public space: After sign-in, write data to the user's own public space.
 */
function PublicSpaceModule({ tcw, tinyCloudHost }: IPublicSpaceModule) {
  // Read section state
  const [readAddress, setReadAddress] = useState<string>('');
  const [readChainId, setReadChainId] = useState<string>('1');
  const [readKey, setReadKey] = useState<string>('');
  const [readResult, setReadResult] = useState<string | null>(null);
  const [readLoading, setReadLoading] = useState<boolean>(false);
  const [readError, setReadError] = useState<string | null>(null);

  // Write section state
  const [writeKey, setWriteKey] = useState<string>('');
  const [writeValue, setWriteValue] = useState<string>('');
  const [writeLoading, setWriteLoading] = useState<boolean>(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [writeSuccess, setWriteSuccess] = useState<string | null>(null);

  const getHost = (): string => {
    return tinyCloudHost.trim() || 'https://node.tinycloud.xyz';
  };

  // --- Read Public Data ---

  const handleReadPublicKey = async () => {
    if (!readAddress || !readKey) {
      setReadError('Address and key are required.');
      return;
    }

    const chainId = parseInt(readChainId, 10);
    if (isNaN(chainId)) {
      setReadError('Chain ID must be a number.');
      return;
    }

    setReadLoading(true);
    setReadError(null);
    setReadResult(null);

    const result = await TinyCloud.readPublicKey(
      getHost(),
      readAddress,
      chainId,
      readKey
    );

    if (result.ok) {
      setReadResult(
        typeof result.data === 'string'
          ? result.data
          : JSON.stringify(result.data, null, 2)
      );
    } else {
      setReadError(`${result.error.code}: ${result.error.message}`);
    }

    setReadLoading(false);
  };

  const handleLookupSpaceId = () => {
    if (!readAddress) return;
    const chainId = parseInt(readChainId, 10);
    if (isNaN(chainId)) return;
    const spaceId = makePublicSpaceId(readAddress, chainId);
    setReadResult(`Public Space ID: ${spaceId}`);
    setReadError(null);
  };

  // --- Write to Public Space ---

  const handleWritePublicKey = async () => {
    if (!tcw || !tcw.session()) {
      setWriteError('Must be signed in to write to public space.');
      return;
    }

    if (!writeKey) {
      setWriteError('Key is required.');
      return;
    }

    if (writeKey.includes(' ')) {
      setWriteError('Key must not contain spaces.');
      return;
    }

    setWriteLoading(true);
    setWriteError(null);
    setWriteSuccess(null);

    try {
      // Get the public space via the spaces service
      const publicSpace = tcw.space('public');
      let value: unknown;
      try {
        value = JSON.parse(writeValue);
      } catch {
        value = writeValue;
      }

      const result = await publicSpace.kv.put(writeKey, value);

      if (result.ok) {
        setWriteSuccess(`Successfully wrote to public/${writeKey}`);
        setWriteKey('');
        setWriteValue('');
      } else {
        setWriteError(`${result.error.code}: ${result.error.message}`);
      }
    } catch (err) {
      setWriteError(
        `Error: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    setWriteLoading(false);
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        {/* Section: Read Public Data */}
        <div className="space-y-3">
          <h3 className="text-xl font-heading text-text">Read Public Data</h3>
          <p className="text-sm text-text/70">
            Read anyone's public space data without authentication.
            Enter an Ethereum address and key to look up.
          </p>
        </div>

        <div className="space-y-4">
          <Input
            label="Ethereum Address"
            value={readAddress}
            onChange={setReadAddress}
            className="w-full"
            placeholder="0x..."
            helperText="The address whose public space you want to read"
          />
          <div className="flex gap-4">
            <Input
              label="Chain ID"
              value={readChainId}
              onChange={setReadChainId}
              className="w-32"
              placeholder="1"
              helperText="e.g. 1 for mainnet"
            />
            <Input
              label="Key"
              value={readKey}
              onChange={setReadKey}
              className="flex-1"
              placeholder="well-known/profile"
              helperText="The key to read from the public space"
            />
          </div>

          <div className="flex space-x-3">
            <Button
              variant="default"
              onClick={handleReadPublicKey}
              loading={readLoading}
              className="flex-1"
            >
              Read Public Key
            </Button>
            <Button
              variant="neutral"
              onClick={handleLookupSpaceId}
              className="flex-1"
            >
              Lookup Space ID
            </Button>
          </div>
        </div>

        {readError && (
          <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
            <p className="text-sm text-red-800">{readError}</p>
          </div>
        )}

        {readResult && (
          <div className="rounded-base border-2 border-border/30 bg-bw p-4">
            <h4 className="text-sm font-heading text-text mb-2">Result</h4>
            <pre className="text-sm text-text/80 font-mono whitespace-pre-wrap break-all bg-bg p-3 rounded">
              {readResult}
            </pre>
          </div>
        )}

        <div className="h-px w-full bg-border/20" />

        {/* Section: Write to Public Space */}
        <div className="space-y-3">
          <h3 className="text-xl font-heading text-text">
            Write to Public Space
          </h3>
          {tcw && tcw.session() ? (
            <p className="text-sm text-text/70">
              Write data to your own public space. This requires authentication.
            </p>
          ) : (
            <div className="rounded-base border-2 border-dashed border-border/50 bg-bw/50 p-4 text-center">
              <p className="text-text/70">
                Sign in to write to your public space.
              </p>
            </div>
          )}
        </div>

        {tcw && tcw.session() && (
          <div className="space-y-4">
            <Input
              label="Key"
              value={writeKey}
              onChange={setWriteKey}
              className="w-full"
              placeholder="well-known/profile"
              helperText="The key to write in your public space"
            />
            <Input
              label="Value"
              value={writeValue}
              onChange={setWriteValue}
              className="w-full"
              placeholder='{"name": "Alice", "bio": "..."}'
              helperText="Value to store (JSON or plain text)"
            />

            <Button
              variant="default"
              onClick={handleWritePublicKey}
              loading={writeLoading}
              className="w-full"
            >
              Write to Public Space
            </Button>

            {writeError && (
              <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
                <p className="text-sm text-red-800">{writeError}</p>
              </div>
            )}

            {writeSuccess && (
              <div className="rounded-base border-2 border-green-300 bg-green-50 p-3">
                <p className="text-sm text-green-800">{writeSuccess}</p>
              </div>
            )}
          </div>
        )}

        {/* Host info */}
        <div className="text-xs text-text/50 font-mono">
          Host: {getHost()}
        </div>
      </div>
    </div>
  );
}

export default PublicSpaceModule;
