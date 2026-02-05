import {
  isAlchemyProvider,
  isAnkrProvider,
  isCloudflareProvider,
  isCustomProvider,
  isEtherscanProvider,
  isInfuraProvider,
  isPocketProvider,
  AlchemyProviderNetworks,
  AnkrProviderNetworks,
  EnsData,
  EtherscanProviderNetworks,
  InfuraProviderNetworks,
  PocketProviderNetworks,
  RPCProvider,
} from '../types';
import { ethers, getDefaultProvider } from 'ethers';

/**
 * @param rpc - RPCProvider
 * @returns an ethers provider based on the RPC configuration.
 */
export const getProvider = (
  rpc?: RPCProvider
): ethers.providers.BaseProvider => {
  if (!rpc) {
    return getDefaultProvider();
  }
  if (isEtherscanProvider(rpc)) {
    return new ethers.providers.EtherscanProvider(
      rpc.network ?? EtherscanProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isInfuraProvider(rpc)) {
    return new ethers.providers.InfuraProvider(
      rpc.network ?? InfuraProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isAlchemyProvider(rpc)) {
    return new ethers.providers.AlchemyProvider(
      rpc.network ?? AlchemyProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isCloudflareProvider(rpc)) {
    return new ethers.providers.CloudflareProvider();
  }
  if (isPocketProvider(rpc)) {
    return new ethers.providers.PocketProvider(
      rpc.network ?? PocketProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isAnkrProvider(rpc)) {
    return new ethers.providers.AnkrProvider(
      rpc.network ?? AnkrProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isCustomProvider(rpc)) {
    return new ethers.providers.JsonRpcProvider(rpc.url, rpc.network);
  }
  return getDefaultProvider();
};

/**
 * Resolves ENS data supported by TCW.
 * @param provider - Ethers provider.
 * @param address - User address.
 * @returns Object containing ENS data.
 */
export const resolveEns = async (
  provider: ethers.providers.BaseProvider,
  /* User Address */
  address: string
): Promise<EnsData> => {
  if (!address) {
    throw new Error('Missing address.');
  }
  const ens: EnsData = {};
  const promises: Array<Promise<any>> = [];
  promises.push(provider.lookupAddress(address));
  promises.push(provider.getAvatar(address));

  await Promise.all(promises)
    .then(([domain, avatarUrl]) => {
      if (domain) {
        ens['domain'] = domain;
      }
      if (avatarUrl) {
        ens['avatarUrl'] = avatarUrl;
      }
    })
    .catch(console.error);

  return ens;
};
