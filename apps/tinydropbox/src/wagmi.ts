import { http, createConfig } from 'wagmi'
import { mainnet, arbitrum } from 'wagmi/chains'
import { injected, walletConnect, coinbaseWallet, safe } from 'wagmi/connectors'
import { getDefaultConfig } from 'connectkit'

// 1. Get projectId from WalletConnect
export const projectId = process.env.REACT_APP_PROJECT_ID || '';

// 2. Create wagmi config
export const config = createConfig(
  getDefaultConfig({
    // Your dApps chains
    chains: [mainnet, arbitrum],
    transports: {
      // Use default public RPC URLs for now
      [mainnet.id]: http(),
      [arbitrum.id]: http(),
    },

    // Required API Keys
    walletConnectProjectId: projectId,

    // Required App Info
    appName: "TinyDropBox",

    // Optional App Info
    appDescription: "Decentralized cloud storage powered by TinyCloud",
    appUrl: "https://tinycloud.xyz", // your app's url
    appIcon: "https://tinycloud.xyz/logo.png", // your app's icon, no bigger than 1024x1024px (max. 1MB)
  }),
)

// 3. Export chains and connectors for backward compatibility
export const chains = [mainnet, arbitrum]
export const connectors = [
  injected(),
  walletConnect({ projectId }),
  coinbaseWallet({ appName: 'TinyDropBox' }),
  safe(),
]
