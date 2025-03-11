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

  useEffect(() => {
    const getContentList = async () => {
      const { data } = await tcw.storage.list({ removePrefix });
      setContentList(data);
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
    const sharingLink = `${window.location.origin}/share?data=${base64Content}`;
    await navigator.clipboard.writeText(sharingLink);
    return;
  };

  const handleGetContent = async (content: string) => {
    const { data } = await tcw.storage.get(content);
    setAllowPost(true);
    setSelectedContent(content);
    setName(content);
    setText(data);
    setViewingList(false);
  };

  const handleDeleteContent = async (content: string) => {
    await tcw.storage.delete(content);
    setContentList(prevList => prevList.filter(c => c !== content));
    setSelectedContent(null);
    setName('');
    setText('');
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
    <div className="" style={{ marginTop: '30px' }}>
      <div className="storage-container Content-container">
        <div>
          <h3>Storage Prefix: {tcw.storage.prefix}</h3>
          <p>The storage prefix is where the keys below live. It is like folder name for the keys. <code>"{tcw.storage.prefix}/key" = value</code></p>
          <RadioGroup
            label="Remove Prefix"
            name="removePrefix"
            options={['On', 'Off']}
            value={removePrefix ? 'On' : 'Off'  }
            onChange={(option) => setRemovePrefix(option === 'On')}
          />
        </div>
        {viewingList ? (
          <div className="List-pane">
            <h3>Key Value Store</h3>
            {contentList.map(content => (
              <div className="item-container" key={content}>
                <span>{content}</span>
                <Button
                  className="smallButton"
                  onClick={() => handleGetContent(content)}>
                  Get
                </Button>
                <Button
                  className="smallButton"
                  onClick={() => handleDeleteContent(content)}>
                  Delete
                </Button>
                <Button
                  className="smallButton"
                  onClick={() => handleShareContent(content)}>
                  Share
                </Button>
              </div>
            ))}
            <Button onClick={handlePostNewContent}>Post new content</Button>
          </div>
        ) : (
          <div className="View-pane">
            <h3>View/Edit/Post Pane</h3>
            <Input label="Key" value={name} onChange={setName} />
            <Input label="Text" value={text} onChange={setText} />
            {
              allowPost ?
                <Button onClick={handlePostContent}>Post</Button> :
                null
            }
            <Button onClick={() => setViewingList(true)}>Back</Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default StorageModule;
