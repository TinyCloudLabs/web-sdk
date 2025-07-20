import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Folder,
  Home,
  ChevronRight,
  LogOut,
  Wallet,
  Plus,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { TinyCloudWeb } from "@tinycloudlabs/web-sdk";
import { useAccount, useWalletClient } from "wagmi";
import { useModal } from "connectkit";
import { walletClientToEthers5Signer } from "./utils/web3modalV2Settings";
import { ThemeProvider } from "./components/ThemeProvider";
import { ThemeSwitcher } from "./components/ThemeSwitcher";
import { MobileDropdown } from "./components/MobileDropdown";
import { cn } from "./utils/utils";

import { NeoFileGrid } from "./components/neo/FileItem";

interface FileItem {
  type: "file" | "folder";
  name: string;
  path: string;
  size?: number;
  modified?: string;
  mimeType?: string;
}

function RefinedLoginView({
  onLogin,
  loading,
  isConnected,
  prefix,
  setPrefix,
  showSettings,
  setShowSettings,
}: {
  onLogin: () => void;
  loading: boolean;
  isConnected: boolean;
  prefix: string;
  setPrefix: (prefix: string) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setIsLoading(true);
    await onLogin();
    setIsLoading(false);
  };

  const showLoading = loading || isLoading;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-4">
      <div className="w-full max-w-2xl mx-auto">
        {/* TinyCloud Header - Match web-sdk-example exactly */}
        <div className="relative mb-5 inline-block w-full max-w-2xl">
          <a href="https://tinycloud.xyz/protocol" target="_blank" rel="noopener noreferrer">
            <img
              src="/tinycloudheader.png"
              alt="TinyCloud"
              className="w-full rounded-base border-2 border-border bg-bw shadow-shadow"
            />
          </a>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading text-text text-center mb-2">
          TinyCloud Dropbox Example App
        </h1>
        <p className="text-center text-text/70 mb-8 text-sm sm:text-base">
          Decentralized • Secure • Storage
        </p>

        {/* Login Card */}
        <div className="max-w-md mx-auto">
          <div className="bg-bw border-2 border-border shadow-shadow rounded-base p-6 sm:p-8">
            
            {/* Login Button */}
            <button
              onClick={handleLogin}
              disabled={showLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-main border-2 border-border rounded-base hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-none transition-all duration-150 text-mtext font-base shadow-shadow disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {showLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {loading ? "Initializing Storage..." : "Connecting..."}
                </>
              ) : (
                <>
                  <Wallet className="w-5 h-5" />
                  {isConnected ? "Connect to TinyCloud" : "Connect Wallet"}
                </>
              )}
            </button>

            {/* Loading Progress */}
            {showLoading && (
              <div className="mt-6">
                <div className="bg-bg rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-main animate-pulse"></div>
                </div>
                <p className="text-center text-sm text-text/70 mt-3">
                  {loading
                    ? "Setting up your cloud storage..."
                    : "Connecting to Web3 wallet..."}
                </p>
              </div>
            )}

            {/* Settings Section */}
            {!showLoading && (
              <div className="mt-6">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-text/70 hover:bg-bg rounded-base transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  <span>Storage Settings</span>
                  {showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showSettings && (
                  <div className="mt-4 p-4 bg-bg border-2 border-border rounded-base">
                    <label className="block text-sm font-heading text-text mb-2">
                      Folder to Open
                    </label>
                    <input
                      type="text"
                      value={prefix}
                      onChange={(e) => setPrefix(e.target.value)}
                      placeholder="dropbox"
                      className="w-full px-3 py-2 border-2 border-border rounded-base bg-bw text-text focus:outline-none focus:ring-2 focus:ring-main"
                    />
                    <p className="text-xs text-text/60 mt-2">
                      This determines which folder namespace to use for your storage. 
                      Defaults to "dropbox" if left empty.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RefinedHeader({
  onLogout,
  onCreateFolder,
  onUpload,
  currentPath,
  onNavigate,
}: {
  onLogout: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {

  return (
    <header className="fixed top-0 left-0 z-50 flex w-full items-center justify-between bg-bw border-b-2 border-border px-6 py-4">
      {/* Left: Logo and Title */}
      <div className="flex items-center">
        <img 
          src="/tinycloudheader.png" 
          alt="TinyCloud" 
          className="h-10 mr-4" 
        />
        <span className="text-2xl font-heading text-text">
          Tiny Drop Box
        </span>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-4">
        {/* Desktop Actions - Hidden on Mobile */}
        <div className="hidden sm:flex items-center gap-4">
          {/* Theme Toggle */}
          <ThemeSwitcher />

          {/* New Folder Button - Desktop */}
          <button
            onClick={onCreateFolder}
            className="flex items-center gap-2 px-4 py-2 bg-bw border-2 border-border rounded-base hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-sm font-base text-text shadow-shadow"
          >
            <Folder className="w-4 h-4" />
            <span>New Folder</span>
          </button>

          {/* Upload Button - Desktop */}
          <button
            onClick={onUpload}
            className="flex items-center gap-2 px-4 py-2 bg-main border-2 border-border rounded-base hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-sm font-base text-mtext shadow-shadow"
          >
            <Upload className="w-4 h-4" />
            <span>Upload</span>
          </button>

          {/* Logout Button - Desktop */}
          <button
            onClick={onLogout}
            className="w-10 h-10 flex items-center justify-center bg-bw border-2 border-border rounded-base hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 shadow-shadow"
          >
            <LogOut className="w-5 h-5 text-text" />
          </button>
        </div>

        {/* Mobile Dropdown - Shown only on Mobile */}
        <div className="sm:hidden">
          <MobileDropdown
            onCreateFolder={onCreateFolder}
            onUpload={onUpload}
            onLogout={onLogout}
          />
        </div>
      </div>

      {/* Breadcrumb Navigation - Moved below header */}
    </header>
  );
}

function RefinedDropZone({
  isDragOver,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  children,
}: {
  isDragOver: boolean;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "neo-transition-all duration-200 neo-rounded h-full",
        isDragOver
          ? "neo-border border-dashed neo-shadow-lg scale-[1.02] bg-blue-50/30"
          : ""
      )}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
    >
      {isDragOver ? (
        <div className="neo-p-xl text-center neo-bg-card neo-border neo-rounded neo-shadow-lg">
          <div className="neo-pulse">
            <Upload className="w-16 h-16 mx-auto mb-4 neo-text-blue" />
          </div>
          <h2 className="neo-heading mb-2">Drop files here</h2>
          <p className="neo-body neo-text-secondary">
            Release to upload to your storage
          </p>
          <div className="mt-4 neo-text-tiny neo-text-secondary">
            Press <kbd className="neo-kbd">Escape</kbd> to cancel
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function App() {
  const { isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { setOpen } = useModal();

  const [tcw, setTcw] = useState<TinyCloudWeb | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingSignIn, setPendingSignIn] = useState(false);
  const [currentPath, setCurrentPath] = useState("/");
  const [items, setItems] = useState<FileItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [prefix, setPrefix] = useState(() => {
    const saved = localStorage.getItem("tinycloud-prefix");
    return saved || "dropbox";
  });
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefix management
  useEffect(() => {
    localStorage.setItem("tinycloud-prefix", prefix);
  }, [prefix]);


  // Breadcrumb navigation function
  const getBreadcrumb = useCallback(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const paths = [{ name: "Home", path: "/" }];

    parts.forEach((part, i) => {
      paths.push({
        name: part,
        path: "/" + parts.slice(0, i + 1).join("/"),
      });
    });

    return paths;
  }, [currentPath]);

  const onNavigate = (path: string) => {
    setCurrentPath(path);
  };

  // Wallet connection logic
  const signInWithWallet = useCallback(async () => {
    if (!walletClient || tcw) return;

    setLoading(true);
    try {
      const signer = walletClientToEthers5Signer(walletClient as any);
      const tcwProvider = new TinyCloudWeb({
        providers: {
          web3: {
            driver: signer.provider,
          },
        },
        modules: {
          storage: {
            prefix: prefix.trim() || "dropbox",
          },
        },
      });

      await tcwProvider.signIn();
      setTcw(tcwProvider);
    } catch (err) {
      console.error(err);
      alert("Failed to sign in with wallet. Please try again.");
    }
    setLoading(false);
  }, [walletClient, tcw, prefix]);

  useEffect(() => {
    if (!isConnected) {
      tcw?.signOut?.();
      setTcw(null);
      setPendingSignIn(false);
    }
  }, [isConnected, tcw]);

  useEffect(() => {
    if (isConnected && walletClient && pendingSignIn && !tcw) {
      setPendingSignIn(false);
      signInWithWallet();
    }
  }, [isConnected, walletClient, pendingSignIn, tcw, signInWithWallet]);

  const handleLogin = async () => {
    if (!isConnected || !walletClient) {
      setPendingSignIn(true);
      setOpen(true);
      return;
    }

    if (tcw) return;
    await signInWithWallet();
  };

  const handleLogout = async () => {
    tcw?.signOut?.();
    setTcw(null);
  };

  const loadItems = useCallback(async () => {
    if (!tcw) return;

    try {
      const { data: allKeys } = await tcw.storage.list({ removePrefix: false });
      if (!allKeys) return;

      const currentItems: FileItem[] = [];
      const folders = new Set<string>();

      for (const key of allKeys) {
        // KEY FIX: Handle prefixed keys properly
        const keyWithoutPrefix = key.replace(/^[^/]+\//, ""); // Remove prefix from key
        const fullPath = "/" + keyWithoutPrefix;
        const pathParts = fullPath.split("/").filter(Boolean);
        const currentParts = currentPath.split("/").filter(Boolean);

        if (pathParts.length > currentParts.length) {
          const isInCurrentPath = currentParts.every(
            (part, i) => pathParts[i] === part
          );

          if (isInCurrentPath) {
            if (pathParts.length === currentParts.length + 1) {
              try {
                const { data: fileData } = await tcw.storage.get(
                  keyWithoutPrefix
                );
                if (fileData) {
                  const fileSize = new Blob([fileData]).size;
                  currentItems.push({
                    type: "file",
                    name: pathParts[pathParts.length - 1],
                    path: fullPath,
                    size: fileSize,
                    modified: new Date().toISOString(),
                    mimeType: "application/octet-stream",
                  });
                }
              } catch (err) {
                console.error("Error loading file:", err);
              }
            } else {
              const folderName = pathParts[currentParts.length];
              const folderPath =
                "/" + pathParts.slice(0, currentParts.length + 1).join("/");
              folders.add(folderName + "|" + folderPath);
            }
          }
        }
      }

      folders.forEach((folderInfo) => {
        const [name, path] = folderInfo.split("|");
        currentItems.push({
          type: "folder",
          name,
          path,
          size: 0,
          modified: new Date().toISOString(),
        });
      });

      currentItems.sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setItems(currentItems);
    } catch (err) {
      console.error("Error loading items:", err);
    }
  }, [tcw, currentPath]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleFileUpload = async (files: FileList) => {
    if (!tcw) return;

    for (const file of Array.from(files)) {
      if (file.size > 150 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 150MB.`);
        continue;
      }

      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const content = e.target?.result as string;
          // KEY FIX: Don't add prefix - SDK will handle it
          const key =
            currentPath === "/"
              ? file.name
              : currentPath.substring(1) + "/" + file.name;

          await tcw.storage.put(key, content);
          // RELOAD FIX: Refresh data instead of entire page
          loadItems();
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Error uploading file:", err);
        alert(`Error uploading ${file.name}`);
      }
    }
  };

  const createFolder = async () => {
    if (!tcw || !newFolderName.trim()) return;

    try {
      // KEY FIX: Don't add prefix - SDK will handle it
      const key =
        currentPath === "/"
          ? `${newFolderName}/.placeholder`
          : `${currentPath.substring(1)}/${newFolderName}/.placeholder`;
      await tcw.storage.put(key, "");

      setNewFolderModal(false);
      setNewFolderName("");
      // RELOAD FIX: Refresh data instead of entire page
      loadItems();
    } catch (err) {
      console.error("Error creating folder:", err);
      alert("Error creating folder");
    }
  };

  const deleteItem = async (item: FileItem) => {
    if (!tcw) return;

    try {
      if (item.type === "folder") {
        const { data: allKeys } = await tcw.storage.list({
          removePrefix: false,
        });
        if (allKeys) {
          // KEY FIX: Remove prefix from comparison since SDK handles prefixing
          const folderPrefix = item.path.substring(1) + "/";
          const keysToDelete = allKeys.filter((key: string) => {
            // Remove the prefix from the key for comparison
            const keyWithoutPrefix = key.replace(/^[^/]+\//, "");
            return keyWithoutPrefix.startsWith(folderPrefix);
          });

          for (const key of keysToDelete) {
            // KEY FIX: Use the key without prefix since SDK adds prefix
            const keyWithoutPrefix = key.replace(/^[^/]+\//, "");
            await tcw.storage.delete(keyWithoutPrefix);
          }
        }
      } else {
        // KEY FIX: Use the path without leading slash
        await tcw.storage.delete(item.path.substring(1));
      }

      // RELOAD FIX: Refresh data instead of entire page
      loadItems();
    } catch (err) {
      console.error("Error deleting item:", err);
      alert("Error deleting item");
    }
  };

  const downloadFile = async (item: FileItem) => {
    if (!tcw) return;

    try {
      // KEY FIX: Use the path without leading slash (SDK handles prefix)
      const { data: content } = await tcw.storage.get(item.path.substring(1));
      if (content) {
        const link = document.createElement("a");
        link.href = content;
        link.download = item.name;
        link.click();
      }
    } catch (err) {
      console.error("Error downloading file:", err);
      alert("Error downloading file");
    }
  };

  const dragCounterRef = useRef(0);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending reset
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    setDragOver(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;

    // Only reset if we've left all drag targets
    if (dragCounterRef.current === 0) {
      // Add small delay to handle rapid enter/leave events
      dragTimeoutRef.current = setTimeout(() => {
        setDragOver(false);
      }, 50);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Reset drag state
    dragCounterRef.current = 0;
    setDragOver(false);

    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      dragCounterRef.current = 0;
      setDragOver(false);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
        dragTimeoutRef.current = null;
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleGlobalDragEnd();
      }
    };

    // Add global event listeners
    document.addEventListener("dragend", handleGlobalDragEnd);
    document.addEventListener("dragexit", handleGlobalDragEnd);
    document.addEventListener("keydown", handleEscapeKey);
    window.addEventListener("blur", handleGlobalDragEnd);

    return () => {
      document.removeEventListener("dragend", handleGlobalDragEnd);
      document.removeEventListener("dragexit", handleGlobalDragEnd);
      document.removeEventListener("keydown", handleEscapeKey);
      window.removeEventListener("blur", handleGlobalDragEnd);
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  // Login view (includes loading state)
  if (!tcw) {
    return (
      <ThemeProvider>
        <RefinedLoginView
          onLogin={handleLogin}
          loading={loading}
          isConnected={isConnected}
          prefix={prefix}
          setPrefix={setPrefix}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
        />
      </ThemeProvider>
    );
  }

  // Main application
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-bg">
        {/* Header - Fixed */}
        <RefinedHeader
          onLogout={handleLogout}
          onCreateFolder={() => setNewFolderModal(true)}
          onUpload={() => fileInputRef.current?.click()}
          currentPath={currentPath}
          onNavigate={setCurrentPath}
        />

        {/* Breadcrumb Navigation */}
        <div className="mt-16 sm:mt-18 lg:mt-20 bg-bw border-b-2 border-border px-4 sm:px-6 py-2">
          <div className="flex items-center gap-1 sm:gap-2 flex-wrap overflow-x-auto scrollbar-hide">
            {getBreadcrumb().map((crumb: { name: string; path: string }, i: number) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && (
                  <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500 flex-shrink-0" />
                )}
                <button
                  onClick={() => onNavigate(crumb.path)}
                  className="text-xs sm:text-sm font-base whitespace-nowrap min-h-8 px-2 sm:px-3 py-1 hover:bg-bg rounded-base transition-colors text-text"
                >
                  {crumb.name === "Home" ? (
                    <Home className="w-3 h-3 sm:w-4 sm:h-4" />
                  ) : (
                    <span className="max-w-20 sm:max-w-32 lg:max-w-none truncate">
                      {crumb.name}
                    </span>
                  )}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <main className="min-h-[calc(100vh-120px)]">
          {/* File Area */}
          <RefinedDropZone
            isDragOver={dragOver}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <div className="w-full min-h-full bg-bg p-4 sm:p-6 lg:p-8 flex flex-col">
              {items.length === 0 ? (
                <div className="w-full flex-1 flex items-center justify-center">
                  <div className="bg-bw border-2 border-border shadow-shadow rounded-base p-8 sm:p-12 max-w-md mx-auto text-center">
                    <div className="mb-6">
                      <Folder className="w-16 h-16 sm:w-20 sm:h-20 mx-auto text-text/50" />
                    </div>
                    <h2 className="text-xl sm:text-2xl font-heading mb-3 text-text">
                      Empty Folder
                    </h2>
                    <p className="text-text/70 mb-8">
                      This folder is empty. Start by uploading files or creating new folders.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-main border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-mtext font-base rounded-base"
                      >
                        <Upload className="w-5 h-5" />
                        Upload Files
                      </button>
                      <button
                        onClick={() => setNewFolderModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-bw border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-text font-base rounded-base"
                      >
                        <Folder className="w-5 h-5" />
                        Create Folder
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full flex-1">
                  <div className="bg-bw border-2 border-border shadow-shadow rounded-base p-6">
                    <NeoFileGrid
                      items={items}
                      onSelect={(item) => {
                        if (item.type === "folder") {
                          setCurrentPath(item.path);
                        }
                      }}
                      onDelete={(item) => {
                        if (window.confirm(`Delete ${item.name}?`)) {
                          deleteItem(item);
                        }
                      }}
                      onDownload={downloadFile}
                      brutal={false}
                      maxColumns={8}
                    />
                  </div>
                </div>
              )}
            </div>
          </RefinedDropZone>
        </main>

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-14 h-14 bg-main border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-mtext rounded-full flex items-center justify-center"
          >
            <Plus className="w-6 h-6" />
          </button>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
        />

        {/* New Folder Modal */}
        {newFolderModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-bw border-2 border-border shadow-shadow rounded-base p-6 w-full max-w-md">
              <h3 className="text-xl font-heading mb-6 text-center text-text">
                Create New Folder
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-heading text-text mb-2">
                    Folder Name
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && createFolder()}
                    placeholder="Enter folder name..."
                    autoFocus
                    className="w-full px-3 py-2 border-2 border-border rounded-base bg-bw text-text focus:outline-none focus:ring-2 focus:ring-main"
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setNewFolderModal(false);
                      setNewFolderName("");
                    }}
                    className="px-4 py-2 bg-bw border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-text font-base rounded-base"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={createFolder}
                    disabled={!newFolderName.trim()}
                    className="px-4 py-2 bg-main border-2 border-border shadow-shadow hover:translate-x-boxShadowX hover:translate-y-boxShadowY hover:shadow-none transition-all duration-150 text-mtext font-base rounded-base disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
