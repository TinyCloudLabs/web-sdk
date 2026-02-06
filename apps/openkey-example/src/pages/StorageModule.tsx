// @ts-nocheck - Pre-existing type issues with web-sdk version mismatch
import { useState, useEffect } from 'react';
import { TinyCloudWeb } from '@tinycloud/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';

interface IStorageModule {
  tcw: TinyCloudWeb;
}

/**
 * StorageModule demonstrates the sdk-services KV API with Result pattern.
 *
 * Uses tcw.kv for basic operations (get, put, list, delete)
 * Uses tcw.sharing for generating share links (v2 SharingService)
 * Receiving shares is available via TinyCloudWeb.receiveShare() static method.
 */
function StorageModule({ tcw }: IStorageModule) {
  const [contentList, setContentList] = useState<Array<string>>([]);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [viewingList, setViewingList] = useState<boolean>(true);
  const [allowPost, setAllowPost] = useState<boolean>(false);
  const [sharingLink, setSharingLink] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showExpiryModal, setShowExpiryModal] = useState<boolean>(false);
  const [pendingShareKey, setPendingShareKey] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>('1hour');

  // Expiry options
  const expiryOptions = [
    { value: '1hour', label: '1 Hour', ms: 60 * 60 * 1000 },
    { value: '24hours', label: '24 Hours', ms: 24 * 60 * 60 * 1000 },
    { value: '7days', label: '7 Days', ms: 7 * 24 * 60 * 60 * 1000 },
    { value: '30days', label: '30 Days', ms: 30 * 24 * 60 * 60 * 1000 },
  ];

  // Get prefix from tcw (used for display purposes)
  const prefix = tcw.kvPrefix;

  // Helper to get full path from short key
  const getFullPath = (key: string) => prefix ? `${prefix}/${key}` : key;

  useEffect(() => {
    const controller = new AbortController();

    const getContentList = async () => {
      setError(null);
      try {
        // Use new kv.list() with Result pattern
        // Always remove prefix for cleaner display - we show full path as subtitle
        const result = await tcw.kv.list({ removePrefix: true, signal: controller.signal });
        if (result.ok) {
          setContentList(result.data.keys);
        } else {
          // Don't show error if request was aborted
          if (result.error.code !== 'ABORTED') {
            console.error('Failed to list:', result.error.code, result.error.message);
            setError(`Failed to list keys: ${result.error.message}`);
          }
        }
      } catch (err) {
        // KV service may not be ready yet (not signed in)
        console.error('Error listing content:', err);
      }
    };
    getContentList();

    return () => {
      controller.abort();
    };
  }, [tcw]);

  // Open expiry selection modal before sharing
  const handleShareContent = (key: string) => {
    setError(null);
    setSharingLink('');
    setPendingShareKey(key);
    setSelectedExpiry('1hour'); // Reset to default
    setShowExpiryModal(true);
  };

  // Generate share link with selected expiry
  const handleGenerateShare = async () => {
    if (!pendingShareKey) return;

    setShowExpiryModal(false);
    setError(null);

    const expiryOption = expiryOptions.find(o => o.value === selectedExpiry);
    const expiryMs = expiryOption?.ms ?? 60 * 60 * 1000;
    const expiryDate = new Date(Date.now() + expiryMs);

    try {
      // Generate a sharing link using the v2 SharingService
      // The SharingService will prepend the pathPrefix automatically
      const result = await tcw.sharing.generate({
        path: pendingShareKey,
        actions: ['tinycloud.kv/get', 'tinycloud.kv/list'],
        expiry: expiryDate,
      });

      if (result.ok) {
        // Create a shareable URL using the encoded token
        const shareUrl = `${window.location.origin}/share?share=${encodeURIComponent(result.data.token)}`;
        setSharingLink(shareUrl);
      } else {
        // Check if it's an expiry issue and provide helpful guidance
        if (result.error.message.includes('expiry exceeds parent expiry')) {
          setError(
            `Share duration exceeds your session. ` +
            `Try a shorter duration or sign out and back in with a longer session.`
          );
        } else {
          console.error('Failed to generate share link:', result.error.code, result.error.message);
          setError(`Failed to generate share link: ${result.error.message}`);
        }
      }
    } catch (err) {
      console.error('Error generating share link:', err);
      setError(`Error generating share link: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPendingShareKey(null);
    }
  };

  const handleCopyLink = async () => {
    if (sharingLink) {
      await navigator.clipboard.writeText(sharingLink);
      alert('Link copied to clipboard!');
    }
  };

  const handleGetContent = async (key: string) => {
    setError(null);

    // Use new kv.get() with Result pattern
    const result = await tcw.kv.get<string>(key);

    if (result.ok) {
      setAllowPost(true);
      setSelectedContent(key);
      setName(key);
      setText(result.data.data ?? '');
      setViewingList(false);
    } else {
      console.error('Failed to get:', result.error.code, result.error.message);
      setError(`Failed to get key: ${result.error.message}`);
    }
  };

  const handleDeleteContent = async (key: string) => {
    setError(null);

    // Use new kv.delete() with Result pattern
    const result = await tcw.kv.delete(key);

    if (result.ok) {
      setContentList(prevList => prevList.filter(k => k !== key));
      setSelectedContent(null);
      setName('');
      setText('');
      setSharingLink('');
    } else {
      console.error('Failed to delete:', result.error.code, result.error.message);
      setError(`Failed to delete key: ${result.error.message}`);
    }
  };

  const handlePostContent = async () => {
    setError(null);
    // check for invalid key
    if (!name || !text || name.includes(' ')) {
      alert('Invalid key or text');
      return;
    }

    // Use new kv.put() with Result pattern
    const result = await tcw.kv.put(name, text);

    if (result.ok) {
      if (selectedContent) {
        setContentList(prevList =>
          prevList.map(c => (c === selectedContent ? name : c))
        );
        setSelectedContent(null);
      } else {
        setContentList(prevList => [...prevList, name]);
      }
      setName('');
      setText('');
      setSharingLink('');
      setViewingList(true);
    } else {
      console.error('Failed to put:', result.error.code, result.error.message);
      setError(`Failed to save: ${result.error.message}`);
    }
  };

  const handlePostNewContent = (e: any) => {
    e.preventDefault();
    setError(null);
    setAllowPost(true);
    setSelectedContent(null);
    setName('');
    setText('');
    setViewingList(false);
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xl font-heading text-text">Storage Prefix: <span className="font-mono">{prefix || '(none)'}</span></h3>
          <p className="text-sm text-text/70">
            All keys are stored under this prefix. The full path is shown below each key.
          </p>
        </div>

        {error && (
          <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Expiry Selection Modal */}
        {showExpiryModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-bw rounded-base border-2 border-border p-6 max-w-sm w-full mx-4 space-y-4">
              <h3 className="text-lg font-heading text-text">Share Duration</h3>
              <p className="text-sm text-text/70">
                How long should this share link be valid?
              </p>
              <div className="space-y-2">
                {expiryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center p-3 rounded-base border-2 cursor-pointer transition-colors ${
                      selectedExpiry === option.value
                        ? 'border-main bg-main/10'
                        : 'border-border/50 hover:border-border'
                    }`}
                  >
                    <input
                      type="radio"
                      name="expiry"
                      value={option.value}
                      checked={selectedExpiry === option.value}
                      onChange={(e) => setSelectedExpiry(e.target.value)}
                      className="mr-3"
                    />
                    <span className="text-text">{option.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex space-x-3 pt-2">
                <Button
                  variant="default"
                  onClick={handleGenerateShare}
                  className="flex-1"
                >
                  Generate Link
                </Button>
                <Button
                  variant="neutral"
                  onClick={() => {
                    setShowExpiryModal(false);
                    setPendingShareKey(null);
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="h-px w-full bg-border/20" />

        {viewingList ? (
          <div className="space-y-4">
            <h3 className="text-lg font-heading text-text">Key Value Store</h3>

            {sharingLink && (
              <div className="mb-4 rounded-base border-2 border-main/30 bg-main/10 p-3">
                <div className="flex flex-col space-y-2">
                  <p className="text-sm font-medium text-text">Sharing Link:</p>
                  <div className="flex items-center space-x-2">
                    <Input
                      label=""
                      value={sharingLink}
                      onChange={() => {}}
                      className="flex-1"
                    />
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleCopyLink}
                    >
                      Copy
                    </Button>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="neutral"
                      size="sm"
                      onClick={() => setSharingLink('')}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {contentList.length === 0 ? (
              <div className="rounded-base border-2 border-dashed border-border/50 bg-bw/50 p-8 text-center">
                <p className="text-text/70">No content available. Add new content to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {contentList.map(key => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-base border-2 border-border/30 bg-bw p-3"
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="font-mono text-sm text-text truncate">{key}</div>
                      <div className="font-mono text-xs text-text/50 truncate">{getFullPath(key)}</div>
                    </div>
                    <div className="flex space-x-2 flex-shrink-0">
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleGetContent(key)}
                      >
                        Get
                      </Button>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleShareContent(key)}
                      >
                        Share
                      </Button>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleDeleteContent(key)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button
              variant="default"
              onClick={handlePostNewContent}
              className="mt-4 w-full"
            >
              Add New Content
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-heading text-text">
              {selectedContent ? 'Edit Content' : 'Add New Content'}
            </h3>

            <div className="space-y-4">
              <Input
                label="Key"
                value={name}
                onChange={setName}
                className="w-full"
              />
              <Input
                label="Value"
                value={text}
                onChange={setText}
                className="w-full"
              />

              <div className="flex space-x-3 pt-2">
                {allowPost && (
                  <Button
                    variant="default"
                    onClick={handlePostContent}
                    className="flex-1"
                  >
                    {selectedContent ? 'Update' : 'Save'}
                  </Button>
                )}
                <Button
                  variant="neutral"
                  onClick={() => {
                    setSharingLink('');
                    setViewingList(true);
                  }}
                  className="flex-1"
                >
                  Back to List
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StorageModule;
