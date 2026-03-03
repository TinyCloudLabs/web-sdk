// @ts-nocheck
import React, { useState, lazy, Suspense } from 'react';
import { X } from 'lucide-react';
import { TinyCloudWeb } from '@tinycloud/web-sdk';
import { providers } from 'ethers';
import AccountInfo from '../AccountInfo';
import Input from '../Input';
import RadioGroup from '../RadioGroup';
import { cn } from '../../utils/utils';

const SpaceModule = lazy(() => import('../../pages/SpaceModule'));
const DelegationModule = lazy(() => import('../../pages/DelegationModule'));
const VaultModule = lazy(() => import('../../pages/VaultModule'));

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  address: string | null;
  session: Record<string, any> | undefined;
  tcw: TinyCloudWeb | null;
  web3Provider: providers.Web3Provider | null;
  openKeyHost: string;
  onOpenKeyHostChange: (v: string) => void;
  tinyCloudHost: string;
  onTinyCloudHostChange: (v: string) => void;
  prefix: string;
  onPrefixChange: (v: string) => void;
  storageEnabled: string;
  onStorageEnabledChange: (v: string) => void;
  spaceManagementEnabled: string;
  onSpaceManagementEnabledChange: (v: string) => void;
  delegationEnabled: string;
  onDelegationEnabledChange: (v: string) => void;
  vaultEnabled: string;
  onVaultEnabledChange: (v: string) => void;
  onSignOut: () => void;
}

type SettingsTab = 'configuration' | 'modules';

export function SettingsPanel({
  open,
  onClose,
  address,
  session,
  tcw,
  web3Provider,
  openKeyHost,
  onOpenKeyHostChange,
  tinyCloudHost,
  onTinyCloudHostChange,
  prefix,
  onPrefixChange,
  storageEnabled,
  onStorageEnabledChange,
  spaceManagementEnabled,
  onSpaceManagementEnabledChange,
  delegationEnabled,
  onDelegationEnabledChange,
  vaultEnabled,
  onVaultEnabledChange,
  onSignOut,
}: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('configuration');

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 z-50 h-full w-96 max-w-full bg-bw border-l border-border shadow-elevated overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-bw z-10 border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-lg font-heading text-text">Settings</h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-text/50 hover:text-text hover:bg-bg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex px-4 gap-1">
            <button
              onClick={() => setActiveTab('configuration')}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-t transition-colors',
                activeTab === 'configuration'
                  ? 'text-main border-b-2 border-main'
                  : 'text-text/50 hover:text-text'
              )}
            >
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('modules')}
              className={cn(
                'px-3 py-2 text-sm font-medium rounded-t transition-colors',
                activeTab === 'modules'
                  ? 'text-main border-b-2 border-main'
                  : 'text-text/50 hover:text-text'
              )}
            >
              Modules
            </button>
          </div>
        </div>

        <div className="p-4 space-y-6">
          {/* Account (always visible) */}
          {address && (
            <AccountInfo
              address={address}
              session={session}
              compact
            />
          )}

          {activeTab === 'configuration' && (
            <>
              {/* Hosts & Prefix */}
              <div className="space-y-4">
                <h3 className="text-sm font-heading text-text/70 uppercase tracking-wider">Hosts</h3>

                <Input
                  label="OpenKey Host"
                  value={openKeyHost}
                  onChange={onOpenKeyHostChange}
                  className="w-full"
                  placeholder="https://openkey.so"
                />

                <Input
                  label="TinyCloud Host"
                  value={tinyCloudHost}
                  onChange={onTinyCloudHostChange}
                  className="w-full"
                  placeholder="node.tinycloud.xyz"
                />

                <Input
                  label="Storage Prefix"
                  value={prefix}
                  onChange={onPrefixChange}
                  className="w-full"
                  placeholder="/"
                />
              </div>

              {/* Module Toggles */}
              <div className="space-y-4">
                <h3 className="text-sm font-heading text-text/70 uppercase tracking-wider">Module Toggles</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">Storage</span>
                    <RadioGroup
                      name="storageEnabled"
                      options={["On", "Off"]}
                      value={storageEnabled}
                      onChange={onStorageEnabledChange}
                      label=""
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">Space Management</span>
                    <RadioGroup
                      name="spaceManagement"
                      options={["On", "Off"]}
                      value={spaceManagementEnabled}
                      onChange={onSpaceManagementEnabledChange}
                      label=""
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">Delegation</span>
                    <RadioGroup
                      name="delegation"
                      options={["On", "Off"]}
                      value={delegationEnabled}
                      onChange={onDelegationEnabledChange}
                      label=""
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text">Data Vault</span>
                    <RadioGroup
                      name="vault"
                      options={["On", "Off"]}
                      value={vaultEnabled}
                      onChange={onVaultEnabledChange}
                      label=""
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'modules' && tcw && tcw.session() && (
            <div className="space-y-6">
              {spaceManagementEnabled === "On" && (
                <div className="space-y-2">
                  <h3 className="text-sm font-heading text-text/70 uppercase tracking-wider">Space Management</h3>
                  <div className="rounded-base border border-border p-3">
                    <Suspense fallback={<div className="p-2 text-sm text-text/50">Loading...</div>}>
                      <SpaceModule tcw={tcw} />
                    </Suspense>
                  </div>
                </div>
              )}
              {delegationEnabled === "On" && (
                <div className="space-y-2">
                  <h3 className="text-sm font-heading text-text/70 uppercase tracking-wider">Delegation Management</h3>
                  <div className="rounded-base border border-border p-3">
                    <Suspense fallback={<div className="p-2 text-sm text-text/50">Loading...</div>}>
                      <DelegationModule tcw={tcw} />
                    </Suspense>
                  </div>
                </div>
              )}
              {vaultEnabled === "On" && web3Provider && (
                <div className="space-y-2">
                  <h3 className="text-sm font-heading text-text/70 uppercase tracking-wider">Data Vault</h3>
                  <div className="rounded-base border border-border p-3">
                    <Suspense fallback={<div className="p-2 text-sm text-text/50">Loading...</div>}>
                      <VaultModule tcw={tcw} web3Provider={web3Provider} />
                    </Suspense>
                  </div>
                </div>
              )}
              {spaceManagementEnabled !== "On" && delegationEnabled !== "On" && !(vaultEnabled === "On" && web3Provider) && (
                <div className="text-center py-8 text-sm text-text/40">
                  Enable modules in the Configuration tab to see them here.
                </div>
              )}
            </div>
          )}

          {activeTab === 'modules' && (!tcw || !tcw.session()) && (
            <div className="text-center py-8 text-sm text-text/40">
              Sign in to access module features.
            </div>
          )}

          {/* Sign Out - only show when logged in */}
          {address && (
            <div className="pt-4 border-t border-border">
              <button
                onClick={onSignOut}
                className="w-full h-10 rounded-base bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
