import React from 'react';
import { Code, Eye, Columns } from 'lucide-react';
import type { EditorMode } from './EditorLayout';
import { cn } from '../../utils/utils';

interface EditorToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  wordCount: number;
  saving: boolean;
}

export function EditorToolbar({ mode, onModeChange, wordCount, saving }: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-bw border-b border-border">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onModeChange('edit')}
          className={cn(
            'p-1.5 rounded transition-colors',
            mode === 'edit' ? 'bg-main/10 text-main' : 'text-text/50 hover:text-text hover:bg-bg'
          )}
          title="Edit mode"
        >
          <Code className="h-4 w-4" />
        </button>
        <button
          onClick={() => onModeChange('split')}
          className={cn(
            'hidden md:inline-flex p-1.5 rounded transition-colors',
            mode === 'split' ? 'bg-main/10 text-main' : 'text-text/50 hover:text-text hover:bg-bg'
          )}
          title="Split mode"
        >
          <Columns className="h-4 w-4" />
        </button>
        <button
          onClick={() => onModeChange('preview')}
          className={cn(
            'p-1.5 rounded transition-colors',
            mode === 'preview' ? 'bg-main/10 text-main' : 'text-text/50 hover:text-text hover:bg-bg'
          )}
          title="Preview mode"
        >
          <Eye className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-text/50">
        <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>
        <div className="flex items-center gap-1.5">
          {saving ? (
            <>
              <div className="h-2 w-2 rounded-full bg-yellow-400 status-pulse" />
              <span>Saving...</span>
            </>
          ) : (
            <>
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span>Saved</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
