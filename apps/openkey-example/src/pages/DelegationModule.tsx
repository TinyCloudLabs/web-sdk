// @ts-nocheck - Pre-existing type issues with web-sdk version mismatch
import { useState, useEffect } from 'react';
import { TinyCloudWeb, Delegation, PortableDelegation, serializeDelegation } from '@tinycloudlabs/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';

interface IDelegationModule {
  tcw: TinyCloudWeb;
}

/**
 * Convert a Delegation to PortableDelegation with transport fields.
 * This adds the fields needed for the recipient to use the delegation.
 */
function toPortableDelegation(
  delegation: Delegation,
  ownerAddress: string,
  chainId: number,
  host: string
): PortableDelegation {
  return {
    ...delegation,
    delegationHeader: { Authorization: delegation.authHeader || `Bearer ${delegation.cid}` },
    ownerAddress,
    chainId,
    host,
  };
}

/**
 * Serialize a PortableDelegation to URL-safe base64 token.
 */
function serializeToBase64(delegation: PortableDelegation): string {
  const json = serializeDelegation(delegation);
  // Use base64url encoding
  const base64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return base64;
}

/**
 * DelegationModule demonstrates the delegation API.
 *
 * Features:
 * - Create delegation (grant access to another DID)
 * - List outgoing delegations
 * - Revoke delegations
 * - Generate URL-based delegation links
 */
function DelegationModule({ tcw }: IDelegationModule) {
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [delegateDID, setDelegateDID] = useState<string>('');
  const [path, setPath] = useState<string>('shared/');
  const [selectedActions, setSelectedActions] = useState<string[]>(['tinycloud.kv/get']);
  const [expiryDays, setExpiryDays] = useState<string>('7');
  const [generatedUrl, setGeneratedUrl] = useState<string>('');
  const [lastDelegation, setLastDelegation] = useState<Delegation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const availableActions = [
    { value: 'tinycloud.kv/get', label: 'Read (get)' },
    { value: 'tinycloud.kv/put', label: 'Write (put)' },
    { value: 'tinycloud.kv/del', label: 'Delete (del)' },
    { value: 'tinycloud.kv/list', label: 'List (list)' },
  ];

  // Load delegations on mount
  useEffect(() => {
    loadDelegations();
  }, [tcw]);

  const loadDelegations = async () => {
    setError(null);
    try {
      const space = tcw.space('default');
      const result = await space.delegations.list();
      if (result.ok) {
        setDelegations(result.data);
      } else {
        console.error('Failed to list delegations:', result.error);
        setError(`Failed to list delegations: ${result.error.message}`);
      }
    } catch (err) {
      console.error('Error loading delegations:', err);
      setError(`Error loading delegations: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleActionToggle = (action: string) => {
    setSelectedActions(prev => {
      if (prev.includes(action)) {
        return prev.filter(a => a !== action);
      }
      return [...prev, action];
    });
  };

  const handleCreateDelegation = async () => {
    if (!delegateDID) {
      setError('Recipient DID is required');
      return;
    }
    if (selectedActions.length === 0) {
      setError('At least one action is required');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedUrl('');

    try {
      const space = tcw.space('default');
      const expiryMs = parseInt(expiryDays) * 24 * 60 * 60 * 1000;
      const expiry = new Date(Date.now() + expiryMs);

      const result = await space.delegations.create({
        delegateDID,
        path,
        actions: selectedActions,
        expiry,
      });

      if (result.ok) {
        const delegation = result.data;
        setLastDelegation(delegation);

        // Get transport fields from tcw
        const ownerAddress = tcw.address() || '';
        const chainId = tcw.chainId() || 1;
        // Use localhost in dev mode, otherwise default TinyCloud server
        const host = window.__DEV_MODE__ ? 'http://localhost:8000' : 'https://node.tinycloud.xyz';

        // Convert to PortableDelegation with transport fields
        const portableDelegation = toPortableDelegation(delegation, ownerAddress, chainId, host);

        // Generate URL with serialized delegation
        const token = serializeToBase64(portableDelegation);
        const url = `${window.location.origin}/delegate?token=${encodeURIComponent(token)}`;
        setGeneratedUrl(url);

        // Refresh the list
        await loadDelegations();

        // Clear form
        setDelegateDID('');
      } else {
        console.error('Failed to create delegation:', result.error);
        setError(`Failed to create delegation: ${result.error.message}`);
      }
    } catch (err) {
      console.error('Error creating delegation:', err);
      setError(`Error creating delegation: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  };

  const handleRevoke = async (cid: string) => {
    setLoading(true);
    setError(null);

    try {
      const space = tcw.space('default');
      const result = await space.delegations.revoke(cid);

      if (result.ok) {
        // Refresh the list
        await loadDelegations();
      } else {
        console.error('Failed to revoke delegation:', result.error);
        setError(`Failed to revoke delegation: ${result.error.message}`);
      }
    } catch (err) {
      console.error('Error revoking delegation:', err);
      setError(`Error revoking delegation: ${err instanceof Error ? err.message : String(err)}`);
    }
    setLoading(false);
  };

  const handleCopyUrl = async () => {
    if (generatedUrl) {
      await navigator.clipboard.writeText(generatedUrl);
      alert('URL copied to clipboard!');
    }
  };

  const formatExpiry = (expiry: Date | string) => {
    const date = expiry instanceof Date ? expiry : new Date(expiry);
    return date.toLocaleDateString();
  };

  const formatActions = (actions: string[]) => {
    return actions.map(a => a.split('/')[1]).join(', ');
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xl font-heading text-text">Delegation Management</h3>
          <p className="text-sm text-text/70">
            Create delegations to grant other users access to your space.
            The recipient can use the generated URL to receive the delegation.
          </p>
        </div>

        {error && (
          <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="h-px w-full bg-border/20" />

        {/* Create Delegation Form */}
        <div className="space-y-4">
          <h4 className="text-lg font-heading text-text">Create Delegation</h4>

          <Input
            label="Recipient DID"
            value={delegateDID}
            onChange={setDelegateDID}
            className="w-full"
          />

          <Input
            label="Path"
            value={path}
            onChange={setPath}
            className="w-full"
          />

          <div className="space-y-2">
            <label className="text-sm font-medium text-text">Actions</label>
            <div className="flex flex-wrap gap-2">
              {availableActions.map(action => (
                <label
                  key={action.value}
                  className={`flex items-center gap-2 px-3 py-2 rounded-base border-2 cursor-pointer transition-colors ${
                    selectedActions.includes(action.value)
                      ? 'border-main bg-main/10'
                      : 'border-border/30 bg-bw'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedActions.includes(action.value)}
                    onChange={() => handleActionToggle(action.value)}
                    className="hidden"
                  />
                  <span className="text-sm">{action.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Input
            label="Expires in (days)"
            value={expiryDays}
            onChange={setExpiryDays}
            className="w-full"
          />

          <Button
            variant="default"
            onClick={handleCreateDelegation}
            loading={loading}
            className="w-full"
          >
            Create Delegation
          </Button>
        </div>

        {/* Generated URL */}
        {generatedUrl && (
          <div className="space-y-3 p-4 rounded-base border-2 border-main/30 bg-main/10">
            <h4 className="text-md font-heading text-text">Generated URL</h4>
            <p className="text-sm text-text/70">
              Share this URL with the recipient. They can open it to receive the delegation.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={generatedUrl}
                readOnly
                className="flex-1 px-3 py-2 rounded-base border-2 border-border/30 bg-bw font-mono text-xs"
              />
              <Button variant="default" size="sm" onClick={handleCopyUrl}>
                Copy
              </Button>
            </div>
            <Button
              variant="neutral"
              size="sm"
              onClick={() => {
                setGeneratedUrl('');
                setLastDelegation(null);
              }}
            >
              Close
            </Button>
          </div>
        )}

        <div className="h-px w-full bg-border/20" />

        {/* Outgoing Delegations List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-heading text-text">Outgoing Delegations</h4>
            <Button variant="neutral" size="sm" onClick={loadDelegations}>
              Refresh
            </Button>
          </div>

          {delegations.length === 0 ? (
            <div className="rounded-base border-2 border-dashed border-border/50 bg-bw/50 p-8 text-center">
              <p className="text-text/70">No delegations created yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {delegations.map(delegation => (
                <div
                  key={delegation.cid}
                  className="rounded-base border-2 border-border/30 bg-bw p-4 space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text truncate">
                          {delegation.delegateDID}
                        </span>
                      </div>
                      <div className="text-xs text-text/70">
                        Path: <span className="font-mono">{delegation.path || '/'}</span>
                        {' | '}
                        Actions: {formatActions(delegation.actions)}
                      </div>
                      <div className="text-xs text-text/70">
                        Expires: {formatExpiry(delegation.expiry)}
                        {delegation.isRevoked && (
                          <span className="ml-2 text-red-600">(Revoked)</span>
                        )}
                      </div>
                    </div>
                    {!delegation.isRevoked && (
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleRevoke(delegation.cid)}
                        loading={loading}
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DelegationModule;
