import React from 'react';
import ReactDOM from 'react-dom/client';
import { createAppKit } from '@reown/appkit/react'
import { WagmiProvider } from 'wagmi'
import { AppKitNetwork, arbitrum, mainnet } from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { wagmiAdapter, networks } from './wagmi'

// 0. Setup queryClient
const queryClient = new QueryClient()

// 1. Get projectId from https://cloud.reown.com
const projectId = process.env.REACT_APP_PROJECT_ID || '';

// 2. Create a metadata object - optional
const metadata = {
  name: 'TinyCloud Example App',
  description: 'AppKit Example',
  url: 'https://reown.com/appkit', // origin must match your domain & subdomain
  icons: ['https://assets.reown.com/reown-profile-pic.png']
}

// Create modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: networks as any,
  projectId,
  metadata,
  features: {
    analytics: true // Optional - defaults to your Cloud configuration
  }
})

    

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </WagmiProvider>
    {/* <Web3ModalV2
      projectId={projectId}
      ethereumClient={ethereumClient}
    /> */}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
