import { useState, useEffect } from 'react';
import { TinyCloudWeb, ISpace } from '@tinycloudlabs/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';

interface ISpaceModule {
  tcw: TinyCloudWeb;
}

/**
 * SpaceModule demonstrates the space-scoped KV API.
 *
 * Uses tcw.space('default') for space-scoped operations (get, put, list, delete).
 * Shows the difference between root-level and space-scoped KV access.
 */
function SpaceModule({ tcw }: ISpaceModule) {
  const [spaceName, setSpaceName] = useState<string>('default');
  const [space, setSpace] = useState<ISpace | null>(null);
  const [contentList, setContentList] = useState<Array<string>>([]);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [viewingList, setViewingList] = useState<boolean>(true);
  const [allowPost, setAllowPost] = useState<boolean>(false);
  const [prefix, setPrefix] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // Get the current space when spaceName changes
  useEffect(() => {
    try {
      const spaceObj = tcw.space(spaceName);
      setSpace(spaceObj);
    } catch (err) {
      console.error('Error getting space:', err);
      setSpace(null);
    }
  }, [tcw, spaceName]);

  // List keys when space changes
  useEffect(() => {
    if (!space) return;

    const controller = new AbortController();

    const getContentList = async () => {
      setError(null);
      try {
        // Use space-scoped KV list
        const kv = prefix ? space.kv.withPrefix(prefix) : space.kv;
        const result = await kv.list({ signal: controller.signal });
        if (result.ok) {
          setContentList(result.data.keys);
        } else {
          if (result.error.code !== 'ABORTED') {
            console.error('Failed to list:', result.error.code, result.error.message);
            setError(`Failed to list keys: ${result.error.message}`);
          }
        }
      } catch (err) {
        console.error('Error listing content:', err);
      }
    };
    getContentList();

    return () => {
      controller.abort();
    };
  }, [space, prefix]);

  const handleGetContent = async (content: string) => {
    if (!space) return;
    setError(null);

    const kv = prefix ? space.kv.withPrefix(prefix) : space.kv;
    const result = await kv.get<string>(content);

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
    if (!space) return;
    setError(null);

    const kv = prefix ? space.kv.withPrefix(prefix) : space.kv;
    const result = await kv.delete(content);

    if (result.ok) {
      setContentList(prevList => prevList.filter(c => c !== content));
      setSelectedContent(null);
      setName('');
      setText('');
    } else {
      console.error('Failed to delete:', result.error.code, result.error.message);
      setError(`Failed to delete key: ${result.error.message}`);
    }
  };

  const handlePostContent = async () => {
    if (!space) return;
    setError(null);

    if (!name || !text || name.includes(' ')) {
      alert('Invalid key or text');
      return;
    }

    const kv = prefix ? space.kv.withPrefix(prefix) : space.kv;
    const result = await kv.put(name, text);

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

  const handlePrefixChange = (newPrefix: string) => {
    setPrefix(newPrefix);
    setContentList([]);
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xl font-heading text-text">
            Space: <span className="font-mono">{spaceName}</span>
          </h3>
          {space && (
            <p className="text-sm text-text/70 font-mono break-all">
              Space ID: {space.id}
            </p>
          )}
          <p className="text-sm text-text/70">
            Space-scoped KV operations. Keys are stored within this space's scope.
          </p>

          <div className="flex gap-4 items-end">
            <Input
              label="Prefix Filter (optional)"
              value={prefix}
              onChange={handlePrefixChange}
              className="flex-1"
            />
            <Button
              variant="neutral"
              size="sm"
              onClick={() => handlePrefixChange('')}
            >
              Clear
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-base border-2 border-red-300 bg-red-50 p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="h-px w-full bg-border/20" />

        {viewingList ? (
          <div className="space-y-4">
            <h3 className="text-lg font-heading text-text">
              Space KV Store {prefix && <span className="text-sm font-mono text-text/70">(prefix: {prefix})</span>}
            </h3>

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
                  onClick={() => setViewingList(true)}
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

export default SpaceModule;
