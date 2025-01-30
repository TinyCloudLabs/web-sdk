import { type WalletClient } from '@wagmi/core';
import { providers } from 'ethers';

// 3. Configure modal ethereum client
export function walletClientToEthers5Signer(walletClient: WalletClient) {
  const { account, chain, transport  } = walletClient
  const network = {
    chainId: chain.id,
    name: chain.name,
    ensAddress: chain.contracts?.ensRegistry?.address,
  }
  const provider = new providers.Web3Provider(transport, network)
  const signer = provider.getSigner(account.address)
  return signer
}