import React from 'react';
import { DocumentEnvelope } from '../../types/document';
import { Trash2, Lock } from 'lucide-react';
import { cn } from '../../utils/utils';

interface DocumentCardProps {
  docKey: string;
  doc: DocumentEnvelope;
  active: boolean;
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function DocumentCard({ docKey, doc, active, onClick, onDelete }: DocumentCardProps) {
  const preview = doc.content.slice(0, 80).replace(/[#*_`[\]]/g, '').trim();

  return (
    <div
      onClick={onClick}
      className={cn(
        'group px-3 py-2.5 cursor-pointer border-b border-border/30 transition-colors',
        active ? 'bg-main/10 border-l-2 border-l-main' : 'hover:bg-bg'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-text truncate flex items-center gap-1.5">
            {doc.encrypted && <Lock className="h-3 w-3 text-text/40 flex-shrink-0" />}
            {doc.title}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-text/40">{relativeTime(doc.updatedAt)}</span>
          </div>
          {preview && (
            <p className="text-xs text-text/40 truncate mt-0.5">{preview}</p>
          )}
        </div>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 p-1 text-text/30 hover:text-red-500 transition-all"
          title="Delete document"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
