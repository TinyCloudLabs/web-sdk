import React, { useState, useCallback } from 'react';
import { OpenKey, OpenKeyEIP1193Provider, type AuthResult } from '@openkey/sdk';
import { TinyCloudWeb } from '@tinycloud/web-sdk';

const OPENKEY_HOST = 'http://localhost:5173'; // local dev

function App() {
  const [tcw, setTcw] = useState<TinyCloudWeb | null>(null);
  const [address, setAddress] = useState('');
  const [authMethod, setAuthMethod] = useState<'openkey' | 'wallet' | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // KV state
  const [kvKey, setKvKey] = useState('test-key');
  const [kvValue, setKvValue] = useState('');
  const [kvResult, setKvResult] = useState('');

  // Sign in with OpenKey
  const signInWithOpenKey = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const openkey = new OpenKey({ host: OPENKEY_HOST });
      const auth: AuthResult = await openkey.connect();

      // Create unified EIP-1193 provider that routes signing based on key type
      const provider = new OpenKeyEIP1193Provider(openkey, auth);

      const cloud = new TinyCloudWeb({
        providers: {
          web3: {
            driver: provider as any,
          },
        },
        autoCreateSpace: true,
      });

      await cloud.signIn();
      setTcw(cloud);
      setAddress(auth.address);
      setAuthMethod('openkey');
    } catch (e: any) {
      setError(e.message || 'OpenKey sign-in failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign in with browser wallet (window.ethereum directly)
  const signInWithWallet = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error('No wallet found. Install MetaMask.');

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts?.length) throw new Error('No accounts returned');

      const cloud = new TinyCloudWeb({
        providers: {
          web3: {
            driver: ethereum,
          },
        },
        autoCreateSpace: true,
      });

      await cloud.signIn();
      setTcw(cloud);
      setAddress(accounts[0]);
      setAuthMethod('wallet');
    } catch (e: any) {
      setError(e.message || 'Wallet sign-in failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    tcw?.signOut?.();
    setTcw(null);
    setAddress('');
    setAuthMethod(null);
    setKvResult('');
  }, [tcw]);

  // KV operations (Result pattern)
  const kvPut = useCallback(async () => {
    if (!tcw) return;
    try {
      const result = await tcw.kv.put(kvKey, kvValue);
      if (result.ok) {
        setKvResult(`PUT "${kvKey}" = "${kvValue}" OK`);
      } else {
        setKvResult(`PUT error: ${result.error.code} - ${result.error.message}`);
      }
    } catch (e: any) {
      setKvResult(`Error: ${e.message}`);
    }
  }, [tcw, kvKey, kvValue]);

  const kvGet = useCallback(async () => {
    if (!tcw) return;
    try {
      const result = await tcw.kv.get(kvKey);
      if (result.ok) {
        const data = result.data.data;
        const display = typeof data === 'string' ? data : JSON.stringify(data);
        setKvResult(`GET "${kvKey}" = ${data != null ? `"${display}"` : 'null'}`);
      } else {
        setKvResult(`GET error: ${result.error.code} - ${result.error.message}`);
      }
    } catch (e: any) {
      setKvResult(`Error: ${e.message}`);
    }
  }, [tcw, kvKey]);

  if (!tcw) {
    return (
      <div>
        <h1 style={{ marginBottom: '0.5rem' }}>TinyCloud + OpenKey</h1>
        <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>
          Sign in to access decentralized storage
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 400 }}>
          <button className="primary-btn" onClick={signInWithOpenKey} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in with OpenKey'}
          </button>
          <button className="secondary-btn" onClick={signInWithWallet} disabled={loading}>
            or use your own wallet
          </button>
        </div>

        {error && (
          <div className="card" style={{ marginTop: '1rem', borderColor: '#ef4444', color: '#ef4444' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>TinyCloud + OpenKey</h1>
          <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Connected via {authMethod === 'openkey' ? 'OpenKey' : 'Wallet'} · <code>{address.slice(0, 6)}...{address.slice(-4)}</code>
          </p>
        </div>
        <button className="secondary-btn" onClick={signOut}>Sign Out</button>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>KV Storage</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <input placeholder="Key" value={kvKey} onChange={(e) => setKvKey(e.target.value)} style={{ flex: 1 }} />
          <input placeholder="Value" value={kvValue} onChange={(e) => setKvValue(e.target.value)} style={{ flex: 2 }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="primary-btn" onClick={kvPut}>PUT</button>
          <button className="secondary-btn" onClick={kvGet}>GET</button>
        </div>
        {kvResult && <pre style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#1e1e1e', borderRadius: '8px', fontSize: '0.875rem' }}>{kvResult}</pre>}
      </div>
    </div>
  );
}

export default App;
