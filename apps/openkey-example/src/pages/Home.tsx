import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { TinyCloudWeb } from "@tinycloud/web-sdk";
import { OpenKey, OpenKeyEIP1193Provider } from "@openkey/sdk";
import { providers } from "ethers";
import Title from "../components/Title";
import RadioGroup from "../components/RadioGroup";
import Input from "../components/Input";
import Button from "../components/Button";
import AccountInfo from "../components/AccountInfo";
import { lazy } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../components/ui/accordian";
import Footer from "../components/Footer";
import Header from "../components/Header";

const StorageModule = lazy(() => import("../pages/StorageModule"));
const SpaceModule = lazy(() => import("../pages/SpaceModule"));
const DelegationModule = lazy(() => import("../pages/DelegationModule"));

declare global {
  interface Window {
    tcw: TinyCloudWeb;
  }
}

function Home() {
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [tcw, setTinyCloudWeb] = useState<TinyCloudWeb | null>(null);
  const [openKeyAddress, setOpenKeyAddress] = useState<string | null>(null);

  // Configuration
  const [storageEnabled, setStorageEnabled] = useState<string>("On");
  const [spaceManagementEnabled, setSpaceManagementEnabled] = useState<string>("Off");
  const [delegationEnabled, setDelegationEnabled] = useState<string>("Off");
  const [prefix, setPrefix] = useState<string>("demo-app");
  const [tinyCloudHost, setTinyCloudHost] = useState<string>(
    window.__DEV_MODE__ ? "http://localhost:8000" : ""
  );
  const [openKeyHost, setOpenKeyHost] = useState<string>(
    window.__DEV_MODE__ ? "http://localhost:5173" : "https://openkey.so"
  );

  // Parse URL parameters on component mount
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const urlPrefix = queryParams.get("prefix");
    if (urlPrefix) {
      setPrefix(urlPrefix);
    }
  }, [location.search]);

  const getTinyCloudWebConfig = (tcwConfig: Record<string, any> = {}) => {
    const modules: Record<string, any> = {};

    if (storageEnabled === "Off") {
      modules.storage = false;
    } else {
      const storageConfig: Record<string, any> = {
        prefix: prefix.trim(),
      };
      if (tinyCloudHost.trim()) {
        storageConfig.hosts = [tinyCloudHost.trim()];
      }
      modules.storage = storageConfig;
    }

    tcwConfig = {
      ...tcwConfig,
      modules,
    };

    if (tinyCloudHost.trim()) {
      tcwConfig.tinycloudHosts = [tinyCloudHost.trim()];
    }

    tcwConfig.kvPrefix = prefix.trim();

    return tcwConfig;
  };

  const connectAndSignIn = async () => {
    if (tcw) return;
    setLoading(true);

    try {
      // 1. Connect to OpenKey - opens popup for auth + key selection
      const openkey = new OpenKey({ host: openKeyHost });
      const authResult = await openkey.connect();
      setOpenKeyAddress(authResult.address);

      // 2. Create EIP-1193 provider that routes signing to OpenKey (or wallet for external keys)
      const eip1193Provider = new OpenKeyEIP1193Provider(openkey, authResult);

      // 3. Wrap in ethers Web3Provider for TinyCloudWeb compatibility
      const web3Provider = new providers.Web3Provider(eip1193Provider as any);

      // 4. Configure and create TinyCloudWeb
      const tcwConfig = getTinyCloudWebConfig({
        providers: {
          web3: {
            driver: web3Provider,
          },
        },
        // WebUserAuthorization handles space creation modal
      });

      const tcwProvider = new TinyCloudWeb(tcwConfig);

      // 5. Sign in - SIWE signing routed through OpenKey popup
      await tcwProvider.signIn();
      setTinyCloudWeb(tcwProvider);
    } catch (err) {
      console.error("Sign-in failed:", err);
    }
    setLoading(false);
  };

  const signOut = async () => {
    tcw?.signOut?.();
    setTinyCloudWeb(null);
    setOpenKeyAddress(null);
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
              {/* OpenKey Host */}
              <div className="space-y-4 border-b border-border/20 pb-4">
                <h4 className="text-md font-heading text-text">
                  OpenKey Host
                </h4>
                <Input
                  label="OpenKey Host"
                  value={openKeyHost}
                  onChange={setOpenKeyHost}
                  className="w-full"
                  placeholder="https://openkey.so"
                  helperText="The OpenKey instance to use for signing. Use http://localhost:5173 for local development."
                />
              </div>

              {/* TinyCloud Host */}
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
                  helperText="The location where your TinyCloud data is hosted."
                />
              </div>

              {/* Prefix */}
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
                  Control whether the TinyCloud storage module is enabled.
                </p>
                <RadioGroup
                  name="storageEnabled"
                  options={["On", "Off"]}
                  value={storageEnabled}
                  onChange={setStorageEnabled}
                  label="Enable storage module"
                />
              </div>

              {/* Space Management toggle */}
              <div className="space-y-4 border-b border-border/20 pb-4">
                <h4 className="text-md font-heading text-text">
                  Space Management
                </h4>
                <p className="text-sm text-text/70">
                  Enable space-scoped KV operations.
                </p>
                <RadioGroup
                  name="spaceManagementEnabled"
                  options={["On", "Off"]}
                  value={spaceManagementEnabled}
                  onChange={setSpaceManagementEnabled}
                  label="Enable space management"
                />
              </div>

              {/* Delegation Management toggle */}
              <div className="space-y-4">
                <h4 className="text-md font-heading text-text">
                  Delegation Management
                </h4>
                <p className="text-sm text-text/70">
                  Enable delegation management to create, list, and revoke
                  delegations.
                </p>
                <RadioGroup
                  name="delegationEnabled"
                  options={["On", "Off"]}
                  value={delegationEnabled}
                  onChange={setDelegationEnabled}
                  label="Enable delegation management"
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  return (
    <>
      <Header address={openKeyAddress || undefined} />
      <div className="flex min-h-screen flex-col items-center bg-bg pt-20">
        <div className="w-full max-w-4xl px-4 mb-6">
          <Title />

          <div className="mx-auto max-w-2xl rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
            <div className="space-y-6">
              {tcw ? (
                <>
                  <Button
                    id="signOutButton"
                    onClick={signOut}
                    loading={loading}
                    variant="default"
                    className="w-full"
                  >
                    SIGN-OUT FROM TINYCLOUD
                  </Button>

                  <div className="p-4 bg-main/10 rounded-base border border-main/30">
                    <h4 className="text-sm font-heading text-text mb-2">
                      Connected via OpenKey
                    </h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-text/70">Address:</span>
                        <span className="font-mono truncate max-w-[200px]" title={openKeyAddress || ""}>
                          {openKeyAddress}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text/70">OpenKey Host:</span>
                        <span className="font-mono truncate max-w-[200px]">
                          {openKeyHost}
                        </span>
                      </div>
                    </div>
                  </div>

                  <AccountInfo
                    address={openKeyAddress || tcw?.address()}
                    session={tcw?.session()}
                    className="mt-6"
                  />
                </>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-text/70 text-center p-3 bg-bg rounded border">
                    <p>
                      Click the button below to connect with OpenKey and sign
                      into TinyCloud. Signing requests will be routed through
                      OpenKey popups.
                    </p>
                  </div>

                  <Button
                    id="signInButton"
                    onClick={connectAndSignIn}
                    loading={loading}
                    variant="default"
                    className="w-full"
                  >
                    CONNECT WITH OPENKEY
                  </Button>

                  {displayAdvancedOptions()}
                </div>
              )}
            </div>
          </div>

          {/* Storage module */}
          {storageEnabled === "On" && tcw && tcw.session() && (
            <div className="mt-8 rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
              <StorageModule tcw={tcw} />
            </div>
          )}

          {/* Space Management module */}
          {spaceManagementEnabled === "On" && tcw && tcw.session() && (
            <div className="mt-8 rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
              <SpaceModule tcw={tcw} />
            </div>
          )}

          {/* Delegation Management module */}
          {delegationEnabled === "On" && tcw && tcw.session() && (
            <div className="mt-8 rounded-base border-2 border-border bg-bw p-6 shadow-shadow">
              <DelegationModule tcw={tcw} />
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
