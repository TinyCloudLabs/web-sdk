import React, { useState } from 'react';
import { Plus, Search, X, FileText, Lock, Unlock } from 'lucide-react';
import { DocumentCard } from './DocumentCard';
import { DocumentEnvelope } from '../../types/document';

interface DocumentEntry {
  key: string;
  doc: DocumentEnvelope;
}

interface DocumentSidebarProps {
  documents: DocumentEntry[];
  activeKey: string | null;
  onOpen: (key: string) => void;
  onNew: (encrypted?: boolean) => void;
  onDelete: (key: string) => void;
  loading: boolean;
  open: boolean;
  onClose: () => void;
  vaultUnlocked: boolean;
  onUnlockVault: () => void;
}

export function DocumentSidebar({
  documents,
  activeKey,
  onOpen,
  onNew,
  onDelete,
  loading,
  open,
  onClose,
  vaultUnlocked,
  onUnlockVault,
}: DocumentSidebarProps) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? documents.filter(d =>
        d.doc.title.toLowerCase().includes(search.toLowerCase()) ||
        d.doc.content.toLowerCase().includes(search.toLowerCase())
      )
    : documents;

  const sidebarContent = (
    <div className="flex flex-col h-full bg-bw border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-text/50" />
          <span className="text-sm font-medium text-text">Documents</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onNew(false)}
            className="p-1.5 rounded text-text/50 hover:text-main hover:bg-main/10 transition-colors"
            title="New document"
          >
            <Plus className="h-4 w-4" />
          </button>
          {vaultUnlocked ? (
            <button
              onClick={() => onNew(true)}
              className="p-1.5 rounded text-text/50 hover:text-main hover:bg-main/10 transition-colors"
              title="New encrypted document"
            >
              <Lock className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={onUnlockVault}
              className="p-1.5 rounded text-text/50 hover:text-yellow-500 hover:bg-yellow-500/10 transition-colors"
              title="Unlock vault for encrypted documents"
            >
              <Unlock className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded text-text/50 hover:text-text hover:bg-bg transition-colors md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-border/50">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text/30" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search docs..."
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-bg border border-border/50 rounded-base text-text placeholder:text-text/30 focus:outline-none focus:ring-1 focus:ring-main"
          />
        </div>
      </div>

      {/* Document list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 text-center text-sm text-text/50">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-sm text-text/40">
              {search ? 'No matching documents' : 'No documents yet'}
            </p>
            {!search && (
              <button
                onClick={() => onNew(false)}
                className="mt-2 text-sm text-main hover:underline"
              >
                Create your first document
              </button>
            )}
          </div>
        ) : (
          filtered.map(entry => (
            <DocumentCard
              key={entry.key}
              docKey={entry.key}
              doc={entry.doc}
              active={entry.key === activeKey}
              onClick={() => onOpen(entry.key)}
              onDelete={(e) => {
                e.stopPropagation();
                onDelete(entry.key);
              }}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 flex-shrink-0 h-full">
        {sidebarContent}
      </div>

      {/* Mobile overlay sidebar */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <div className="relative w-64 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
