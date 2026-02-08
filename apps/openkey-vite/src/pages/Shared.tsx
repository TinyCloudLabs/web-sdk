import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { TinyCloudWeb } from "@tinycloud/web-sdk";
import Button from "@/components/Button";
import Input from "@/components/Input";
import Header from "@/components/Header";

interface ParsedShare {
  key: {
    kid?: string;
    kty: string;
    crv: string;
    x: string;
    d?: string;
  };
  keyDid: string;
  delegation: {
    cid: string;
    delegateDID: string;
    spaceId: string;
    path: string;
    actions: string[];
    expiry: string;
    isRevoked: boolean;
    authHeader?: string;
    allowSubDelegation?: boolean;
    createdAt?: string;
  };
  path: string;
  host: string;
  spaceId: string;
  version: number;
}

const Shared = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  const [shareData, setShareData] = useState(
    queryParams.get("share") || queryParams.get("data") || ""
  );
  const [fetchedData, setFetchedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectedData, setInspectedData] = useState<ParsedShare | null>(null);
  const [inspectError, setInspectError] = useState<string | null>(null);

  const inspectShareData = useCallback(() => {
    setInspectError(null);
    setInspectedData(null);
    try {
      let encoded = shareData;
      if (encoded.startsWith("tc1:")) {
        encoded = encoded.slice(4);
      }
      encoded = decodeURIComponent(encoded);
      const decoded = atob(encoded);
      const parsed = JSON.parse(decoded) as ParsedShare;
      setInspectedData(parsed);
    } catch (err) {
      setInspectError(
        `Failed to parse share link: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }, [shareData]);

  useEffect(() => {
    if (shareData) {
      inspectShareData();
    }
  }, [shareData, inspectShareData]);

  const fetchShareData = async () => {
    setIsLoading(true);
    setError(null);
    const result = await TinyCloudWeb.receiveShare(shareData);
    if (result.ok) {
      setFetchedData(result.data);
    } else {
      console.error(
        "Failed to retrieve shared content:",
        result.error.code,
        result.error.message
      );
      setError(
        `Failed to retrieve shared content: ${result.error.message}`
      );
    }
    setIsLoading(false);
  };

  return (
    <>
      <Header />
      <div className="flex min-h-screen flex-col items-center pt-20">
        <div className="w-full max-w-4xl px-4">
          <h1 className="mb-6 text-center text-3xl font-bold">
            TinyCloud + OpenKey
          </h1>

          <div className="mx-auto max-w-2xl rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="space-y-6">
              <h2 className="text-xl font-bold">Shared Content</h2>

              <Input
                label="Share Data"
                value={shareData}
                onChange={(value) => setShareData(value)}
                className="w-full"
              />

              <div className="flex gap-2">
                <Button
                  id="fetchShareData"
                  onClick={fetchShareData}
                  loading={isLoading}
                  variant="default"
                  className="flex-1"
                >
                  Fetch Shared Content
                </Button>
                <Button
                  id="inspectShareData"
                  onClick={inspectShareData}
                  variant="neutral"
                  className="flex-1"
                >
                  Inspect
                </Button>
              </div>

              {inspectError && (
                <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    {inspectError}
                  </p>
                </div>
              )}

              {inspectedData && (
                <div className="mt-4 space-y-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                  <h3 className="text-lg font-bold">
                    Share Link Components:
                  </h3>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-semibold">Host</h4>
                      <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                        {inspectedData.host}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold">Space ID</h4>
                      <p className="break-all font-mono text-sm text-zinc-500 dark:text-zinc-400">
                        {inspectedData.spaceId}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold">Path</h4>
                      <p className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
                        {inspectedData.path}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold">Key DID</h4>
                      <p className="break-all font-mono text-sm text-zinc-500 dark:text-zinc-400">
                        {inspectedData.keyDid}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-semibold">Key (JWK)</h4>
                      <pre className="overflow-x-auto rounded bg-zinc-100 p-2 font-mono text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        {JSON.stringify(
                          {
                            ...inspectedData.key,
                            d: inspectedData.key.d
                              ? "[REDACTED]"
                              : undefined,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </div>

                    <div>
                      <h4 className="font-semibold">Delegation</h4>
                      <div className="ml-2 space-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                        <p>
                          <span className="font-medium">CID:</span>{" "}
                          <span className="break-all font-mono">
                            {inspectedData.delegation.cid}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">Delegate DID:</span>{" "}
                          <span className="break-all font-mono">
                            {inspectedData.delegation.delegateDID}
                          </span>
                        </p>
                        <p>
                          <span className="font-medium">Actions:</span>{" "}
                          {inspectedData.delegation.actions.join(", ")}
                        </p>
                        <p>
                          <span className="font-medium">Expiry:</span>{" "}
                          {inspectedData.delegation.expiry}
                        </p>
                        <p>
                          <span className="font-medium">Revoked:</span>{" "}
                          {inspectedData.delegation.isRevoked ? "Yes" : "No"}
                        </p>
                        <p>
                          <span className="font-medium">Sub-delegation:</span>{" "}
                          {inspectedData.delegation.allowSubDelegation
                            ? "Allowed"
                            : "Not allowed"}
                        </p>
                        {inspectedData.delegation.authHeader && (
                          <div>
                            <p className="font-medium">
                              Auth Header (UCAN JWT):
                            </p>
                            <pre className="max-h-32 overflow-x-auto rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-900">
                              {inspectedData.delegation.authHeader}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {error}
                  </p>
                </div>
              )}

              {fetchedData && (
                <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
                  <h3 className="mb-2 text-lg font-bold">
                    Retrieved Content:
                  </h3>
                  <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-zinc-100 p-4 font-mono text-sm dark:bg-zinc-900">
                    {JSON.stringify(fetchedData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Shared;
