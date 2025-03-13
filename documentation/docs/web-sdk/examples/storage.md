---
sidebar_position: 2
title: "Storage Examples"
---

# Storage Examples

Examples demonstrating how to use the TinyCloud storage functionality

## Title

### Example 1: Code Snippet

```typescript
                </a>{' '} to give permission to this app to access your TinyCloud storage. Currently, TinyCloud acts as a key-value store controlled by your Ethereum account, but more features are coming soon. To learn more about TinyCloud Protocol, visit <a className="font-bold underline" target="_blank" rel="noopener noreferrer" href="https://tinycloud.xyz/protocol">tinycloud.xyz</a>.
            </h2>
        </div>
    );
};
```

## Storage Module

### Example 1: Complete Function

```typescript
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
```

### Example 2: Complete Function

```typescript
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
```

## Shared

### Example 1: Complete Function

```typescript
const Shared = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const [shareData, setShareData] = useState(queryParams.get('data') || "");
  const [fetchedData, setFetchedData]: [any, any] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchShareData = async () => {
    setIsLoading(true);
    const tcw = new TinyCloudWeb({ modules: { storage: true } });
    const data = await tcw.storage.retrieveSharingLink(shareData);
    setFetchedData(data);
    setIsLoading(false);
  };
```

## Home

### Example 1: Code Snippet

```typescript
  const [storageEnabled, setStorageEnabled] = useState<string>('On');
```

### Example 2: Code Snippet

```typescript
    if (storageEnabled === "Off") {
      modules.storage = false;
    } else {
      // Configure storage with bucket
      const storageConfig: Record<string, any> = {
        prefix: prefix.trim() || 'default'
      };

      // Add TinyCloud host if provided
      if (tinyCloudHost.trim()) {
        storageConfig.hosts = [tinyCloudHost.trim()];
      }

      modules.storage = storageConfig;
    }
```

### Example 3: Code Snippet

```typescript
                <p className="text-sm text-text/70">Set the prefix that you want to access in your TinyCloud storage.</p>
```

### Example 4: Code Snippet

```typescript
                <p className="text-sm text-text/70">Control whether the TinyCloud storage module is enabled. This allows you to store and retrieve data.</p>
                <RadioGroup
                  name="storageEnabled"
                  options={['On', 'Off']}
                  value={storageEnabled}
                  onChange={setStorageEnabled}
                  label="Enable storage module"
```

### Example 5: Code Snippet

```typescript
        {storageEnabled === "On" && tcw && (
          <div className="mt-8 rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
            <StorageModule tcw={tcw} />
          </div>
        )}
      </div>
      <div className="mt-auto w-full">
        <Footer />
      </div>
    </div>
  );
}
```

