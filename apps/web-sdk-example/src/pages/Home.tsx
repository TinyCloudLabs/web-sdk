import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { TinyCloudWeb } from "@tinycloudlabs/web-sdk";
import Title from "../components/Title";
import RadioGroup from "../components/RadioGroup";
import Input from "../components/Input";
import Button from "../components/Button";
import AccountInfo from "../components/AccountInfo";
import { lazy } from "react";
import { useAccount, useWalletClient } from "wagmi";
import { useModal } from "connectkit";
import { walletClientToEthers5Signer } from "../utils/web3modalV2Settings";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordian";
import Footer from "../components/Footer";
import Header from "../components/Header";

const StorageModule = lazy(() => import("../pages/StorageModule"));
declare global {
  interface Window {
    tcw: TinyCloudWeb;
  }
}

function Home() {
  const location = useLocation();
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { setOpen } = useModal();

  const [loading, setLoading] = useState(false);

  const [tcw, setTinyCloudWeb] = useState<TinyCloudWeb | null>(null);
  const [resolveEns, setResolveEns] = useState<string>("On");
  const [siweConfig, setSiweConfig] = useState<string>("Off");
  // siweConfig Fields
  const [siweAddress, setSiweAddress] = useState<string>("");
  const [chainId, setChainId] = useState<string>("");
  const [domain, setDomain] = useState<string>("");
  const [nonce, setNonce] = useState<string>("");
  const [issuedAt, setIssuedAt] = useState<string>("");
  const [expirationTime, setExpirationTime] = useState<string>("");
  const [requestId, setRequestId] = useState<string>("");
  const [notBefore, setNotBefore] = useState<string>("");
  const [resources, setResources] = useState<string>("");
  const [statement, setStatement] = useState<string>("");
  // tcw module config
  const [storageEnabled, setStorageEnabled] = useState<string>("On");
  const [prefix, setPrefix] = useState<string>("demo-app");
  const [tinyCloudHost, setTinyCloudHost] = useState<string>("");

  // Parse URL parameters on component mount
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);

    // Handle prefix parameter
    const urlPrefix = queryParams.get("prefix");
    if (urlPrefix) {
      setPrefix(urlPrefix);
    }
  }, [location.search]);

  const getTinyCloudWebConfig = (tcwConfig: Record<string, any> = {}) => {
    if (siweConfig === "On") {
      const siweConfig: Record<string, any> = {};
      if (siweAddress) siweConfig.address = siweAddress;
      if (chainId) siweConfig.chainId = chainId;
      if (domain) siweConfig.domain = domain;
      if (nonce) siweConfig.nonce = nonce;
      if (issuedAt) siweConfig.issuedAt = issuedAt;
      if (expirationTime) siweConfig.expirationTime = expirationTime;
      if (requestId) siweConfig.requestId = requestId;
      if (notBefore) siweConfig.notBefore = notBefore;
      if (resources)
        siweConfig.resources = resources.split(",").map((r) => r.trim());
      if (statement) siweConfig.statement = statement;
      tcwConfig = {
        ...tcwConfig,
        ...(siweConfig && { siweConfig }),
      };
    }

    if (resolveEns === "On") {
      tcwConfig = {
        ...tcwConfig,
        resolveEns: true,
      };
    }

    const modules: Record<string, any> = {};

    if (storageEnabled === "Off") {
      modules.storage = false;
    } else {
      // Configure storage with bucket
      const storageConfig: Record<string, any> = {
        prefix: prefix.trim(),
      };

      // Add TinyCloud host if provided
      if (tinyCloudHost.trim()) {
        storageConfig.hosts = [tinyCloudHost.trim()];
      }

      modules.storage = storageConfig;
    }

    tcwConfig = {
      ...tcwConfig,
      modules,
    };

    // Add TinyCloud hosts at top level for UserAuthorization
    if (tinyCloudHost.trim()) {
      tcwConfig.tinycloudHosts = [tinyCloudHost.trim()];
    }

    return tcwConfig;
  };

  const signInWithWallet = async () => {
    if (!walletClient || tcw) return;

    setLoading(true);

    try {
      const signer = walletClientToEthers5Signer(walletClient as any);
      const tcwConfig = getTinyCloudWebConfig({
        provider: {
          web3: {
            driver: signer.provider,
          },
        },
      });

      const tcwProvider = new TinyCloudWeb(tcwConfig);

      // Proceed with sign-in
      // signIn() will initialize KV service automatically
      await tcwProvider.signIn();
      setTinyCloudWeb(tcwProvider);
    } catch (err) {
      console.error("Sign-in failed:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isConnected) {
      tcw?.signOut?.();
      setTinyCloudWeb(null);
    }
    // eslint-disable-next-line
  }, [isConnected]);

  const tcwHandler = async () => {
    if (!isConnected || !walletClient) {
      // User wants to sign in, so first connect the wallet
      setOpen(true);
      return;
    }

    if (tcw) {
      // Already signed in
      return;
    }

    // Sign in with TinyCloud using connected wallet
    await signInWithWallet();
  };

  const tcwLogoutHandler = async () => {
    tcw?.signOut?.();
    setTinyCloudWeb(null);
    // Note: Wallet remains connected - user can disconnect via header button if desired
  };

  const displayAdvancedOptions = () => {
    return (
      <Accordion type="single" collapsible className="w-full mt-4">
        <AccordionItem value="advancedOptions">
          <AccordionTrigger>
            <div className="flex items-center gap-2">Advanced Options</div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4">
              {/* Host settings */}
              <div className="space-y-4 border-b border-border/20 pb-4">
                <h4 className="text-md font-heading text-text">
                  TinyCloud Host
                </h4>
                <Input
                  label="TinyCloud Host (Optional)"
                  value={tinyCloudHost}
                  onChange={setTinyCloudHost}
                  className="w-full"
                  placeholder="node.tinycloud.xyz"
                  helperText="The location where your TinyCloud data is hosted. You can host your own data by setting this to your own host."
                />
              </div>
              {/* Bucket/Prefix settings */}
              <div className="space-y-4 border-b border-border/20 pb-4">
                <h4 className="text-md font-heading text-text">
                  Prefix Configuration
                </h4>
                <p className="text-sm text-text/70">
                  Set the prefix that you want to access in your TinyCloud
                  storage.
                </p>
                <Input
                  label="Prefix"
                  value={prefix}
                  onChange={setPrefix}
                  className="w-full"
                  helperText="This will request access to the root directory if empty"
                  placeholder="/"
                />
              </div>
              {/* Storage Module toggle */}
              <div className="space-y-4 border-b border-border/20 pb-4">
                <h4 className="text-md font-heading text-text">
                  Storage Module
                </h4>
                <p className="text-sm text-text/70">
                  Control whether the TinyCloud storage module is enabled. This
                  allows you to store and retrieve data.
                </p>
                <RadioGroup
                  name="storageEnabled"
                  options={["On", "Off"]}
                  value={storageEnabled}
                  onChange={setStorageEnabled}
                  label="Enable storage module"
                />
              </div>

              {/* ENS Resolution toggle */}
              <div className="space-y-4 border-b border-border/20 pb-4">
                <h4 className="text-md font-heading text-text">Resolve ENS</h4>
                <p className="text-sm text-text/70">
                  When enabled, the TinyCloud Web SDK will resolve Ethereum Name
                  Service (ENS) records for your address. This includes avatars
                  and domain names.
                </p>
                <RadioGroup
                  name="resolveEns"
                  options={["On", "Off"]}
                  value={resolveEns}
                  onChange={setResolveEns}
                  label="Enable ENS resolution"
                />
              </div>

              {/* SIWE Configuration */}
              <div className="space-y-4">
                <h4 className="text-md font-heading text-text">
                  SIWE Configuration
                </h4>
                <p className="text-sm text-text/70">
                  Sign-In With Ethereum (SIWE) allows for secure authentication
                  using your Ethereum wallet. Advanced configuration options are
                  available here.
                </p>
                <RadioGroup
                  name="siweConfig"
                  options={["On", "Off"]}
                  value={siweConfig}
                  onChange={setSiweConfig}
                  label="Enable custom SIWE configuration"
                />

                {siweConfig === "On" && (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <Input
                      label="Address"
                      value={siweAddress}
                      onChange={setSiweAddress}
                      helperText="Wallet address to be confirmed in the message"
                    />
                    <Input
                      label="Chain ID"
                      value={chainId}
                      onChange={setChainId}
                      helperText="Chain ID to be confirmed in the message"
                    />
                    <Input
                      label="Domain"
                      value={domain}
                      onChange={setDomain}
                      helperText="The domain that is requesting the signing"
                    />
                    <Input
                      label="Nonce"
                      value={nonce}
                      onChange={setNonce}
                      helperText="Random string to prevent replay attacks"
                    />
                    <Input
                      label="Issued At"
                      value={issuedAt}
                      onChange={setIssuedAt}
                      helperText="ISO 8601 datetime string of when the message was created"
                    />
                    <Input
                      label="Expiration Time"
                      value={expirationTime}
                      onChange={setExpirationTime}
                      helperText="ISO 8601 datetime string of when the message expires"
                    />
                    <Input
                      label="Request ID"
                      value={requestId}
                      onChange={setRequestId}
                      helperText="Request identifier for the signing request"
                    />
                    <Input
                      label="Not Before"
                      value={notBefore}
                      onChange={setNotBefore}
                      helperText="ISO 8601 datetime string of when the message starts being valid"
                    />
                    <Input
                      className="md:col-span-2"
                      label="Resources"
                      value={resources}
                      onChange={setResources}
                      helperText="List of resources the user wishes to access (comma separated)"
                    />
                    <Input
                      className="md:col-span-2"
                      label="Statement"
                      value={statement}
                      onChange={setStatement}
                      helperText="Statement that the user is signing (e.g. 'I accept the Terms of Service')"
                    />
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  return (
    <>
      <Header />
      <div className="flex min-h-screen flex-col items-center bg-bg pt-20">
        <div className="w-full max-w-4xl px-4 mb-6">
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
                    SIGN-OUT FROM TINYCLOUD
                  </Button>
                  <AccountInfo
                    address={address || tcw?.address()}
                    session={tcw?.session()}
                    className="mt-6"
                  />
                </>
              ) : (
                <div className="space-y-4">
                  {!isConnected && (
                    <div className="text-sm text-text/70 text-center p-3 bg-bg rounded border">
                      <p>
                        Click the button below to connect your wallet and sign
                        into TinyCloud
                      </p>
                    </div>
                  )}

                  <Button
                    id="signInButton"
                    onClick={tcwHandler}
                    loading={loading}
                    variant="default"
                    className="w-full"
                  >
                    {isConnected
                      ? "SIGN-IN TO TINYCLOUD"
                      : "CONNECT WALLET & SIGN-IN"}
                  </Button>

                  {displayAdvancedOptions()}
                </div>
              )}

              {/* This section is removed as content is now in the Advanced Options accordion */}
            </div>
          </div>

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
    </>
  );
}

export default Home;
