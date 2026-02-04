// @ts-nocheck - Pre-existing type issues with web-sdk version mismatch
import { useState, useEffect } from 'react';
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';
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

  const handleShareContent = async (key: string) => {
    setError(null);
    setSharingLink('');

    try {
      // Generate a sharing link using the v2 SharingService
      // The SharingService will prepend the pathPrefix automatically
      const result = await tcw.sharing.generate({
        path: key,
        actions: ['tinycloud.kv/get', 'tinycloud.kv/list'],
        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      if (result.ok) {
        // Create a shareable URL using the encoded token
        const shareUrl = `${window.location.origin}/share?share=${encodeURIComponent(result.data.token)}`;
        setSharingLink(shareUrl);
      } else {
        console.error('Failed to generate share link:', result.error.code, result.error.message);
        setError(`Failed to generate share link: ${result.error.message}`);
      }
    } catch (err) {
      console.error('Error generating share link:', err);
      setError(`Error generating share link: ${err instanceof Error ? err.message : String(err)}`);
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
