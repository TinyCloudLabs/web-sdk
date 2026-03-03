// @ts-nocheck
import React, { useState } from 'react';
import { TinyCloudWeb } from '@tinycloud/web-sdk';
import { Modal } from '../ui/modal';
import { Copy, Check, Link, Lock } from 'lucide-react';
import { DocumentEnvelope } from '../../types/document';

interface ShareModalProps {
  tcw: TinyCloudWeb;
  documentKey: string;
  document?: DocumentEnvelope;
  tinyCloudHost?: string;
  open: boolean;
  onClose: () => void;
}

const expiryOptions = [
  { value: '1hour', label: '1 Hour', ms: 60 * 60 * 1000 },
  { value: '24hours', label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7days', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30days', label: '30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
];

const actionOptions = [
  { value: 'tinycloud.kv/get', label: 'Read' },
  { value: 'tinycloud.kv/list', label: 'List' },
  { value: 'tinycloud.kv/put', label: 'Write' },
];

export function ShareModal({ tcw, documentKey, document, tinyCloudHost, open, onClose }: ShareModalProps) {
  const [selectedActions, setSelectedActions] = useState<string[]>(['tinycloud.kv/get', 'tinycloud.kv/list']);
  const [selectedExpiry, setSelectedExpiry] = useState('7days');
  const [shareUrl, setShareUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const isEncrypted = documentKey.startsWith('vault:');

  const toggleAction = (action: string) => {
    setSelectedActions(prev =>
      prev.includes(action)
        ? prev.filter(a => a !== action)
        : [...prev, action]
    );
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setShareUrl('');

    const expiryOption = expiryOptions.find(o => o.value === selectedExpiry);
    const expiryMs = expiryOption?.ms ?? 7 * 24 * 60 * 60 * 1000;
    const expiryDate = new Date(Date.now() + expiryMs);

    try {
      // For encrypted (vault) documents, generate a KV share link first,
      // then create a vault grant for the share link's session key DID.
      // The recipient's session key (embedded in the token) can derive
      // X25519 keys directly — no wallet signature needed.
      if (isEncrypted && document) {
        const vaultKey = documentKey.slice(6); // strip "vault:" prefix

        // First generate the share link to get the session key DID that will receive the grant
        const result = await tcw.sharing.generate({
          path: vaultKey,
          actions: selectedActions,
          expiry: expiryDate,
        });

        if (!result.ok) {
          if (result.error.message.includes('expiry exceeds parent expiry')) {
            setError('Share duration exceeds your session. Try a shorter duration or sign out and back in.');
          } else {
            setError(`Failed to generate share link: ${result.error.message}`);
          }
          setGenerating(false);
          return;
        }

        // Create vault grant for the share link's embedded session key
        // The token embeds a JWK with a did:key DID — grant vault access to that DID
        try {
          const tokenData = parseShareToken(result.data.token);
          if (tokenData?.keyDid) {
            const grantResult = await tcw.vault.grant(vaultKey, tokenData.keyDid);
            if (!grantResult.ok) {
              console.warn('Vault grant failed, recipient may not be able to decrypt:', grantResult.error);
            }
          }
        } catch (grantErr) {
          console.warn('Failed to create vault grant:', grantErr);
        }

        const url = `${window.location.origin}/share?share=${encodeURIComponent(result.data.token)}`;
        setShareUrl(url);
      } else {
        // Regular KV document — standard sharing flow
        const result = await tcw.sharing.generate({
          path: documentKey,
          actions: selectedActions,
          expiry: expiryDate,
        });

        if (result.ok) {
          const url = `${window.location.origin}/share?share=${encodeURIComponent(result.data.token)}`;
          setShareUrl(url);
        } else {
          if (result.error.message.includes('expiry exceeds parent expiry')) {
            setError('Share duration exceeds your session. Try a shorter duration or sign out and back in.');
          } else {
            setError(`Failed to generate share link: ${result.error.message}`);
          }
        }
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    setGenerating(false);
  };

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Share Document">
      <div className="space-y-4">
        {/* Encrypted notice */}
        {isEncrypted && (
          <div className="flex items-start gap-2 p-3 rounded-base border border-yellow-300/50 bg-yellow-50/50">
            <Lock className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              This is an encrypted document. A vault grant will be created for the share link's session key, allowing the recipient to decrypt without a wallet.
            </p>
          </div>
        )}

        {/* Permissions */}
        <div>
          <label className="text-sm font-medium text-text mb-2 block">Permissions</label>
          <div className="flex flex-wrap gap-2">
            {actionOptions.map(action => (
              <label
                key={action.value}
                className={`flex items-center gap-2 px-3 py-2 rounded-base border cursor-pointer transition-colors text-sm ${
                  selectedActions.includes(action.value)
                    ? 'border-main bg-main/10 text-main'
                    : 'border-border/50 text-text/60 hover:border-border'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedActions.includes(action.value)}
                  onChange={() => toggleAction(action.value)}
                  className="hidden"
                />
                {action.label}
              </label>
            ))}
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label className="text-sm font-medium text-text mb-2 block">Expires in</label>
          <div className="grid grid-cols-2 gap-2">
            {expiryOptions.map(option => (
              <label
                key={option.value}
                className={`flex items-center justify-center px-3 py-2 rounded-base border cursor-pointer transition-colors text-sm ${
                  selectedExpiry === option.value
                    ? 'border-main bg-main/10 text-main'
                    : 'border-border/50 text-text/60 hover:border-border'
                }`}
              >
                <input
                  type="radio"
                  name="expiry"
                  value={option.value}
                  checked={selectedExpiry === option.value}
                  onChange={(e) => setSelectedExpiry(e.target.value)}
                  className="hidden"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-base border border-red-300 bg-red-50 p-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Share URL result */}
        {shareUrl ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 rounded-base border border-main/30 bg-main/5">
              <Link className="h-4 w-4 text-main flex-shrink-0" />
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 text-xs font-mono bg-transparent text-text border-none outline-none"
              />
            </div>
            <button
              onClick={handleCopy}
              className="w-full h-10 rounded-base bg-main text-mtext text-sm font-medium border border-border shadow-card hover:shadow-card-hover transition-all flex items-center justify-center gap-2"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy Link'}
            </button>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating || selectedActions.length === 0}
            className="w-full h-10 rounded-base bg-main text-mtext text-sm font-medium border border-border shadow-card hover:shadow-card-hover transition-all disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Share Link'}
          </button>
        )}
      </div>
    </Modal>
  );
}

/**
 * Parse a share token to extract the embedded session key DID.
 */
function parseShareToken(token: string): { keyDid?: string } | null {
  try {
    let encoded = token;
    if (encoded.startsWith('tc1:')) encoded = encoded.slice(4);
    encoded = decodeURIComponent(encoded);
    const decoded = atob(encoded);
    const parsed = JSON.parse(decoded);
    return { keyDid: parsed.keyDid };
  } catch {
    return null;
  }
}
