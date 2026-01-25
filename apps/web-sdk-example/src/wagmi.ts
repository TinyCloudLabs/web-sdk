import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum, sepolia } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet, safe } from 'wagmi/connectors'
import { getDefaultConfig } from 'connectkit'

// 1. Get projectId from WalletConnect
export const projectId = process.env.REACT_APP_PROJECT_ID || '';

// 2. Create wagmi config
export const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [mainnet, sepolia],
    transports: {
      // Use default public RPC URLs for now
      [mainnet.id]: http(),
      [sepolia.id]: http(),
    },

    // Required API Keys
    walletConnectProjectId: projectId,

    // Required App Info
    appName: "TinyCloud Web SDK Example",

    // Optional App Info
    appDescription: "Example app demonstrating TinyCloud Web SDK with ConnectKit",
    appUrl: "https://tinycloud.xyz", // your app's url
    appIcon: "https://tinycloud.xyz/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
)

// 3. Export chains and connectors for backward compatibility
export const chains = [mainnet, arbitrum]
export const connectors = [
  injected(),
  walletConnect({ projectId }),
  coinbaseWallet({ appName: 'TinyCloud Web SDK Example' }),
  safe(),
]
