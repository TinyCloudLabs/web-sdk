import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, sepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet, safe } from 'wagmi/connectors'
import { getDefaultConfig } from 'connectkit'

// 1. Get projectId from WalletConnect
export const projectId = process.env.REACT_APP_PROJECT_ID || '';

// 2. Create wagmi config
export const config = createConfig(
  getDefaultConfig({
    chains: [mainnet, sepolia],
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
    },
    walletConnectProjectId: projectId,
    appName: "TinyCloud Web SDK Example",
    appDescription: "Example app demonstrating TinyCloud Web SDK with ConnectKit",
    appUrl: "https://tinycloud.xyz",
    appIcon: "https://tinycloud.xyz/logo.png",
  })
)

// 3. Export chains and connectors for backward compatibility
export const chains = [mainnet, arbitrum]
export const connectors = [
  injected(),
  walletConnect({ projectId }),
  coinbaseWallet({ appName: 'TinyCloud Web SDK Example' }),
  safe(),
]
