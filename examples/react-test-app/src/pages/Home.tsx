import { useEffect, useState } from 'react';
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';
import Header from '../components/Header';
import Title from '../components/Title';
import Dropdown from '../components/Dropdown';
import RadioGroup from '../components/RadioGroup';
import Input from '../components/Input';
import Button from '../components/Button';
import AccountInfo from '../components/AccountInfo';
import { useWeb3Modal } from '@web3modal/react';
import { getWalletClient } from '@wagmi/core'
import StorageModule from '../pages/StorageModule';
import { walletClientToEthers5Signer } from '../utils/web3modalV2Settings';
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
  const [enableDaoLogin, setDaoLogin] = useState<string>('Off');
  const [server, setServer] = useState<string>('Off');
  const [resolveEns, setResolveEns] = useState<string>('Off');
  const [siweConfig, setSiweConfig] = useState<string>('Off');
  const [host, setHost] = useState<string>('');
  const [resolveOnServer, setResolveOnServer] = useState<string>('Off');
  const [resolveEnsDomain, setResolveEnsDomain] = useState<string>('On');
  const [resolveEnsAvatar, setResolveEnsAvatar] = useState<string>('On');
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
  const [storageEnabled, setStorageEnabled] = useState<string>('Off');
  const [credentialsEnabled, setCredentialsEnabled] = useState('Off');

  const getTinyCloudWebConfig = (tcwConfig: Record<string, any> = {}) => {
    if (server === 'On') {
      tcwConfig = {
        providers: {
          ...tcwConfig?.provider,
          server: {
            host
          },
        }
      }
    }

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

    tcwConfig = {
      ...tcwConfig,
      enableDaoLogin: enableDaoLogin === 'On'
    }

    if (resolveEns === 'On') {
      tcwConfig = {
        ...tcwConfig,
        resolveEns: {
          resolveOnServer: resolveOnServer === 'On',
          resolve: {
            domain: resolveEnsDomain === 'On',
            avatar: resolveEnsAvatar === 'On'
          }
        }
      }
    }

    const modules: Record<string, any> = {};

    if (storageEnabled === "On") {
      modules.storage = { hosts: ["https://node.tinycloud.xyz/"]  };
    }

    if (credentialsEnabled === "On") {
      modules.credentials = true;
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
    if (walletClient) {
      signInUsingWeb3Modal(walletClient);
    } else {
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
    <div className='App'>

      <Header />
      <Title />
      <div className='Content'>
        <div className='Content-container'>
          {
            tcw ?
              <>
                <Button
                  id='signOutButton'
                  onClick={tcwLogoutHandler}
                  loading={loading}
                >
                  SIGN-OUT
                </Button>
                <AccountInfo
                  address={tcw?.address()}
                  session={tcw?.session()}
                />
              </> :
              <>
                <Button
                  id='signInButton'
                  onClick={tcwHandler}
                  loading={loading}
                >
                  SIGN-IN WITH ETHEREUM
                </Button>
              </>
          }
          <Dropdown
            id='selectPreferences'
            label='Select Preference(s)'
          >
            <div className='Dropdown-item'>
              <span className='Dropdown-item-name'>
                Provider
              </span>
              <div className='Dropdown-item-options'>
                <RadioGroup
                  name='provider'
                  options={['MetaMask', 'Web3Modal v2']}
                  value={provider}
                  onChange={setProvider}
                  inline={false}
                />
              </div>
            </div>
            <div className='Dropdown-item'>
              <span className='Dropdown-item-name'>
                daoLogin
              </span>
              <div className='Dropdown-item-options'>
                <RadioGroup
                  name='enableDaoLogin'
                  options={['On', 'Off']}
                  value={enableDaoLogin}
                  onChange={setDaoLogin}
                />
              </div>
            </div>
            <div className='Dropdown-item'>
              <span className='Dropdown-item-name'>
                Server
              </span>
              <div className='Dropdown-item-options'>
                <RadioGroup
                  name='server'
                  options={['On', 'Off']}
                  value={server}
                  onChange={setServer}
                />
              </div>
            </div>
            <div className='Dropdown-item'>
              <span className='Dropdown-item-name'>
                resolveEns
              </span>
              <div className='Dropdown-item-options'>
                <RadioGroup
                  name='resolveEns'
                  options={['On', 'Off']}
                  value={resolveEns}
                  onChange={setResolveEns}
                />
              </div>
            </div>
            <div className='Dropdown-item'>
              <span className='Dropdown-item-name'>
                siweConfig
              </span>
              <div className='Dropdown-item-options'>
                <RadioGroup
                  name='siweConfig'
                  options={['On', 'Off']}
                  value={siweConfig}
                  onChange={setSiweConfig}
                />
              </div>
            </div>
            <div className='Dropdown-item'>
              <span className='Dropdown-item-name'>
                Storage
              </span>
              <div className='Dropdown-item-options'>
                <RadioGroup
                  name='storageEnabled'
                  options={['On', 'Off']}
                  value={storageEnabled}
                  onChange={setStorageEnabled}
                />
              </div>
            </div>
            <div className='Dropdown-item'>
              <span className='Dropdown-item-name'>
                Credentials
              </span>
              <div className='Dropdown-item-options'>
                <RadioGroup
                  name='credentialsEnabled'
                  options={['On', 'Off']}
                  value={credentialsEnabled}
                  onChange={setCredentialsEnabled}
                />
              </div>
            </div>
          </Dropdown>
          {
            server === 'On' ?
              <Input
                label='Host'
                value={host}
                onChange={setHost}
              /> :
              null
          }
          {
            resolveEns === 'On' ?
              <>
                <RadioGroup
                  label='Resolve ENS on Server'
                  name='resolveOnServer'
                  options={['On', 'Off']}
                  value={resolveOnServer}
                  onChange={setResolveOnServer}
                />
                <RadioGroup
                  label='Resolve ENS Domain'
                  name='resolveEnsDomain'
                  options={['On', 'Off']}
                  value={resolveEnsDomain}
                  onChange={setResolveEnsDomain}
                />
                <RadioGroup
                  label='Resolve ENS Avatar'
                  name='resolveEnsAvatar'
                  options={['On', 'Off']}
                  value={resolveEnsAvatar}
                  onChange={setResolveEnsAvatar}
                />
              </> :
              null
          }
          {
            siweConfig === 'On' ?
              <div>
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
                  label='Resources'
                  value={resources}
                  onChange={setResources}
                />
                <Input
                  label='Statement'
                  value={statement}
                  onChange={setStatement}
                />
              </div> :
              null
          }
        </div>
        {
          storageEnabled === "On"
          && tcw
          && <StorageModule tcw={tcw} />
        }
      </div>

    </div>
  );
}

export default Home;