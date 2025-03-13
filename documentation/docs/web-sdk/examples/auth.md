---
sidebar_position: 3
title: "Authentication Examples"
---

# Authentication Examples

Examples showing how to handle user authentication and wallet connections

## Web3modal V2Settings

### Example 1: Code Snippet

```typescript
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
```

## Home

### Example 1: Code Snippet

```typescript
import { walletClientToEthers5Signer } from '../utils/web3modalV2Settings';
import { getWalletClient } from '@wagmi/core'
```

### Example 2: Complete Function

```typescript
function Home() {

  const { open: openWeb3Modal } = useWeb3Modal();
  const { data: walletClient } = useWalletClient()
```

### Example 3: Code Snippet

```typescript
  const signInUsingWeb3Modal = async (walletClient: any) => {
    const chainId = await walletClient.getChainId();
    const newWalletClient = await getWalletClient({ chainId });
    const signer = walletClientToEthers5Signer(newWalletClient as any);
```

### Example 4: Code Snippet

```typescript
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
```

### Example 5: Code Snippet

```typescript
                <p className="text-sm text-text/70">Sign-In With Ethereum (SIWE) allows for secure authentication using your Ethereum wallet. Advanced configuration options are available here.</p>
```

