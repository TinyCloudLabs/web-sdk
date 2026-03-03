import { useState } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher';
import { Menu, Share2, Settings, FileText, Lock } from 'lucide-react';

interface HeaderProps {
  address?: string;
  docTitle?: string;
  onDocTitleChange?: (title: string) => void;
  onSidebarToggle?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
  hasActiveDoc?: boolean;
  isEncrypted?: boolean;
}

const Header = ({ address, docTitle, onDocTitleChange, onSidebarToggle, onShare, onSettings, hasActiveDoc, isEncrypted }: HeaderProps) => {
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState(docTitle || '');

  const handleTitleSubmit = () => {
    setEditingTitle(false);
    if (titleValue.trim() && titleValue !== docTitle && onDocTitleChange) {
      onDocTitleChange(titleValue.trim());
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setTitleValue(docTitle || '');
      setEditingTitle(false);
    }
  };

  // Update title value when prop changes
  if (docTitle !== undefined && docTitle !== titleValue && !editingTitle) {
    setTitleValue(docTitle);
  }

  return (
    <div className="fixed top-0 left-0 z-50 flex w-full items-center justify-between backdrop-blur-xl bg-bw/80 border-b border-border shadow-nav px-4 py-2.5 h-14">
      {/* Left */}
      <div className="flex items-center gap-3">
        {onSidebarToggle && (
          <button
            onClick={onSidebarToggle}
            className="p-1.5 rounded text-text/50 hover:text-text hover:bg-bg transition-colors md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-main" />
          <span className="text-sm font-display uppercase tracking-wide text-text hidden sm:inline">
            TINYCLOUD
          </span>
        </div>
      </div>

      {/* Center - doc title */}
      <div className="flex-1 flex justify-center mx-4">
        {hasActiveDoc && docTitle !== undefined ? (
          editingTitle ? (
            <input
              type="text"
              value={titleValue}
              onChange={e => setTitleValue(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              autoFocus
              className="text-sm font-medium text-text text-center bg-transparent border-b border-main outline-none px-2 py-0.5 max-w-xs w-full"
            />
          ) : (
            <button
              onClick={() => setEditingTitle(true)}
              className="text-sm font-medium text-text hover:text-main transition-colors truncate max-w-xs flex items-center gap-1.5"
              title="Click to rename"
            >
              {isEncrypted && <Lock className="h-3 w-3 text-text/40" />}
              {docTitle}
            </button>
          )
        ) : null}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {hasActiveDoc && onShare && (
          <button
            onClick={onShare}
            className="p-1.5 rounded text-text/50 hover:text-text hover:bg-bg transition-colors"
            title="Share"
          >
            <Share2 className="h-4 w-4" />
          </button>
        )}
        {onSettings && (
          <button
            onClick={onSettings}
            className="p-1.5 rounded text-text/50 hover:text-text hover:bg-bg transition-colors"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        )}
        {address && (
          <span className="text-xs font-mono text-text/50 bg-bg px-2 py-1 rounded border border-border/50 hidden sm:inline">
            {address.slice(0, 6)}...{address.slice(-4)}
          </span>
        )}
        <ThemeSwitcher />
      </div>
    </div>
  );
};

export default Header;
