import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { TinyCloudWeb, Delegation } from '@tinycloudlabs/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';
import Header from '../components/Header';
import Footer from '../components/Footer';

/**
 * Deserialize a delegation from a URL-safe base64 token.
 */
function deserializeDelegation(token: string): Delegation {
  // Decode base64url
  let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const json = atob(base64);
  const data = JSON.parse(json);
  return {
    ...data,
    expiry: new Date(data.expiry),
    createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
  };
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
  const [delegation, setDelegation] = useState<Delegation | null>(null);
  const [tcw, setTcw] = useState<TinyCloudWeb | null>(null);
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
        const parsed = deserializeDelegation(token);
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

      // Check if the delegation targets our session DID
      // Note: In a real app, you'd want to handle this more gracefully
      if (delegation.delegateDID !== tcwInstance.sessionDid) {
        console.warn(
          `Delegation targets ${delegation.delegateDID} but our DID is ${tcwInstance.sessionDid}`
        );
        setError(
          'This delegation was created for a different user. ' +
          'You may not be able to use it with your current session.'
        );
      }

      // Store the TCW instance
      setTcw(tcwInstance);
      setIsActivated(true);

      // Try to list keys in the delegated path
      await loadKeys(tcwInstance);
    } catch (err) {
      console.error('Failed to activate delegation:', err);
      setError(`Failed to activate: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  };

  const loadKeys = async (tcwInstance: TinyCloudWeb) => {
    if (!delegation) return;

    try {
      // Note: In session-only mode without a full delegation flow,
      // we can't actually access the delegated space.
      // This is a demonstration of what the UI would look like.
      // A full implementation would need useDelegation() support in web-sdk.

      // For now, show an informational message
      setKeys([]);
      console.log('Delegation received. Full access requires useDelegation() support.');
    } catch (err) {
      console.error('Failed to load keys:', err);
    }
  };

  const handleGetKey = async (key: string) => {
    if (!tcw || !delegation) return;
    setError(null);

    try {
      // Placeholder: Would use delegated access to get the key
      setSelectedKey(key);
      setKeyValue('(Value would be loaded via delegated access)');
    } catch (err) {
      console.error('Failed to get key:', err);
      setError(`Failed to get key: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handlePutKey = async () => {
    if (!tcw || !delegation || !newKey || !newValue) return;
    setError(null);
    setLoading(true);

    try {
      // Placeholder: Would use delegated access to put the key
      console.log('Would put key:', newKey, newValue);
      setNewKey('');
      setNewValue('');
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

                  {/* Note about full implementation */}
                  <div className="rounded-base border-2 border-blue-300 bg-blue-50 p-4">
                    <h4 className="text-md font-heading text-blue-800 mb-2">Implementation Note</h4>
                    <p className="text-sm text-blue-700">
                      Full delegation usage requires <code className="bg-blue-100 px-1 rounded">useDelegation()</code> support
                      in the web-sdk, which chains the received delegation with a new session key.
                      This demo shows the UI flow for receiving delegations.
                    </p>
                  </div>

                  {/* Keys List (would be populated with useDelegation) */}
                  <div className="space-y-4">
                    <h4 className="text-lg font-heading text-text">Delegated Path: {delegation?.path}</h4>

                    {keys.length === 0 ? (
                      <div className="rounded-base border-2 border-dashed border-border/50 bg-bw/50 p-8 text-center">
                        <p className="text-text/70">
                          Delegated content would appear here after full integration.
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
                  </div>

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
