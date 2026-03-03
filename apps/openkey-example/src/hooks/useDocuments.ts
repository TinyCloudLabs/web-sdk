// @ts-nocheck
import { useState, useCallback, useRef, useEffect } from 'react';
import { TinyCloudWeb } from '@tinycloud/web-sdk';
import { providers } from 'ethers';
import { DocumentEnvelope, createDocument, updateDocument, titleToKey } from '../types/document';

export interface DocumentEntry {
  key: string;
  doc: DocumentEnvelope;
}

interface UseDocumentsReturn {
  documents: DocumentEntry[];
  activeDocument: DocumentEntry | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  vaultUnlocked: boolean;
  loadDocuments: () => Promise<void>;
  openDocument: (key: string) => Promise<void>;
  createNewDocument: (title?: string, encrypted?: boolean) => Promise<DocumentEntry | null>;
  saveDocument: (key: string, doc: DocumentEnvelope) => Promise<boolean>;
  deleteDocument: (key: string) => Promise<void>;
  setActiveDocument: (entry: DocumentEntry | null) => void;
  updateContent: (content: string) => void;
  unlockVault: () => Promise<boolean>;
}

export function useDocuments(tcw: TinyCloudWeb | null, web3Provider?: providers.Web3Provider | null): UseDocumentsReturn {
  const [documents, setDocuments] = useState<DocumentEntry[]>([]);
  const [activeDocument, setActiveDocument] = useState<DocumentEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unlockVault = useCallback(async (): Promise<boolean> => {
    if (!tcw || !web3Provider) return false;
    try {
      const signer = web3Provider.getSigner();
      const result = await tcw.vault.unlock(signer);
      if (result.ok) {
        setVaultUnlocked(true);
        return true;
      } else {
        setError(`Vault unlock failed: ${result.error?.message || 'Unknown error'}`);
        return false;
      }
    } catch (err) {
      setError(`Vault unlock error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }, [tcw, web3Provider]);

  const loadDocuments = useCallback(async () => {
    if (!tcw) return;
    setLoading(true);
    setError(null);

    try {
      const entries: DocumentEntry[] = [];

      // Load standard KV documents
      const listResult = await tcw.kv.list({ removePrefix: true });
      if (listResult.ok) {
        for (const key of listResult.data.keys) {
          try {
            const getResult = await tcw.kv.get<string>(key);
            if (getResult.ok && getResult.data.data) {
              try {
                const doc = JSON.parse(getResult.data.data) as DocumentEnvelope;
                if (doc.title && doc.createdAt) {
                  entries.push({ key, doc });
                }
              } catch {
                // Not a document envelope, skip
              }
            }
          } catch {
            // Skip failed gets
          }
        }
      }

      // Load vault (encrypted) documents if vault is unlocked
      if (vaultUnlocked) {
        try {
          const vaultList = await tcw.vault.list();
          if (vaultList.ok) {
            for (const key of vaultList.data) {
              try {
                const vaultGet = await tcw.vault.get(key);
                if (vaultGet.ok) {
                  const raw = vaultGet.data.value;
                  const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
                  try {
                    const doc = JSON.parse(str) as DocumentEnvelope;
                    if (doc.title && doc.createdAt) {
                      doc.encrypted = true;
                      entries.push({ key: `vault:${key}`, doc });
                    }
                  } catch {
                    // Not a document envelope, skip
                  }
                }
              } catch {
                // Skip failed vault gets
              }
            }
          }
        } catch {
          // Vault list failed, skip
        }
      }

      // Sort by updatedAt descending
      entries.sort((a, b) => new Date(b.doc.updatedAt).getTime() - new Date(a.doc.updatedAt).getTime());
      setDocuments(entries);
    } catch (err) {
      setError(`Error loading documents: ${err instanceof Error ? err.message : String(err)}`);
    }

    setLoading(false);
  }, [tcw, vaultUnlocked]);

  const openDocument = useCallback(async (key: string) => {
    if (!tcw) return;
    setError(null);

    if (key.startsWith('vault:')) {
      // Encrypted document
      const vaultKey = key.slice(6);
      const result = await tcw.vault.get(vaultKey);
      if (result.ok) {
        const raw = result.data.value;
        const str = typeof raw === 'string' ? raw : JSON.stringify(raw);
        try {
          const doc = JSON.parse(str) as DocumentEnvelope;
          doc.encrypted = true;
          setActiveDocument({ key, doc });
        } catch {
          setError('Failed to parse encrypted document');
        }
      } else {
        setError(`Failed to open encrypted document: ${result.error?.message}`);
      }
    } else {
      const getResult = await tcw.kv.get<string>(key);
      if (getResult.ok && getResult.data.data) {
        try {
          const doc = JSON.parse(getResult.data.data) as DocumentEnvelope;
          setActiveDocument({ key, doc });
        } catch {
          setError('Failed to parse document');
        }
      } else if (!getResult.ok) {
        setError(`Failed to open document: ${getResult.error.message}`);
      }
    }
  }, [tcw]);

  const createNewDocument = useCallback(async (title?: string, encrypted?: boolean): Promise<DocumentEntry | null> => {
    if (!tcw) return null;
    setError(null);

    const docTitle = title || 'Untitled Document';
    const doc = createDocument(docTitle, encrypted);
    const baseKey = titleToKey(docTitle) + '-' + Date.now().toString(36);

    if (encrypted) {
      if (!vaultUnlocked) {
        setError('Vault must be unlocked to create encrypted documents');
        return null;
      }
      const result = await tcw.vault.put(baseKey, JSON.stringify(doc));
      if (result.ok) {
        const entry = { key: `vault:${baseKey}`, doc };
        setDocuments(prev => [entry, ...prev]);
        setActiveDocument(entry);
        return entry;
      } else {
        setError(`Failed to create encrypted document: ${result.error?.message}`);
        return null;
      }
    } else {
      const result = await tcw.kv.put(baseKey, JSON.stringify(doc));
      if (result.ok) {
        const entry = { key: baseKey, doc };
        setDocuments(prev => [entry, ...prev]);
        setActiveDocument(entry);
        return entry;
      } else {
        setError(`Failed to create document: ${result.error.message}`);
        return null;
      }
    }
  }, [tcw, vaultUnlocked]);

  const saveDocument = useCallback(async (key: string, doc: DocumentEnvelope): Promise<boolean> => {
    if (!tcw) return false;
    setSaving(true);

    let result;
    if (key.startsWith('vault:')) {
      const vaultKey = key.slice(6);
      result = await tcw.vault.put(vaultKey, JSON.stringify(doc));
    } else {
      result = await tcw.kv.put(key, JSON.stringify(doc));
    }

    if (result.ok) {
      setDocuments(prev =>
        prev.map(d => d.key === key ? { key, doc } : d)
      );
      setSaving(false);
      return true;
    } else {
      setError(`Failed to save: ${result.error?.message}`);
      setSaving(false);
      return false;
    }
  }, [tcw]);

  const deleteDocument = useCallback(async (key: string) => {
    if (!tcw) return;
    setError(null);

    let result;
    if (key.startsWith('vault:')) {
      const vaultKey = key.slice(6);
      result = await tcw.vault.delete(vaultKey);
    } else {
      result = await tcw.kv.delete(key);
    }

    if (result.ok) {
      setDocuments(prev => prev.filter(d => d.key !== key));
      if (activeDocument?.key === key) {
        setActiveDocument(null);
      }
    } else {
      setError(`Failed to delete: ${result.error?.message}`);
    }
  }, [tcw, activeDocument]);

  const updateContent = useCallback((content: string) => {
    if (!activeDocument) return;

    const updated = updateDocument(activeDocument.doc, content);
    const newEntry = { key: activeDocument.key, doc: updated };
    setActiveDocument(newEntry);

    // Auto-save with 1.5s debounce
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveDocument(activeDocument.key, updated);
    }, 1500);
  }, [activeDocument, saveDocument]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    documents,
    activeDocument,
    loading,
    saving,
    error,
    vaultUnlocked,
    loadDocuments,
    openDocument,
    createNewDocument,
    saveDocument,
    deleteDocument,
    setActiveDocument,
    updateContent,
    unlockVault,
  };
}
