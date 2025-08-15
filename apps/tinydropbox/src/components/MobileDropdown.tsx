import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Folder,
  LogOut,
  Menu,
  Palette,
} from 'lucide-react';
import { cn } from '../utils/utils';
import { ThemeSwitcher } from './ThemeSwitcher';

interface MobileDropdownProps {
  onCreateFolder: () => void;
  onUpload: () => void;
  onLogout: () => void;
  className?: string;
}

export const MobileDropdown: React.FC<MobileDropdownProps> = ({
  onCreateFolder,
  onUpload,
  onLogout,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Dropdown Trigger - Menu Button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 flex items-center justify-center bg-main border-2 border-border rounded-base hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-mtext shadow-shadow"
        aria-haspopup="true"
        aria-expanded={isOpen}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Dropdown Content */}
      {isOpen && (
        <>
          {/* Overlay for mobile */}
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm sm:hidden" />
          
          {/* Dropdown Menu */}
          <div
            ref={dropdownRef}
            className={cn(
              'absolute right-0 top-full mt-2 w-56 z-50',
              'bg-bw border-2 border-border rounded-base shadow-shadow',
              'animate-in slide-in-from-top-2 duration-200'
            )}
          >
            {/* Menu Label */}
            <div className="px-4 py-3 border-b-2 border-border">
              <div className="text-sm font-heading text-text">Quick Actions</div>
            </div>

            {/* Menu Items */}
            <div className="py-2">
              {/* Upload Files */}
              <button
                onClick={() => handleItemClick(onUpload)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-base text-text hover:bg-bg transition-colors text-left"
              >
                <Upload className="w-4 h-4 text-text" />
                <span>Upload Files</span>
              </button>

              {/* Create New Folder */}
              <button
                onClick={() => handleItemClick(onCreateFolder)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-base text-text hover:bg-bg transition-colors text-left"
              >
                <Folder className="w-4 h-4 text-text" />
                <span>New Folder</span>
              </button>

              {/* Separator */}
              <div className="my-2 mx-4 h-[2px] bg-border" />

              {/* Theme Switcher Row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <Palette className="w-4 h-4 text-text" />
                  <span className="text-sm font-base text-text">Theme</span>
                </div>
                <ThemeSwitcher />
              </div>

              {/* Separator */}
              <div className="my-2 mx-4 h-[2px] bg-border" />

              {/* Logout */}
              <button
                onClick={() => handleItemClick(onLogout)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-base text-text hover:bg-bg transition-colors text-left"
              >
                <LogOut className="w-4 h-4 text-text" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};