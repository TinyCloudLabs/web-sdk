import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Folder, File, Download, Trash2, Home, ChevronRight, FileText, Image, Film, Music, Archive, Code, Sun, Moon, LogOut, Wallet } from 'lucide-react';
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';
import { useAccount, useWalletClient } from 'wagmi';
import { useModal } from 'connectkit';
import { walletClientToEthers5Signer } from './utils/web3modalV2Settings';
import { ThemeProvider } from './components/ThemeProvider';
import Header from './components/Header';

// File type icons
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = "w-5 h-5";
  
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return <Image className={iconClass} />;
  } else if (['mp4', 'avi', 'mov', 'webm'].includes(ext)) {
    return <Film className={iconClass} />;
  } else if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
    return <Music className={iconClass} />;
  } else if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return <Archive className={iconClass} />;
  } else if (['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css'].includes(ext)) {
    return <Code className={iconClass} />;
  } else if (['txt', 'doc', 'docx', 'pdf', 'md'].includes(ext)) {
    return <FileText className={iconClass} />;
  }
  return <File className={iconClass} />;
};

// Format file size
const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface FileItem {
  type: 'file' | 'folder';
  name: string;
  path: string;
  size: number;
  modified: string;
  mimeType?: string;
}

// Login View Component
function LoginView({ onLogin, darkMode }: { onLogin: () => void; darkMode: boolean }) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-950' : 'bg-gray-50'}`}>
      <div className="max-w-md w-full mx-4">
        <div className={`${darkMode ? 'bg-gray-900/50' : 'bg-white'} backdrop-blur-xl rounded-2xl shadow-2xl p-8 border ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 mb-4">
              <Folder className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              TinyDropBox
            </h1>
            <p className={`mt-2 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              Decentralized cloud storage powered by TinyCloud
            </p>
          </div>
          
          <button
            onClick={onLogin}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg transform transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
          >
            <Wallet className="w-5 h-5" />
            Connect Wallet & Sign In
          </button>
          
          <p className={`text-center mt-6 text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
            Connect your wallet to access your decentralized storage
          </p>
        </div>
      </div>
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
  const [currentPath, setCurrentPath] = useState('/');
  const [items, setItems] = useState<FileItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [newFolderModal, setNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const signInWithWallet = useCallback(async () => {
    if (!walletClient || tcw) return;

    setLoading(true);
    try {
      const signer = walletClientToEthers5Signer(walletClient as any);
      const tcwProvider = new TinyCloudWeb({
        providers: {
          web3: {
            driver: signer.provider
          }
        },
        modules: {
          storage: {
            prefix: 'dropbox'
          }
        }
      });
      
      await tcwProvider.signIn();
      setTcw(tcwProvider);
    } catch (err) {
      console.error(err);
      alert('Failed to sign in with wallet. Please try again.');
    }
    setLoading(false);
  }, [walletClient, tcw]);

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

  // Load items for current path
  useEffect(() => {
    if (!tcw) return;
    
    const loadItems = async () => {
      try {
        const { data: allKeys } = await tcw.storage.list({ removePrefix: false });
        if (!allKeys) return;

        const currentItems: FileItem[] = [];
        const folders = new Set<string>();
        
        // Process all keys to find items in current path
        for (const key of allKeys) {
          const fullPath = '/' + key;
          const pathParts = fullPath.split('/').filter(Boolean);
          const currentParts = currentPath.split('/').filter(Boolean);
          
          // Check if this key is in current path or a subfolder
          if (pathParts.length > currentParts.length) {
            // Check if path starts with current path
            const isInCurrentPath = currentParts.every((part, i) => pathParts[i] === part);
            
            if (isInCurrentPath) {
              if (pathParts.length === currentParts.length + 1) {
                // It's a file directly in current path
                try {
                  const { data: fileData } = await tcw.storage.get(key);
                  if (fileData) {
                    const fileSize = new Blob([fileData]).size;
                    currentItems.push({
                      type: 'file',
                      name: pathParts[pathParts.length - 1],
                      path: fullPath,
                      size: fileSize,
                      modified: new Date().toISOString(),
                      mimeType: 'application/octet-stream'
                    });
                  }
                } catch (err) {
                  console.error('Error loading file:', err);
                }
              } else {
                // It's in a subfolder - add the folder
                const folderName = pathParts[currentParts.length];
                const folderPath = '/' + pathParts.slice(0, currentParts.length + 1).join('/');
                folders.add(folderName + '|' + folderPath);
              }
            }
          }
        }

        // Add folders to items
        folders.forEach(folderInfo => {
          const [name, path] = folderInfo.split('|');
          currentItems.push({
            type: 'folder',
            name,
            path,
            size: 0,
            modified: new Date().toISOString()
          });
        });

        // Sort items: folders first, then files
        currentItems.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        setItems(currentItems);
      } catch (err) {
        console.error('Error loading items:', err);
      }
    };

    loadItems();
  }, [tcw, currentPath]);

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
          const key = currentPath === '/' ? file.name : currentPath.substring(1) + '/' + file.name;
          
          await tcw.storage.put(key, content);
          
          // Refresh items
          const { data: allKeys } = await tcw.storage.list({ removePrefix: false });
          if (allKeys) {
            // Re-load items (simplified refresh)
            window.location.reload();
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error('Error uploading file:', err);
        alert(`Error uploading ${file.name}`);
      }
    }
  };

  const createFolder = async () => {
    if (!tcw || !newFolderName.trim()) return;
    
    try {
      // Create a placeholder file to represent the folder
      const key = currentPath === '/' ? `${newFolderName}/.placeholder` : `${currentPath.substring(1)}/${newFolderName}/.placeholder`;
      await tcw.storage.put(key, '');
      
      setNewFolderModal(false);
      setNewFolderName('');
      
      // Refresh
      window.location.reload();
    } catch (err) {
      console.error('Error creating folder:', err);
      alert('Error creating folder');
    }
  };

  const deleteItem = async (item: FileItem) => {
    if (!tcw) return;
    
    try {
      if (item.type === 'folder') {
        // Delete all files in folder
        const { data: allKeys } = await tcw.storage.list({ removePrefix: false });
        if (allKeys) {
          const folderPrefix = item.path.substring(1) + '/';
          const keysToDelete = allKeys.filter((key: string) => key.startsWith(folderPrefix));
          
          for (const key of keysToDelete) {
            await tcw.storage.delete(key);
          }
        }
      } else {
        await tcw.storage.delete(item.path.substring(1));
      }
      
      // Refresh
      window.location.reload();
    } catch (err) {
      console.error('Error deleting item:', err);
      alert('Error deleting item');
    }
  };

  const downloadFile = async (item: FileItem) => {
    if (!tcw) return;
    
    try {
      const { data: content } = await tcw.storage.get(item.path.substring(1));
      if (content) {
        const link = document.createElement('a');
        link.href = content;
        link.download = item.name;
        link.click();
      }
    } catch (err) {
      console.error('Error downloading file:', err);
      alert('Error downloading file');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const breadcrumb = () => {
    const parts = currentPath.split('/').filter(Boolean);
    const paths = [{ name: 'Home', path: '/' }];
    
    parts.forEach((part, i) => {
      paths.push({
        name: part,
        path: '/' + parts.slice(0, i + 1).join('/')
      });
    });
    
    return paths;
  };

  if (loading) {
    return (
      <ThemeProvider>
        <div className={`min-h-screen ${darkMode ? 'bg-gray-950' : 'bg-gray-50'} flex items-center justify-center`}>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </ThemeProvider>
    );
  }

  if (!tcw) {
    return (
      <ThemeProvider>
        <Header />
        <LoginView onLogin={handleLogin} darkMode={darkMode} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <Header />
      <div className={`min-h-screen ${darkMode ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-900'} pt-20`}>
        {/* Header */}
        <div className={`${darkMode ? 'bg-gray-900/50' : 'bg-white/80'} backdrop-blur-xl border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
                TinyDropBox
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-2 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-all hover:scale-105`}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={handleLogout}
                  className={`p-2 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-all hover:scale-105`}
                >
                  <LogOut className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setNewFolderModal(true)}
                  className={`px-4 py-2 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg flex items-center gap-2 transition-all hover:scale-105`}
                >
                  <Folder className="w-4 h-4" />
                  New Folder
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-all hover:scale-105"
                >
                  <Upload className="w-4 h-4" />
                  Upload Files
                </button>
              </div>
            </div>
            
            {/* Breadcrumb */}
            <div className={`flex items-center gap-2 mt-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {breadcrumb().map((crumb, i) => (
                <React.Fragment key={crumb.path}>
                  {i > 0 && <ChevronRight className="w-4 h-4" />}
                  <button
                    onClick={() => setCurrentPath(crumb.path)}
                    className={`${darkMode ? 'hover:text-white' : 'hover:text-gray-900'} transition-colors`}
                  >
                    {crumb.name === 'Home' ? <Home className="w-4 h-4" /> : crumb.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div
          className={`flex-1 p-6 transition-all ${dragOver ? 'bg-blue-500/10' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {dragOver && (
            <div className="fixed inset-0 bg-blue-600/20 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
              <div className={`${darkMode ? 'bg-gray-900' : 'bg-white'} rounded-xl p-8 border-2 border-dashed border-blue-500`}>
                <Upload className="w-16 h-16 mx-auto mb-4 text-blue-500" />
                <p className="text-xl font-semibold">Drop files to upload</p>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className={`flex flex-col items-center justify-center h-64 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              <Folder className="w-16 h-16 mb-4" />
              <p className="text-lg">This folder is empty</p>
              <p className="text-sm mt-2">Drag files here or click Upload Files</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {items.map((item) => (
                <div
                  key={item.path}
                  className={`group relative ${darkMode ? 'bg-gray-900/50' : 'bg-white'} backdrop-blur rounded-lg p-4 ${darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-100'} transition-all hover:scale-105 cursor-pointer shadow-sm hover:shadow-lg`}
                  onClick={() => {
                    if (item.type === 'folder') {
                      setCurrentPath(item.path);
                    }
                  }}
                >
                  <div className="flex flex-col items-center">
                    {item.type === 'folder' ? (
                      <Folder className="w-12 h-12 text-blue-500 mb-2" />
                    ) : (
                      <div className={`w-12 h-12 mb-2 flex items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        {getFileIcon(item.name)}
                      </div>
                    )}
                    <p className="text-sm font-medium text-center truncate w-full">{item.name}</p>
                    <p className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} mt-1`}>
                      {item.type === 'file' ? formatSize(item.size) : 'Folder'}
                    </p>
                  </div>
                  
                  {/* Actions */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {item.type === 'file' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadFile(item);
                        }}
                        className={`p-1.5 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded transition-colors`}
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete ${item.name}?`)) {
                          deleteItem(item);
                        }
                      }}
                      className={`p-1.5 ${darkMode ? 'bg-gray-800 hover:bg-red-600' : 'bg-gray-200 hover:bg-red-500 hover:text-white'} rounded transition-colors`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className={`${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} rounded-xl p-6 w-96 border`}>
              <h3 className="text-lg font-semibold mb-4">Create New Folder</h3>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                placeholder="Folder name"
                className={`w-full px-4 py-2 ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-100 border-gray-300'} border rounded-lg focus:outline-none focus:border-blue-500 transition-colors`}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => {
                    setNewFolderModal(false);
                    setNewFolderName('');
                  }}
                  className={`px-4 py-2 ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-200 hover:bg-gray-300'} rounded-lg transition-colors`}
                >
                  Cancel
                </button>
                <button
                  onClick={createFolder}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ThemeProvider>
  );
}

export default App;