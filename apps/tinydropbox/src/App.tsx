import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Upload,
  Folder,
  Home,
  ChevronRight,
  LogOut,
  Wallet,
  Sun,
  Moon,
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
import { cn } from "./utils/utils";

import {
  NeoBrutalButton,
  NeoBrutalCard,
  NeoBrutalInput,
  NeoButtonPrimary,
  NeoButtonSecondary,
  NeoButtonOutline,
} from "./components/neo";
import { NeoFileGrid, NeoEmptyState } from "./components/neo/FileItem";

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
  darkMode,
  loading,
  isConnected,
  prefix,
  setPrefix,
  showSettings,
  setShowSettings,
}: {
  onLogin: () => void;
  darkMode: boolean;
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
    <div
      className={cn(
        "min-h-screen flex items-center justify-center neo-p-md",
        "neo-bg-primary"
      )}
    >
      <div className="max-w-md w-full">
        <NeoBrutalCard
          variant="default"
          size="lg"
          shadow="lg"
          className="neo-fade-in"
        >
          {/* Header Section */}
          <div className="text-center mb-12">
            {/* Title */}
            <h1 className="neo-display text-3xl mb-3">Tiny Drop Box</h1>
            <p className="neo-body neo-text-secondary">
              Decentralized • Secure • Storage
            </p>
          </div>

          {/* Login Button */}
          <NeoButtonPrimary
            size="lg"
            leftIcon={<Wallet className="w-5 h-5" />}
            loading={showLoading}
            onClick={handleLogin}
            className="w-full"
            disabled={showLoading}
          >
            {showLoading
              ? loading
                ? "Initializing Storage..."
                : "Connecting..."
              : isConnected
              ? "Connect to TinyCloud"
              : "Connect Wallet"}
          </NeoButtonPrimary>

          {/* Loading Progress */}
          {showLoading && (
            <div className="mt-6">
              <div className="neo-bg-secondary neo-rounded-full h-2 overflow-hidden">
                <div className="h-full neo-bg-blue neo-slide-infinite w-1/3"></div>
              </div>
              <p className="neo-small neo-text-secondary text-center mt-3">
                {loading
                  ? "Setting up your cloud storage..."
                  : "Connecting to Web3 wallet..."}
              </p>
            </div>
          )}

          {/* Settings Section */}
          {!showLoading && (
            <div className="mt-6">
              <NeoBrutalButton
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="w-full text-center neo-text-secondary"
                leftIcon={<Settings className="w-4 h-4" />}
                rightIcon={showSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              >
                Storage Settings
              </NeoBrutalButton>

              {showSettings && (
                <div className="mt-4 neo-p-md neo-bg-secondary neo-border neo-rounded">
                  <NeoBrutalInput
                    label="Folder to Open"
                    value={prefix}
                    onChange={(e) => setPrefix(e.target.value)}
                    placeholder="dropbox"
                    className="w-full"
                  />
                  <p className="neo-tiny neo-text-secondary mt-2">
                    This determines which folder namespace to use for your storage. 
                    Defaults to "dropbox" if left empty.
                  </p>
                </div>
              )}
            </div>
          )}
        </NeoBrutalCard>
      </div>
    </div>
  );
}

function RefinedHeader({
  onLogout,
  onCreateFolder,
  onUpload,
  darkMode,
  toggleTheme,
  currentPath,
  onNavigate,
}: {
  onLogout: () => void;
  onCreateFolder: () => void;
  onUpload: () => void;
  darkMode: boolean;
  toggleTheme: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}) {
  const getBreadcrumb = () => {
    const parts = currentPath.split("/").filter(Boolean);
    const paths = [{ name: "Home", path: "/" }];

    parts.forEach((part, i) => {
      paths.push({
        name: part,
        path: "/" + parts.slice(0, i + 1).join("/"),
      });
    });

    return paths;
  };

  return (
    <header className="sticky top-0 z-50 w-full neo-bg-card neo-border-bottom neo-shadow backdrop-blur-sm">
      <div className="neo-container">
        {/* Top row: Logo and Action Buttons */}
        <div className="h-16 flex items-center justify-between">
          {/* Logo Section */}
          <div className="flex items-center neo-gap-sm">
            <div className="w-10 h-10 neo-bg-blue neo-border neo-rounded flex items-center justify-center neo-shadow-sm">
              <Folder className="w-5 h-5 neo-text-inverse" />
            </div>

            <div>
              <h1 className="neo-subheading">Tiny Drop Box</h1>
              <p className="neo-tiny neo-text-secondary">
                Powered by TinyCloud Protocol
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center neo-gap-sm">
            {/* Theme Toggle */}
            <NeoBrutalButton variant="ghost" size="icon" onClick={toggleTheme}>
              {darkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </NeoBrutalButton>

            {/* New Folder Button */}
            <NeoButtonSecondary
              size="md"
              leftIcon={<Folder className="w-4 h-4" />}
              onClick={onCreateFolder}
              className="hidden sm:flex"
            >
              New Folder
            </NeoButtonSecondary>

            {/* Upload Button */}
            <NeoButtonPrimary
              size="md"
              leftIcon={<Upload className="w-4 h-4" />}
              onClick={onUpload}
            >
              Upload
            </NeoButtonPrimary>

            {/* Logout Button */}
            <NeoButtonOutline size="icon" onClick={onLogout}>
              <LogOut className="w-4 h-4" />
            </NeoButtonOutline>
          </div>
        </div>

        {/* Bottom row: Breadcrumb Navigation */}
        <div className="pb-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center neo-gap-xs flex-wrap pt-3">
            {getBreadcrumb().map((crumb, i) => (
              <React.Fragment key={crumb.path}>
                {i > 0 && (
                  <ChevronRight className="w-4 h-4 neo-text-secondary flex-shrink-0" />
                )}
                <NeoBrutalButton
                  variant="ghost"
                  size="sm"
                  onClick={() => onNavigate(crumb.path)}
                  className="neo-tiny font-semibold"
                >
                  {crumb.name === "Home" ? (
                    <Home className="w-4 h-4" />
                  ) : (
                    crumb.name
                  )}
                </NeoBrutalButton>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
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
        "neo-transition-all duration-200 neo-rounded",
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
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [prefix, setPrefix] = useState(() => {
    const saved = localStorage.getItem("tinycloud-prefix");
    return saved || "dropbox";
  });
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Theme management
  useEffect(() => {
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  // Prefix management
  useEffect(() => {
    localStorage.setItem("tinycloud-prefix", prefix);
  }, [prefix]);

  const toggleTheme = () => setDarkMode(!darkMode);

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
          darkMode={darkMode}
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
      <div className="flex flex-col min-h-screen neo-bg-primary">
        {/* Header */}
        <div className="flex-none">
          <RefinedHeader
            onLogout={handleLogout}
            onCreateFolder={() => setNewFolderModal(true)}
            onUpload={() => fileInputRef.current?.click()}
            darkMode={darkMode}
            toggleTheme={toggleTheme}
            currentPath={currentPath}
            onNavigate={setCurrentPath}
          />
        </div>

        {/* Main Content - Full Height */}
        <main className="flex-1 overflow-auto">
          {/* File Area */}
          <RefinedDropZone
            isDragOver={dragOver}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          >
            <div className="w-full min-h-full neo-bg-primary neo-p-lg">
              {items.length === 0 ? (
                <div className="max-w-4xl mx-auto h-full flex items-center justify-center">
                  <NeoBrutalCard variant="default" size="lg" shadow="lg">
                    <NeoEmptyState
                      title="Empty Folder"
                      description="This folder is empty. Start by uploading files or creating new folders."
                      action={
                        <div className="flex flex-col sm:flex-row neo-gap-sm">
                          <NeoButtonPrimary
                            size="lg"
                            leftIcon={<Upload className="w-5 h-5" />}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Upload Files
                          </NeoButtonPrimary>
                          <NeoButtonSecondary
                            size="lg"
                            leftIcon={<Folder className="w-5 h-5" />}
                            onClick={() => setNewFolderModal(true)}
                          >
                            Create Folder
                          </NeoButtonSecondary>
                        </div>
                      }
                    />
                  </NeoBrutalCard>
                </div>
              ) : (
                <div className="max-w-7xl mx-auto">
                  <NeoBrutalCard variant="default" size="lg" shadow="lg">
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
                      columns={6}
                    />
                  </NeoBrutalCard>
                </div>
              )}
            </div>
          </RefinedDropZone>
        </main>

        {/* Floating Action Button */}
        <div className="fixed bottom-6 right-6 z-40">
          <NeoButtonPrimary
            size="xl"
            onClick={() => fileInputRef.current?.click()}
            className="neo-rounded-full w-14 h-14 neo-shadow-lg"
          >
            <Plus className="w-6 h-6" />
          </NeoButtonPrimary>
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 neo-p-md">
            <NeoBrutalCard
              variant="default"
              size="md"
              shadow="lg"
              className="w-full max-w-md"
            >
              <h3 className="neo-heading mb-6 text-center">
                Create New Folder
              </h3>

              <div className="space-y-4">
                <NeoBrutalInput
                  label="Folder Name"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && createFolder()}
                  placeholder="Enter folder name..."
                  autoFocus
                />

                <div className="flex justify-end neo-gap-sm">
                  <NeoButtonSecondary
                    size="md"
                    onClick={() => {
                      setNewFolderModal(false);
                      setNewFolderName("");
                    }}
                  >
                    Cancel
                  </NeoButtonSecondary>

                  <NeoButtonPrimary
                    size="md"
                    onClick={createFolder}
                    disabled={!newFolderName.trim()}
                  >
                    Create
                  </NeoButtonPrimary>
                </div>
              </div>
            </NeoBrutalCard>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;
