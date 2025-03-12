import { useEffect, useState } from 'react';
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';
import Title from '../components/Title';
import Dropdown from '../components/Dropdown';
import RadioGroup from '../components/RadioGroup';
import Input from '../components/Input';
import Button from '../components/Button'; 
import AccountInfo from '../components/AccountInfo';
import { useWeb3Modal } from '@web3modal/react';
import StorageModule from '../pages/StorageModule';
import { walletClientToEthers5Signer } from '../utils/web3modalV2Settings';
import { getWalletClient } from '@wagmi/core'
import { useWalletClient } from 'wagmi';

declare global {
  interface Window {
    tcw: TinyCloudWeb;
  }
}

function Home() {

  const { open: openWeb3Modal } = useWeb3Modal();
  const { data: walletClient } = useWalletClient()

  const [loading, setLoading] = useState(false);

  const [tcw, setTinyCloudWeb] = useState<TinyCloudWeb | null>(null);
  const [provider, setProvider] = useState<string>('MetaMask');
  const [resolveEns, setResolveEns] = useState<string>('Off');
  const [siweConfig, setSiweConfig] = useState<string>('Off');
  // siweConfig Fields
  const [address, setAddress] = useState<string>('');
  const [chainId, setChainId] = useState<string>('');
  const [domain, setDomain] = useState<string>('');
  const [nonce, setNonce] = useState<string>('');
  const [issuedAt, setIssuedAt] = useState<string>('');
  const [expirationTime, setExpirationTime] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [notBefore, setNotBefore] = useState<string>('');
  const [resources, setResources] = useState<string>('');
  const [statement, setStatement] = useState<string>('');
  // tcw module config
  const [storageEnabled, setStorageEnabled] = useState<string>('On');

  const getTinyCloudWebConfig = (tcwConfig: Record<string, any> = {}) => {

    if (siweConfig === 'On') {
      const siweConfig: Record<string, any> = {};
      if (address) siweConfig.address = address;
      if (chainId) siweConfig.chainId = chainId;
      if (domain) siweConfig.domain = domain;
      if (nonce) siweConfig.nonce = nonce;
      if (issuedAt) siweConfig.issuedAt = issuedAt;
      if (expirationTime) siweConfig.expirationTime = expirationTime;
      if (requestId) siweConfig.requestId = requestId;
      if (notBefore) siweConfig.notBefore = notBefore;
      if (resources) siweConfig.resources = resources.split(',').map(r => r.trim());
      if (statement) siweConfig.statement = statement;
      tcwConfig = {
        ...tcwConfig,
        ...(siweConfig && { siweConfig })
      }
    }

    if (resolveEns === 'On') {
      tcwConfig = {
        ...tcwConfig,
        resolveEns: true
      }
    }

    const modules: Record<string, any> = {};

    if (storageEnabled === "Off") {
      modules.storage = false;
    }

    if (modules) {
      tcwConfig = {
        ...tcwConfig,
        modules
      }
    }

    return tcwConfig;
  };

  const signInUsingWeb3Modal = async (walletClient: any) => {
    const chainId = await walletClient.getChainId();
    const newWalletClient = await getWalletClient({ chainId });
    const signer = walletClientToEthers5Signer(newWalletClient as any);
    if (tcw) return;

    setLoading(true);
    const tcwConfig = getTinyCloudWebConfig({
      provider: {
        web3: {
          driver: signer.provider
        }
      }
    });

    const tcwProvider = new TinyCloudWeb(tcwConfig);

    try {
      await tcwProvider.signIn();
      setTinyCloudWeb(tcwProvider);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => {
    if (!walletClient) {
      tcw?.signOut?.();
      setTinyCloudWeb(null);
    }
    // eslint-disable-next-line
  }, [walletClient]);

  const tcwHandler = async () => {
    if (provider === 'Web3Modal v2') {
      return openWeb3Modal();
    } else {
      setLoading(true);
      let tcwConfig = getTinyCloudWebConfig();

      const tcw = new TinyCloudWeb(tcwConfig);
      window.tcw = tcw;

      try {
        await tcw.signIn();
        setTinyCloudWeb(tcw);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    }
  };

  const tcwLogoutHandler = async () => {
    if (provider === 'Web3Modal v2') {
      return openWeb3Modal();
    }

    tcw?.signOut?.();
    setTinyCloudWeb(null);
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-bg pt-20">
      <div className="w-full max-w-4xl px-4">
        <Title />
        
        <div className="mx-auto max-w-2xl rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
          <div className="space-y-6">
            {tcw ? (
              <>
                <Button
                  id="signOutButton"
                  onClick={tcwLogoutHandler}
                  loading={loading}
                  variant="default"
                  className="w-full"
                >
                  SIGN-OUT
                </Button>
                <AccountInfo
                  address={tcw?.address()}
                  session={tcw?.session()}
                  className="mt-6"
                />
              </>
            ) : (
              <>
                <Button
                  id="signInButton"
                  onClick={tcwHandler}
                  loading={loading}
                  variant="default"
                  className="w-full"
                >
                  SIGN-IN WITH ETHEREUM
                </Button>
              </>
            )}
            
            {!tcw && (
              <div className="space-y-6 pt-4">
                <Dropdown
                  id="selectPreferences"
                  label="Select Preference(s)"
                  className="w-full"
                >
                  <div className="Dropdown-item">
                    <span className="Dropdown-item-name">
                      resolveEns
                    </span>
                    <div className="Dropdown-item-options">
                      <RadioGroup
                        name="resolveEns"
                        options={['On', 'Off']}
                        value={resolveEns}
                        onChange={setResolveEns}
                      />
                    </div>
                  </div>
                  <div className="Dropdown-item">
                    <span className="Dropdown-item-name">
                      siweConfig
                    </span>
                    <div className="Dropdown-item-options">
                      <RadioGroup
                        name="siweConfig"
                        options={['On', 'Off']}
                        value={siweConfig}
                        onChange={setSiweConfig}
                      />
                    </div>
                  </div>
                  <div className="Dropdown-item">
                    <span className="Dropdown-item-name">
                      Storage
                    </span>
                    <div className="Dropdown-item-options">
                      <RadioGroup
                        name="storageEnabled"
                        options={['On', 'Off']}
                        value={storageEnabled}
                        onChange={setStorageEnabled}
                      />
                    </div>
                  </div>
                </Dropdown>
                
                {siweConfig === 'On' && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label='Address'
                      value={address}
                      onChange={setAddress}
                    />
                    <Input
                      label='Chain ID'
                      value={chainId}
                      onChange={setChainId}
                    />
                    <Input
                      label='Domain'
                      value={domain}
                      onChange={setDomain}
                    />
                    <Input
                      label='Nonce'
                      value={nonce}
                      onChange={setNonce}
                    />
                    <Input
                      label='Issued At'
                      value={issuedAt}
                      onChange={setIssuedAt}
                    />
                    <Input
                      label='Expiration Time'
                      value={expirationTime}
                      onChange={setExpirationTime}
                    />
                    <Input
                      label='Request ID'
                      value={requestId}
                      onChange={setRequestId}
                    />
                    <Input
                      label='Not Before'
                      value={notBefore}
                      onChange={setNotBefore}
                    />
                    <Input
                      className="md:col-span-2"
                      label='Resources'
                      value={resources}
                      onChange={setResources}
                    />
                    <Input
                      className="md:col-span-2"
                      label='Statement'
                      value={statement}
                      onChange={setStatement}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {storageEnabled === "On" && tcw && (
          <div className="mt-8 rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
            <StorageModule tcw={tcw} />
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;