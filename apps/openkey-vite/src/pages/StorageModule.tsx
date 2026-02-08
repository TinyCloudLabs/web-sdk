import { useState, useEffect } from "react";
import type { TinyCloudWeb } from "@tinycloud/web-sdk";
import Input from "@/components/Input";
import Button from "@/components/Button";

interface IStorageModule {
  tcw: TinyCloudWeb;
}

function StorageModule({ tcw }: IStorageModule) {
  const [contentList, setContentList] = useState<Array<string>>([]);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [name, setName] = useState<string>("");
  const [text, setText] = useState<string>("");
  const [viewingList, setViewingList] = useState<boolean>(true);
  const [allowPost, setAllowPost] = useState<boolean>(false);
  const [sharingLink, setSharingLink] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [showExpiryModal, setShowExpiryModal] = useState<boolean>(false);
  const [pendingShareKey, setPendingShareKey] = useState<string | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string>("1hour");

  const expiryOptions = [
    { value: "1hour", label: "1 Hour", ms: 60 * 60 * 1000 },
    { value: "24hours", label: "24 Hours", ms: 24 * 60 * 60 * 1000 },
    { value: "7days", label: "7 Days", ms: 7 * 24 * 60 * 60 * 1000 },
    { value: "30days", label: "30 Days", ms: 30 * 24 * 60 * 60 * 1000 },
  ];

  const prefix = tcw.kvPrefix;
  const getFullPath = (key: string) => (prefix ? `${prefix}/${key}` : key);

  useEffect(() => {
    const controller = new AbortController();

    const getContentList = async () => {
      setError(null);
      try {
        const result = await tcw.kv.list({
          removePrefix: true,
          signal: controller.signal,
        });
        if (result.ok) {
          setContentList(result.data.keys);
        } else {
          if (result.error.code !== "ABORTED") {
            console.error(
              "Failed to list:",
              result.error.code,
              result.error.message
            );
            setError(`Failed to list keys: ${result.error.message}`);
          }
        }
      } catch (err) {
        console.error("Error listing content:", err);
      }
    };
    getContentList();

    return () => {
      controller.abort();
    };
  }, [tcw]);

  const handleShareContent = (key: string) => {
    setError(null);
    setSharingLink("");
    setPendingShareKey(key);
    setSelectedExpiry("1hour");
    setShowExpiryModal(true);
  };

  const handleGenerateShare = async () => {
    if (!pendingShareKey) return;

    setShowExpiryModal(false);
    setError(null);

    const expiryOption = expiryOptions.find((o) => o.value === selectedExpiry);
    const expiryMs = expiryOption?.ms ?? 60 * 60 * 1000;
    const expiryDate = new Date(Date.now() + expiryMs);

    try {
      const result = await tcw.sharing.generate({
        path: pendingShareKey,
        actions: ["tinycloud.kv/get", "tinycloud.kv/list"],
        expiry: expiryDate,
      });

      if (result.ok) {
        const shareUrl = `${window.location.origin}/share?share=${encodeURIComponent(result.data.token)}`;
        setSharingLink(shareUrl);
      } else {
        if (result.error.message.includes("expiry exceeds parent expiry")) {
          setError(
            `Share duration exceeds your session. Try a shorter duration or sign out and back in with a longer session.`
          );
        } else {
          console.error(
            "Failed to generate share link:",
            result.error.code,
            result.error.message
          );
          setError(
            `Failed to generate share link: ${result.error.message}`
          );
        }
      }
    } catch (err) {
      console.error("Error generating share link:", err);
      setError(
        `Error generating share link: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setPendingShareKey(null);
    }
  };

  const handleCopyLink = async () => {
    if (sharingLink) {
      await navigator.clipboard.writeText(sharingLink);
      alert("Link copied to clipboard!");
    }
  };

  const handleGetContent = async (key: string) => {
    setError(null);
    const result = await tcw.kv.get<string>(key);

    if (result.ok) {
      setAllowPost(true);
      setSelectedContent(key);
      setName(key);
      setText(result.data.data ?? "");
      setViewingList(false);
    } else {
      console.error(
        "Failed to get:",
        result.error.code,
        result.error.message
      );
      setError(`Failed to get key: ${result.error.message}`);
    }
  };

  const handleDeleteContent = async (key: string) => {
    setError(null);
    const result = await tcw.kv.delete(key);

    if (result.ok) {
      setContentList((prevList) => prevList.filter((k) => k !== key));
      setSelectedContent(null);
      setName("");
      setText("");
      setSharingLink("");
    } else {
      console.error(
        "Failed to delete:",
        result.error.code,
        result.error.message
      );
      setError(`Failed to delete key: ${result.error.message}`);
    }
  };

  const handlePostContent = async () => {
    setError(null);
    if (!name || !text || name.includes(" ")) {
      alert("Invalid key or text");
      return;
    }

    const result = await tcw.kv.put(name, text);

    if (result.ok) {
      if (selectedContent) {
        setContentList((prevList) =>
          prevList.map((c) => (c === selectedContent ? name : c))
        );
        setSelectedContent(null);
      } else {
        setContentList((prevList) => [...prevList, name]);
      }
      setName("");
      setText("");
      setSharingLink("");
      setViewingList(true);
    } else {
      console.error(
        "Failed to put:",
        result.error.code,
        result.error.message
      );
      setError(`Failed to save: ${result.error.message}`);
    }
  };

  const handlePostNewContent = (e: any) => {
    e.preventDefault();
    setError(null);
    setAllowPost(true);
    setSelectedContent(null);
    setName("");
    setText("");
    setViewingList(false);
  };

  return (
    <div className="w-full">
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xl font-bold">
            Storage Prefix:{" "}
            <span className="font-mono">{prefix || "(none)"}</span>
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            All keys are stored under this prefix. The full path is shown below
            each key.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Expiry Selection Modal */}
        {showExpiryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-sm space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <h3 className="text-lg font-bold">Share Duration</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                How long should this share link be valid?
              </p>
              <div className="space-y-2">
                {expiryOptions.map((option) => (
                  <label
                    key={option.value}
                    className={`flex cursor-pointer items-center rounded-md border p-3 transition-colors ${
                      selectedExpiry === option.value
                        ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950"
                        : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
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
                    <span>{option.label}</span>
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

        <div className="h-px w-full bg-zinc-200 dark:bg-zinc-700" />

        {viewingList ? (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">Key Value Store</h3>

            {sharingLink && (
              <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                <div className="flex flex-col space-y-2">
                  <p className="text-sm font-medium">Sharing Link:</p>
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
                      onClick={() => setSharingLink("")}
                    >
                      Close
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {contentList.length === 0 ? (
              <div className="rounded-md border-2 border-dashed border-zinc-300 p-8 text-center dark:border-zinc-600">
                <p className="text-zinc-500 dark:text-zinc-400">
                  No content available. Add new content to get started.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {contentList.map((key) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-800"
                  >
                    <div className="mr-3 min-w-0 flex-1">
                      <div className="truncate font-mono text-sm">{key}</div>
                      <div className="truncate font-mono text-xs text-zinc-400 dark:text-zinc-500">
                        {getFullPath(key)}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 space-x-2">
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
            <h3 className="text-lg font-bold">
              {selectedContent ? "Edit Content" : "Add New Content"}
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
                    {selectedContent ? "Update" : "Save"}
                  </Button>
                )}
                <Button
                  variant="neutral"
                  onClick={() => {
                    setSharingLink("");
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
