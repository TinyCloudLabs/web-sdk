import { useState, useEffect } from 'react';
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';
import RadioGroup from '../components/RadioGroup';

interface IStorageModule {
  tcw: TinyCloudWeb;
}

/**
 * StorageModule demonstrates the new sdk-services KV API with Result pattern.
 *
 * Uses tcw.kv for basic operations (get, put, list, delete)
 * Note: Sharing functionality (generate) requires v2 SharingService which is
 * not yet fully integrated. Receiving shares is available via TinyCloudWeb.receiveShare().
 */
function StorageModule({ tcw }: IStorageModule) {
  const [contentList, setContentList] = useState<Array<string>>([]);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [viewingList, setViewingList] = useState<boolean>(true);
  const [allowPost, setAllowPost] = useState<boolean>(false);
  const [removePrefix, setRemovePrefix] = useState<boolean>(false);
  const [sharingLink, setSharingLink] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Get prefix from tcw (used for display purposes)
  const prefix = tcw.kvPrefix;

  useEffect(() => {
    const controller = new AbortController();

    const getContentList = async () => {
      setError(null);
      try {
        // Use new kv.list() with Result pattern
        // Pass abort signal to cancel on unmount (prevents React strict mode race)
        const result = await tcw.kv.list({ removePrefix, signal: controller.signal });
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
  }, [tcw, removePrefix]);

  const handleShareContent = async (content: string) => {
    setError(null);
    // Note: v2 SharingService (generate) is not yet integrated into TinyCloudWeb
    // This requires KeyProvider infrastructure for generating share-specific keys
    // For now, show a message that sharing is coming soon
    setError('Sharing functionality is being upgraded. Please check back soon!');
    console.log('Share requested for:', content);
  };

  const handleCopyLink = async () => {
    if (sharingLink) {
      await navigator.clipboard.writeText(sharingLink);
      alert('Link copied to clipboard!');
    }
  };

  const handleGetContent = async (content: string) => {
    setError(null);
    let reference = removePrefix ? content : content.replace(new RegExp(`^${prefix}/`), '');

    // Use new kv.get() with Result pattern
    const result = await tcw.kv.get<string>(reference);

    if (result.ok) {
      setAllowPost(true);
      setSelectedContent(content);
      setName(content);
      setText(result.data.data ?? '');
      setViewingList(false);
    } else {
      console.error('Failed to get:', result.error.code, result.error.message);
      setError(`Failed to get key: ${result.error.message}`);
    }
  };

  const handleDeleteContent = async (content: string) => {
    setError(null);
    let reference = removePrefix ? content : content.replace(new RegExp(`^${prefix}/`), '');

    // Use new kv.delete() with Result pattern
    const result = await tcw.kv.delete(reference);

    if (result.ok) {
      setContentList(prevList => prevList.filter(c => c !== content));
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
          <h3 className="text-xl font-heading text-text">Storage Prefix: <span className="font-mono">{prefix}</span></h3>
          <p className="text-sm text-text/70">
            The storage prefix is where the keys below live. It's like a folder name for the keys.{' '}
            <code className="rounded bg-main/10 px-1 py-0.5 font-mono text-xs">"{prefix}/key" = value</code>
          </p>
          <RadioGroup
            label="Remove Prefix"
            name="removePrefix"
            options={['On', 'Off']}
            value={removePrefix ? 'On' : 'Off'}
            onChange={(option) => setRemovePrefix(option === 'On')}
            className="mt-4"
          />
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
                {contentList.map(content => (
                  <div
                    key={content}
                    className="flex items-center justify-between rounded-base border-2 border-border/30 bg-bw p-3"
                  >
                    <span className="font-mono text-sm text-text truncate max-w-xs">{content}</span>
                    <div className="flex space-x-2">
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleGetContent(content)}
                      >
                        Get
                      </Button>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleShareContent(content)}
                      >
                        Share
                      </Button>
                      <Button
                        variant="neutral"
                        size="sm"
                        onClick={() => handleDeleteContent(content)}
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
