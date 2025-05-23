import {
  isTCWAlchemyProvider,
  isTCWAnkrProvider,
  isTCWCloudflareProvider,
  isTCWCustomProvider,
  isTCWEtherscanProvider,
  isTCWInfuraProvider,
  isTCWPocketProvider,
  TCWAlchemyProviderNetworks,
  TCWAnkrProviderNetworks,
  TCWEnsData,
  TCWEtherscanProviderNetworks,
  TCWInfuraProviderNetworks,
  TCWPocketProviderNetworks,
  TCWRPCProvider,
} from '../types';
import { ethers, getDefaultProvider } from 'ethers';

/**
 * @param rpc - TCWRPCProvider
 * @returns an ethers provider based on the RPC configuration.
 */
export const getProvider = (
  rpc?: TCWRPCProvider
): ethers.providers.BaseProvider => {
  if (!rpc) {
    return getDefaultProvider();
  }
  if (isTCWEtherscanProvider(rpc)) {
    return new ethers.providers.EtherscanProvider(
      rpc.network ?? TCWEtherscanProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isTCWInfuraProvider(rpc)) {
    return new ethers.providers.InfuraProvider(
      rpc.network ?? TCWInfuraProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isTCWAlchemyProvider(rpc)) {
    return new ethers.providers.AlchemyProvider(
      rpc.network ?? TCWAlchemyProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isTCWCloudflareProvider(rpc)) {
    return new ethers.providers.CloudflareProvider();
  }
  if (isTCWPocketProvider(rpc)) {
    return new ethers.providers.PocketProvider(
      rpc.network ?? TCWPocketProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isTCWAnkrProvider(rpc)) {
    return new ethers.providers.AnkrProvider(
      rpc.network ?? TCWAnkrProviderNetworks.MAINNET,
      rpc.apiKey
    );
  }
  if (isTCWCustomProvider(rpc)) {
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
export const tcwResolveEns = async (
  provider: ethers.providers.BaseProvider,
  /* User Address */
  address: string
): Promise<TCWEnsData> => {
  if (!address) {
    throw new Error('Missing address.');
  }
  const ens: TCWEnsData = {};
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
