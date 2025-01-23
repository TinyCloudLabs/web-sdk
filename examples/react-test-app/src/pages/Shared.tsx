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
    <div className="App">
      <Header />
      <Title />
      <div className="Content">
        <div className="Content-container">
          <Input
            label="Share Data"
            value={shareData}
            onChange={(e: any) => setShareData(e.target.value)}
          />
          <Button
            id="fetchShareData"
            onClick={fetchShareData}
            loading={isLoading}
          >
            Fetch Share Data
          </Button>
          {fetchedData && (
            <div className="Output">
              <pre>{JSON.stringify(fetchedData, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Shared;