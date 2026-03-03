// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';

function parseShareMeta(token: string): { actions: string[]; expiry: string; path: string; host: string; raw: any } | null {
  try {
    let encoded = token;
    if (encoded.startsWith('tc1:')) encoded = encoded.slice(4);
    encoded = decodeURIComponent(encoded);
    const decoded = atob(encoded);
    const parsed = JSON.parse(decoded);
    return {
      actions: parsed.delegation?.actions || [],
      expiry: parsed.delegation?.expiry || '',
      path: parsed.path || '',
      host: parsed.host || '',
      raw: parsed,
    };
  } catch {
    return null;
  }
}

function formatAction(action: string): string {
  const parts = action.split('/');
  return parts[1] || action;
}

const Inspect = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const initialToken = queryParams.get('share') || queryParams.get('data') || '';

  const [tokenInput, setTokenInput] = useState(initialToken);
  const [meta, setMeta] = useState<ReturnType<typeof parseShareMeta>>(null);
  const [parseError, setParseError] = useState(false);

  useEffect(() => {
    if (tokenInput.trim()) {
      const parsed = parseShareMeta(tokenInput.trim());
      setMeta(parsed);
      setParseError(!parsed);
    } else {
      setMeta(null);
      setParseError(false);
    }
  }, [tokenInput]);

  const isExpired = meta?.expiry ? new Date(meta.expiry) < new Date() : false;

  return (
    <>
      <Header />
      <div className="flex min-h-screen flex-col bg-bg pt-16">
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl px-4 py-8">
            <div className="mb-6">
              <h1 className="text-2xl font-heading text-text mb-1">Inspect Share Link</h1>
              <p className="text-sm text-text/50">
                Paste a TinyCloud share token to inspect its metadata without fetching content.
              </p>
            </div>

            {/* Token input */}
            <div className="mb-6">
              <textarea
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="Paste share token here (e.g. tc1:eyJ...)"
                rows={3}
                className="w-full rounded-base border border-border bg-bw px-4 py-3 text-sm font-mono text-text placeholder:text-text/30 focus:outline-none focus:ring-1 focus:ring-main resize-none"
              />
            </div>

            {parseError && tokenInput.trim() && (
              <div className="mb-6 rounded-base border border-red-300 bg-red-50 p-4 text-center">
                <p className="text-sm text-red-700">Could not parse this token. Check that it's a valid TinyCloud share token.</p>
              </div>
            )}

            {meta && (
              <div className="space-y-4">
                {/* Metadata card */}
                <div className="rounded-base border border-border bg-bw p-5 shadow-card">
                  <h3 className="text-sm font-heading text-text/70 uppercase tracking-wider mb-4">Token Metadata</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-text/50">Path</span>
                      <span className="font-mono text-text">{meta.path || '/'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text/50">Host</span>
                      <span className="font-mono text-text text-xs truncate max-w-[250px]">{meta.host || 'default'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text/50">Permissions</span>
                      <div className="flex gap-1.5">
                        {meta.actions.map(a => (
                          <span key={a} className="px-2 py-0.5 rounded bg-main/10 text-main text-xs font-medium">
                            {formatAction(a)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text/50">Expires</span>
                      <span className={`text-sm ${isExpired ? 'text-red-600 font-medium' : 'text-text'}`}>
                        {meta.expiry ? new Date(meta.expiry).toLocaleString() : 'No expiry'}
                        {isExpired && ' (expired)'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Raw JSON */}
                <details className="rounded-base border border-border bg-bw shadow-card">
                  <summary className="px-5 py-3 text-sm font-medium text-text/50 cursor-pointer hover:text-text/70 transition-colors">
                    Raw token data
                  </summary>
                  <div className="px-5 pb-4">
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-text/70 bg-bg rounded-base p-3 border border-border/50">
                      {JSON.stringify(meta.raw, null, 2)}
                    </pre>
                  </div>
                </details>

                {/* Actions */}
                <div className="flex gap-3">
                  {!isExpired && (
                    <RouterLink
                      to={`/share?share=${encodeURIComponent(tokenInput.trim())}`}
                      className="flex-1 h-10 rounded-base bg-main text-mtext text-sm font-medium border border-border shadow-card hover:shadow-card-hover transition-all flex items-center justify-center"
                    >
                      View Content
                    </RouterLink>
                  )}
                  <RouterLink
                    to="/"
                    className="px-4 h-10 rounded-base border border-border bg-bw text-text text-sm font-medium hover:bg-bg transition-colors flex items-center justify-center"
                  >
                    Go to Editor
                  </RouterLink>
                </div>
              </div>
            )}

            {!tokenInput.trim() && !meta && (
              <div className="text-center py-8">
                <p className="text-sm text-text/30">Paste a share token above to inspect it.</p>
                <RouterLink to="/" className="text-sm text-main hover:underline mt-2 inline-block">
                  Go to editor
                </RouterLink>
              </div>
            )}
          </div>
        </div>
        <div className="w-full">
          <Footer />
        </div>
      </div>
    </>
  );
};

export default Inspect;
