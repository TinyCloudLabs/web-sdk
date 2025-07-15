import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ConnectKitProvider } from 'connectkit'
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { config } from './wagmi'

// Add dark mode script detection
const setInitialTheme = `
  function getUserPreference() {
    if(window.localStorage.getItem('theme')) {
      return window.localStorage.getItem('theme')
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches 
      ? 'dark' 
      : 'light'
  }
  document.documentElement.classList.toggle('dark', getUserPreference() === 'dark');
`;

// Insert theme detection script
const script = document.createElement('script');
script.innerHTML = setInitialTheme;
document.head.appendChild(script);

// 0. Setup queryClient
const queryClient = new QueryClient()

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <React.StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider>
          <App />
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
