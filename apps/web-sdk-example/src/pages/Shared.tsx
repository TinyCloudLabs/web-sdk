import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { TinyCloudWeb } from '@tinycloud/web-sdk';
import Button from '../components/Button';
import Title from '../components/Title';
import Input from '../components/Input';
import Footer from '../components/Footer';

interface ParsedShare {
  key: {
    kid?: string;
    kty: string;
    crv: string;
    x: string;
    d?: string; // private key component
  };
  keyDid: string;
  delegation: {
    cid: string;
    delegateDID: string;
    spaceId: string;
    path: string;
    actions: string[];
    expiry: string;
    isRevoked: boolean;
    authHeader?: string;
    allowSubDelegation?: boolean;
    createdAt?: string;
  };
  path: string;
  host: string;
  spaceId: string;
  version: number;
}

const Shared = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  // Support both 'share' (v2 format) and 'data' (legacy format) query params
  const [shareData, setShareData] = useState(queryParams.get('share') || queryParams.get('data') || "");
  const [fetchedData, setFetchedData]: [any, any] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectedData, setInspectedData] = useState<ParsedShare | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const inspectShareData = useCallback(() => {
    setInspectError(null);
    setInspectedData(null);
    try {
      // Parse the share link - format is "tc1:<base64json>" or just base64
      let encoded = shareData;
      if (encoded.startsWith('tc1:')) {
        encoded = encoded.slice(4);
      }
      // Handle URL encoding
      encoded = decodeURIComponent(encoded);
      // Decode base64
      const decoded = atob(encoded);
      const parsed = JSON.parse(decoded) as ParsedShare;
      setInspectedData(parsed);
    } catch (err) {
      setInspectError(`Failed to parse share link: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [shareData]);

  // Auto-inspect in dev mode when share data is present
  useEffect(() => {
    if (window.__DEV_MODE__ && shareData) {
      inspectShareData();
    }
  }, [shareData, inspectShareData]);

  const fetchShareData = async () => {
    setIsLoading(true);
    setError(null);
    // Use static method to receive v2 share links (no auth required)
    const result = await TinyCloudWeb.receiveShare(shareData);
    if (result.ok) {
      setFetchedData(result.data);
    } else {
      console.error('Failed to retrieve shared content:', result.error.code, result.error.message);
      setError(`Failed to retrieve shared content: ${result.error.message}`);
    }
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg pt-20">
      <div className="w-full max-w-4xl px-4">
        <Title />
        
        <div className="mx-auto max-w-2xl rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
          <div className="space-y-6">
            <h2 className="text-xl font-heading text-text">Shared Content</h2>
            
            <Input
              label="Share Data"
              value={shareData}
              onChange={(value) => setShareData(value)}
              className="w-full"
            />
            
            <div className="flex gap-2">
              <Button
                id="fetchShareData"
                onClick={fetchShareData}
                loading={isLoading}
                variant="default"
                className="flex-1"
              >
                Fetch Shared Content
              </Button>
              <Button
                id="inspectShareData"
                onClick={inspectShareData}
                variant="neutral"
                className="flex-1"
              >
                Inspect
              </Button>
            </div>

            {inspectError && (
              <div className="rounded-base border-2 border-yellow-300 bg-yellow-50 p-3">
                <p className="text-sm text-yellow-800">{inspectError}</p>
              </div>
            )}

            {inspectedData && (
              <div className="mt-4 rounded-base border-2 border-border/30 bg-bw/50 p-4 space-y-4">
                <h3 className="text-lg font-heading text-text">Share Link Components:</h3>

                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold text-text">Host</h4>
                    <p className="text-sm text-text/70 font-mono">{inspectedData.host}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text">Space ID</h4>
                    <p className="text-sm text-text/70 font-mono break-all">{inspectedData.spaceId}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text">Path</h4>
                    <p className="text-sm text-text/70 font-mono">{inspectedData.path}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text">Key DID</h4>
                    <p className="text-sm text-text/70 font-mono break-all">{inspectedData.keyDid}</p>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text">Key (JWK)</h4>
                    <pre className="text-xs text-text/70 font-mono bg-main/10 p-2 rounded overflow-x-auto">
                      {JSON.stringify({ ...inspectedData.key, d: inspectedData.key.d ? '[REDACTED]' : undefined }, null, 2)}
                    </pre>
                  </div>

                  <div>
                    <h4 className="font-semibold text-text">Delegation</h4>
                    <div className="text-sm text-text/70 space-y-1 ml-2">
                      <p><span className="font-medium">CID:</span> <span className="font-mono break-all">{inspectedData.delegation.cid}</span></p>
                      <p><span className="font-medium">Delegate DID:</span> <span className="font-mono break-all">{inspectedData.delegation.delegateDID}</span></p>
                      <p><span className="font-medium">Actions:</span> {inspectedData.delegation.actions.join(', ')}</p>
                      <p><span className="font-medium">Expiry:</span> {inspectedData.delegation.expiry}</p>
                      <p><span className="font-medium">Revoked:</span> {inspectedData.delegation.isRevoked ? 'Yes' : 'No'}</p>
                      <p><span className="font-medium">Sub-delegation:</span> {inspectedData.delegation.allowSubDelegation ? 'Allowed' : 'Not allowed'}</p>
                      {inspectedData.delegation.authHeader && (
                        <div>
                          <p className="font-medium">Auth Header (UCAN JWT):</p>
                          <pre className="text-xs font-mono bg-main/10 p-2 rounded overflow-x-auto max-h-32">
                            {inspectedData.delegation.authHeader}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {fetchedData && (
              <div className="mt-6 rounded-base border-2 border-border/30 bg-bw/50 p-4">
                <h3 className="mb-2 text-lg font-heading text-text">Retrieved Content:</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-main/10 p-4 font-mono text-sm text-text">
                  {JSON.stringify(fetchedData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-auto w-full">
        <Footer />
      </div>
    </div>
  );
};

export default Shared;