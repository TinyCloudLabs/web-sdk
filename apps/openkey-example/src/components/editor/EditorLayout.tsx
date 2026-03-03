import React, { useState } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownPreview } from './MarkdownPreview';
import { EditorToolbar } from './EditorToolbar';

interface EditorLayoutProps {
  content: string;
  onChange: (content: string) => void;
  saving: boolean;
}

export type EditorMode = 'edit' | 'preview' | 'split';

export function EditorLayout({ content, onChange, saving }: EditorLayoutProps) {
  const [mode, setMode] = useState<EditorMode>('split');

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <EditorToolbar mode={mode} onModeChange={setMode} wordCount={wordCount} saving={saving} />
      <div className="flex flex-1 min-h-0 border-t border-border">
        {/* Desktop split view */}
        <div className="hidden md:flex flex-1 min-h-0">
          {mode === 'edit' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <MarkdownEditor content={content} onChange={onChange} />
            </div>
          )}
          {mode === 'preview' && (
            <div className="flex-1 min-h-0 overflow-auto">
              <MarkdownPreview content={content} />
            </div>
          )}
          {mode === 'split' && (
            <>
              <div className="w-1/2 min-h-0 overflow-auto border-r border-border">
                <MarkdownEditor content={content} onChange={onChange} />
              </div>
              <div className="w-1/2 min-h-0 overflow-auto">
                <MarkdownPreview content={content} />
              </div>
            </>
          )}
        </div>

        {/* Mobile: only edit or preview (no split) */}
        <div className="flex md:hidden flex-1 min-h-0">
          {(mode === 'edit' || mode === 'split') ? (
            <div className="flex-1 min-h-0 overflow-auto">
              <MarkdownEditor content={content} onChange={onChange} />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto">
              <MarkdownPreview content={content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
