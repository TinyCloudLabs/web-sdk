import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TinyCloudWeb, PortableDelegation, DelegatedAccess, deserializeDelegation } from '@tinycloud/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';
import Header from '../components/Header';
import Footer from '../components/Footer';

/**
 * Decode a base64url token to JSON string.
 */
function decodeBase64Url(token: string): string {
  // Decode base64url
  let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return atob(base64);
}

/**
 * Parse a delegation token from URL.
 * Handles base64url encoding used in URL transport.
 */
function parseDelegationToken(token: string): PortableDelegation {
  const json = decodeBase64Url(token);
  return deserializeDelegation(json);
}

/**
 * Delegate page for receiving delegations from URLs.
 *
 * URL format: /delegate?token=<base64-encoded-delegation>
 *
 * This page allows session-only users to receive delegations without a wallet.
 */
function Delegate() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [token, setToken] = useState<string>(searchParams.get('token') || '');
  const [delegation, setDelegation] = useState<PortableDelegation | null>(null);
  const [tcw, setTcw] = useState<TinyCloudWeb | null>(null);
  const [access, setAccess] = useState<DelegatedAccess | null>(null);
  const [isActivated, setIsActivated] = useState<boolean>(false);
  const [keys, setKeys] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keyValue, setKeyValue] = useState<string>('');
  const [newKey, setNewKey] = useState<string>('');
  const [newValue, setNewValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Parse token on mount or when token changes
  useEffect(() => {
    if (token) {
      try {
        const parsed = parseDelegationToken(token);
        setDelegation(parsed);
        setError(null);
      } catch (err) {
        console.error('Failed to parse delegation token:', err);
        setError('Invalid delegation token format');
        setDelegation(null);
      }
    }
  }, [token]);

  const handleActivate = async () => {
    if (!delegation) return;

    setLoading(true);
    setError(null);

    try {
      // Create TinyCloudWeb in session-only mode (new auth)
      const tcwInstance = new TinyCloudWeb({
        useNewAuth: true,
      });

      // The session DID is available immediately
      console.log('Session DID:', tcwInstance.sessionDid);
      console.log('Delegation targets:', delegation.delegateDID);

      // Use the delegation to get access to the shared space
      const delegatedAccess = await tcwInstance.useDelegation(delegation);

      // Store the TCW and DelegatedAccess instances
      setTcw(tcwInstance);
      setAccess(delegatedAccess);
      setIsActivated(true);

      // List keys in the delegated path
      await loadKeys(delegatedAccess);
    } catch (err) {
      console.error('Failed to activate delegation:', err);
      setError(`Failed to activate: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  };

  const loadKeys = async (delegatedAccess: DelegatedAccess) => {
    if (!delegation) return;

    try {
      // List keys at the delegated path
      const result = await delegatedAccess.kv.list();
      if (result.ok) {
        setKeys(result.data.keys);
        console.log('Loaded keys from delegated space:', result.data.keys);
      } else {
        console.error('Failed to list keys:', result.error);
        setKeys([]);
      }
    } catch (err) {
      console.error('Failed to load keys:', err);
      setKeys([]);
    }
  };

  const handleGetKey = async (key: string) => {
    if (!access || !delegation) return;
    setError(null);

    try {
      const result = await access.kv.get(key);
      if (result.ok) {
        setSelectedKey(key);
        setKeyValue(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
      } else {
        setError(`Failed to get key: ${result.error.message}`);
      }
    } catch (err) {
      console.error('Failed to get key:', err);
      setError(`Failed to get key: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePutKey = async () => {
    if (!access || !delegation || !newKey || !newValue) return;
    setError(null);
    setLoading(true);

    try {
      const result = await access.kv.put(newKey, newValue);
      if (result.ok) {
        console.log('Successfully put key:', newKey);
        setNewKey('');
        setNewValue('');
        // Refresh keys list
        await loadKeys(access);
      } else {
        setError(`Failed to put key: ${result.error.message}`);
      }
    } catch (err) {
      console.error('Failed to put key:', err);
      setError(`Failed to put key: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  };

  const formatExpiry = (expiry: Date | string) => {
    const date = expiry instanceof Date ? expiry : new Date(expiry);
    return date.toLocaleString();
  };

  const formatActions = (actions: string[]) => {
    return actions.map(a => a.split('/')[1]).join(', ');
  };

  const isExpired = delegation && new Date(delegation.expiry) < new Date();

  return (
    <>
      <Header />
      <div className="flex min-h-screen flex-col items-center bg-bg pt-20">
        <div className="w-full max-w-4xl px-4 mb-6">
          <div className="mx-auto max-w-2xl rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-heading text-text">Receive Delegation</h2>
                <p className="text-sm text-text/70">
                  This page allows you to receive a delegation and access shared resources.
                </p>
              </div>

              {error && (
                <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {!isActivated ? (
                <>
                  {/* Token Input */}
                  <div className="space-y-4">
                    <Input
                      label="Delegation Token"
                      value={token}
                      onChange={setToken}
                      className="w-full"
                    />
                  </div>

                  {/* Delegation Info */}
                  {delegation && (
                    <div className="space-y-3 p-4 rounded-base border-2 border-border/30 bg-bw">
                      <h4 className="text-md font-heading text-text">Delegation Details</h4>

                      {isExpired && (
                        <div className="rounded-base border-2 border-yellow-300 bg-yellow-50 p-3">
                          <p className="text-sm text-yellow-800">
                            This delegation has expired and cannot be used.
                          </p>
                        </div>
                      )}

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-text/70">Delegator:</span>
                          <span className="font-mono truncate max-w-[200px]" title={delegation.delegatorDID}>
                            {delegation.delegatorDID?.substring(0, 25)}...
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text/70">Space:</span>
                          <span className="font-mono truncate max-w-[200px]" title={delegation.spaceId}>
                            {delegation.spaceId.substring(0, 25)}...
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text/70">Path:</span>
                          <span className="font-mono">{delegation.path || '/'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text/70">Actions:</span>
                          <span>{formatActions(delegation.actions)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text/70">Expires:</span>
                          <span className={isExpired ? 'text-red-600' : ''}>
                            {formatExpiry(delegation.expiry)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activate Button */}
                  {(!delegation || isExpired) ? (
                    <Button
                      variant="neutral"
                      onClick={() => {}}
                      className="w-full opacity-50 cursor-not-allowed"
                    >
                      Activate Delegation
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      onClick={handleActivate}
                      loading={loading}
                      className="w-full"
                    >
                      Activate Delegation
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {/* Activated State */}
                  <div className="space-y-3 p-4 rounded-base border-2 border-green-300 bg-green-50">
                    <h4 className="text-md font-heading text-green-800">Delegation Activated</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-green-700">Your DID:</span>
                        <span className="font-mono text-green-900 truncate max-w-[200px]" title={tcw?.sessionDid}>
                          {tcw?.sessionDid.substring(0, 25)}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Delegator:</span>
                        <span className="font-mono text-green-900 truncate max-w-[200px]">
                          {delegation?.delegatorDID?.substring(0, 25)}...
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Path:</span>
                        <span className="font-mono text-green-900">{delegation?.path || '/'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-700">Actions:</span>
                        <span className="text-green-900">{formatActions(delegation?.actions || [])}</span>
                      </div>
                    </div>
                  </div>

                  {/* Keys List */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-heading text-text">Delegated Path: {delegation?.path || '/'}</h4>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => access && loadKeys(access)}
                      >
                        Refresh
                      </Button>
                    </div>

                    {keys.length === 0 ? (
                      <div className="rounded-base border-2 border-dashed border-border/50 bg-bw/50 p-8 text-center">
                        <p className="text-text/70">
                          No keys found at this path. Use the form below to add data.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {keys.map(key => (
                          <div
                            key={key}
                            className="flex items-center justify-between rounded-base border-2 border-border/30 bg-bw p-3"
                          >
                            <span className="font-mono text-sm text-text">{key}</span>
                            <Button
                              variant="neutral"
                              size="sm"
                              onClick={() => handleGetKey(key)}
                            >
                              Get
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Selected Key Value */}
                    {selectedKey && (
                      <div className="space-y-2 p-4 rounded-base border-2 border-border/30 bg-bw">
                        <div className="flex items-center justify-between">
                          <h5 className="text-sm font-medium text-text">Value of: {selectedKey}</h5>
                          <Button
                            variant="neutral"
                            size="sm"
                            onClick={() => {
                              setSelectedKey(null);
                              setKeyValue('');
                            }}
                          >
                            Close
                          </Button>
                        </div>
                        <pre className="text-xs font-mono bg-bw/50 p-3 rounded-base border border-border/20 overflow-auto max-h-40">
                          {keyValue}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Write New Key (if write permission) */}
                  {delegation?.actions.some(a => a.includes('/put')) && (
                    <div className="space-y-3 p-4 rounded-base border-2 border-border/30 bg-bw">
                      <h4 className="text-md font-heading text-text">Write New Key</h4>
                      <Input
                        label="Key"
                        value={newKey}
                        onChange={setNewKey}
                        className="w-full"
                      />
                      <Input
                        label="Value"
                        value={newValue}
                        onChange={setNewValue}
                        className="w-full"
                      />
                      <Button
                        variant="default"
                        onClick={handlePutKey}
                        loading={loading}
                        className="w-full"
                      >
                        Put Key
                      </Button>
                    </div>
                  )}

                  {/* Back Button */}
                  <Button
                    variant="neutral"
                    onClick={() => navigate('/')}
                    className="w-full"
                  >
                    Back to Home
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
        <Footer />
      </div>
    </>
  );
}

export default Delegate;
