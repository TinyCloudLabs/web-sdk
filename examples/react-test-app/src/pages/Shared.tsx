import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';
import Header from '../components/Header';
import Button from '../components/Button';
import Title from '../components/Title';
import Input from '../components/Input';

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

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg pt-20">
      <div className="w-full max-w-4xl px-4">
        <Title />
        
        <div className="mx-auto max-w-2xl rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
          <div className="space-y-6">
            <h2 className="text-xl font-heading text-text">Shared Content</h2>
            
            <Input
              label="Share Data"
              value={shareData}
              onChange={(value) => setShareData(value)}
              className="w-full"
            />
            
            <Button
              id="fetchShareData"
              onClick={fetchShareData}
              loading={isLoading}
              variant="default"
              className="w-full"
            >
              Fetch Shared Content
            </Button>
            
            {fetchedData && (
              <div className="mt-6 rounded-base border-2 border-border/30 bg-bw/50 p-4">
                <h3 className="mb-2 text-lg font-heading text-text">Retrieved Content:</h3>
                <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-main/10 p-4 font-mono text-sm text-text">
                  {JSON.stringify(fetchedData, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Shared;