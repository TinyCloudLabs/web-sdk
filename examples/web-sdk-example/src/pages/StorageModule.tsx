import { useState, useEffect } from 'react';
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';
import Input from '../components/Input';
import Button from '../components/Button';
import RadioGroup from '../components/RadioGroup';

interface IStorageModule {
  tcw: TinyCloudWeb;
}

function StorageModule({ tcw }: IStorageModule) {
  const [contentList, setContentList] = useState<Array<string>>([]);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [name, setName] = useState<string>('');
  const [text, setText] = useState<string>('');
  const [viewingList, setViewingList] = useState<boolean>(true);
  const [allowPost, setAllowPost] = useState<boolean>(false);
  const [removePrefix, setRemovePrefix] = useState<boolean>(false);
  const [sharingLink, setSharingLink] = useState<string>('');

  useEffect(() => {
    const getContentList = async () => {
      const res = await tcw.storage.list({ removePrefix });
      if (res.ok && res.data) {
        setContentList(res.data);
      }
    };
    getContentList();
  }, [tcw, removePrefix]);

  const handleShareContent = async (content: string) => {
    const prefix = tcw.storage.prefix;
    let base64Content;
    try {
      let reference = removePrefix ? content : content.replace(new RegExp(`^${prefix}/`), '');
      reference = prefix ? `${prefix}/${reference}` : reference
      base64Content = await tcw.storage.generateSharingLink(
        reference
      );
    } catch (err) {
      console.error(err);
      alert('Failed to generate sharing link. Please refresh the page and try again.');
      return;
    }
    const link = `${window.location.origin}/share?data=${base64Content}`;
    setSharingLink(link);
    return;
  };
  
  const handleCopyLink = async () => {
    if (sharingLink) {
      await navigator.clipboard.writeText(sharingLink);
      alert('Link copied to clipboard!');
    }
  };

  const handleGetContent = async (content: string) => {
    let reference = removePrefix ? content : content.replace(new RegExp(`^${tcw.storage.prefix}/`), '');
    const { data } = await tcw.storage.get(reference);
    setAllowPost(true);
    setSelectedContent(content);
    setName(content);
    setText(data);
    setViewingList(false);
  };

  const handleDeleteContent = async (content: string) => {
    let reference = removePrefix ? content : content.replace(new RegExp(`^${tcw.storage.prefix}/`), '');
    await tcw.storage.delete(reference);
    setContentList(prevList => prevList.filter(c => c !== content));
    setSelectedContent(null);
    setName('');
    setText('');
    setSharingLink('');
  };

  const handlePostContent = async () => {
    // check for invalid key
    if (!name || !text || name.includes(' ')) {
      alert('Invalid key or text');
      return;
    }
    await tcw.storage.put(name, text);
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
  };

  const handlePostNewContent = (e: any) => {
    e.preventDefault();
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
          <h3 className="text-xl font-heading text-text">Storage Prefix: <span className="font-mono">{tcw.storage.prefix}</span></h3>
          <p className="text-sm text-text/70">
            The storage prefix is where the keys below live. It's like a folder name for the keys.{' '}
            <code className="rounded bg-main/10 px-1 py-0.5 font-mono text-xs">"{tcw.storage.prefix}/key" = value</code>
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
