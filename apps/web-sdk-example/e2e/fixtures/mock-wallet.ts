/**
 * Mock Ethereum wallet implementation that produces REAL cryptographic signatures.
 *
 * Uses ethers.js Wallet with Hardhat's first account private key.
 * This is critical because TinyCloud validates SIWE signatures server-side.
 */
import { Wallet } from 'ethers';

// Hardhat's first account private key (well-known test key)
// Address: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
export const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Create the test wallet
const testWallet = new Wallet(TEST_PRIVATE_KEY);

// Export the test address for use in tests
export const TEST_ADDRESS = testWallet.address; // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

/**
 * Creates a mock window.ethereum object that:
 * - Reports as MetaMask
 * - Returns the test address for account queries
 * - Produces REAL ECDSA signatures using ethers.js
 */
export function createMockEthereum() {
  return {
    isMetaMask: true,
    selectedAddress: TEST_ADDRESS,
    chainId: '0x1', // Mainnet
    networkVersion: '1',

    // Event listeners (no-op for testing)
    _events: {} as Record<string, Function[]>,

    on(event: string, callback: Function) {
      if (!this._events[event]) {
        this._events[event] = [];
      }
      this._events[event].push(callback);
      return this;
    },

    removeListener(event: string, callback: Function) {
      if (this._events[event]) {
        this._events[event] = this._events[event].filter(cb => cb !== callback);
      }
      return this;
    },

    removeAllListeners(event?: string) {
      if (event) {
        delete this._events[event];
      } else {
        this._events = {};
      }
      return this;
    },

    emit(event: string, ...args: any[]) {
      if (this._events[event]) {
        this._events[event].forEach(cb => cb(...args));
      }
      return true;
    },

    // Main request handler
    async request({ method, params }: { method: string; params?: any[] }): Promise<any> {
      console.log('[MockWallet] Request:', method, params);

      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [TEST_ADDRESS];

        case 'eth_chainId':
          return '0x1';

        case 'net_version':
          return '1';

        case 'personal_sign': {
          // personal_sign params: [message, address]
          const message = params?.[0];

          if (!message) {
            throw new Error('personal_sign: missing message parameter');
          }

          // Handle both hex-encoded and plain text messages
          let messageToSign: string | Uint8Array;
          if (typeof message === 'string' && message.startsWith('0x')) {
            // Hex-encoded message - convert to bytes
            messageToSign = Buffer.from(message.slice(2), 'hex');
          } else {
            messageToSign = message;
          }

          // Sign with ethers.js Wallet - produces REAL ECDSA signature
          const signature = await testWallet.signMessage(messageToSign);
          console.log('[MockWallet] Signed message, signature:', signature.slice(0, 20) + '...');
          return signature;
        }

        case 'eth_sign': {
          // eth_sign params: [address, message]
          const [, message] = params || [];

          if (!message) {
            throw new Error('eth_sign: missing message parameter');
          }

          // eth_sign expects hex-encoded message
          const messageBytes = Buffer.from(message.slice(2), 'hex');
          const signature = await testWallet.signMessage(messageBytes);
          console.log('[MockWallet] eth_sign signature:', signature.slice(0, 20) + '...');
          return signature;
        }

        case 'eth_signTypedData':
        case 'eth_signTypedData_v3':
        case 'eth_signTypedData_v4': {
          // For typed data signing (EIP-712)
          // params: [address, typedData]
          const typedData = params?.[1];

          if (!typedData) {
            throw new Error('eth_signTypedData: missing typedData parameter');
          }

          const data = typeof typedData === 'string' ? JSON.parse(typedData) : typedData;

          // Use ethers.js _signTypedData for EIP-712
          const signature = await testWallet._signTypedData(
            data.domain,
            data.types,
            data.message
          );
          console.log('[MockWallet] Typed data signature:', signature.slice(0, 20) + '...');
          return signature;
        }

        case 'wallet_switchEthereumChain':
          // Accept chain switch requests silently
          return null;

        case 'wallet_addEthereumChain':
          // Accept add chain requests silently
          return null;

        case 'eth_getBalance':
          // Return a reasonable test balance (100 ETH in wei, hex)
          return '0x56bc75e2d63100000';

        case 'eth_blockNumber':
          return '0x1';

        case 'eth_getCode':
          return '0x';

        case 'eth_call':
          return '0x';

        case 'eth_estimateGas':
          return '0x5208'; // 21000

        case 'wallet_getPermissions':
          return [{ parentCapability: 'eth_accounts' }];

        case 'wallet_requestPermissions':
          return [{ parentCapability: 'eth_accounts' }];

        default:
          console.log('[MockWallet] Unhandled method:', method);
          return null;
      }
    },

    // Legacy send method (some libraries use this)
    send(method: string, params?: any[]): Promise<any> {
      return this.request({ method, params });
    },

    // Legacy sendAsync method
    sendAsync(
      payload: { method: string; params?: any[] },
      callback: (error: Error | null, response?: any) => void
    ) {
      this.request(payload)
        .then(result => callback(null, { result }))
        .catch(error => callback(error));
    },

    // Check if connected
    isConnected() {
      return true;
    },
  };
}

/**
 * Serializes the mock wallet creation code for injection into browser context.
 * This is needed because Playwright's addInitScript runs in a separate context.
 */
export function getMockWalletScript(): string {
  return `
    (function() {
      // Hardhat's first account private key
      const TEST_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
      const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

      // Load ethers.js from CDN if not available
      let signingReady = false;
      let signMessageFn = null;
      let ethersLoadPromise = null;

      function loadEthersFromCDN() {
        if (ethersLoadPromise) return ethersLoadPromise;

        ethersLoadPromise = new Promise((resolve, reject) => {
          // Check if already loaded
          if (window.ethers && window.ethers.Wallet) {
            console.log('[MockWallet] ethers.js already available');
            resolve();
            return;
          }

          console.log('[MockWallet] Loading ethers.js from CDN...');
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/ethers/5.7.2/ethers.umd.min.js';
          script.onload = () => {
            console.log('[MockWallet] ethers.js loaded from CDN');
            resolve();
          };
          script.onerror = (e) => {
            console.error('[MockWallet] Failed to load ethers.js from CDN:', e);
            reject(e);
          };
          document.head.appendChild(script);
        });

        return ethersLoadPromise;
      }

      // Check if ethers is available
      function tryGetEthersSigner() {
        if (window.ethers && window.ethers.Wallet) {
          try {
            const wallet = new window.ethers.Wallet(TEST_PRIVATE_KEY);
            signMessageFn = (msg) => wallet.signMessage(msg);
            signingReady = true;
            console.log('[MockWallet] Signer ready with ethers.js');
            return true;
          } catch (e) {
            console.error('[MockWallet] Failed to create ethers wallet:', e);
          }
        }
        return false;
      }

      // Queue for pending sign requests while waiting for ethers
      const pendingSignRequests = [];

      window.ethereum = {
        isMetaMask: true,
        selectedAddress: TEST_ADDRESS,
        chainId: '0x1',
        networkVersion: '1',
        _events: {},

        on(event, callback) {
          if (!this._events[event]) this._events[event] = [];
          this._events[event].push(callback);
          return this;
        },

        removeListener(event, callback) {
          if (this._events[event]) {
            this._events[event] = this._events[event].filter(cb => cb !== callback);
          }
          return this;
        },

        removeAllListeners(event) {
          if (event) delete this._events[event];
          else this._events = {};
          return this;
        },

        emit(event, ...args) {
          if (this._events[event]) {
            this._events[event].forEach(cb => cb(...args));
          }
          return true;
        },

        async request({ method, params }) {
          console.log('[MockWallet] Request:', method, params);

          switch (method) {
            case 'eth_requestAccounts':
            case 'eth_accounts':
              return [TEST_ADDRESS];

            case 'eth_chainId':
              return '0x1';

            case 'net_version':
              return '1';

            case 'personal_sign': {
              const message = params?.[0];
              if (!message) throw new Error('personal_sign: missing message');

              // Ensure ethers.js is loaded
              if (!signingReady) {
                // First try to use app's ethers
                if (!tryGetEthersSigner()) {
                  // Load ethers from CDN
                  console.log('[MockWallet] Loading ethers from CDN for signing...');
                  await loadEthersFromCDN();
                  // Now try again
                  if (!tryGetEthersSigner()) {
                    throw new Error('Signing not ready - ethers.js failed to initialize');
                  }
                }
              }

              if (!signingReady || !signMessageFn) {
                throw new Error('Signing not ready - no sign function available');
              }

              // Handle hex-encoded messages
              let messageToSign;
              if (typeof message === 'string' && message.startsWith('0x')) {
                // Convert hex to bytes then to string
                const bytes = [];
                for (let i = 2; i < message.length; i += 2) {
                  bytes.push(parseInt(message.substr(i, 2), 16));
                }
                messageToSign = new Uint8Array(bytes);
              } else {
                messageToSign = message;
              }

              const signature = await signMessageFn(messageToSign);
              console.log('[MockWallet] Signed, signature:', signature.slice(0, 20) + '...');
              return signature;
            }

            case 'eth_sign': {
              const [, message] = params || [];
              if (!message) throw new Error('eth_sign: missing message');

              // Ensure ethers.js is loaded
              if (!signingReady) {
                if (!tryGetEthersSigner()) {
                  await loadEthersFromCDN();
                  tryGetEthersSigner();
                }
              }

              if (!signingReady || !signMessageFn) {
                throw new Error('Signing not ready - no sign function available');
              }

              const bytes = [];
              for (let i = 2; i < message.length; i += 2) {
                bytes.push(parseInt(message.substr(i, 2), 16));
              }
              const signature = await signMessageFn(new Uint8Array(bytes));
              return signature;
            }

            case 'wallet_switchEthereumChain':
            case 'wallet_addEthereumChain':
              return null;

            case 'eth_getBalance':
              return '0x56bc75e2d63100000';

            case 'eth_blockNumber':
              return '0x1';

            case 'eth_getCode':
              return '0x';

            case 'eth_call':
              return '0x';

            case 'eth_estimateGas':
              return '0x5208';

            case 'wallet_getPermissions':
            case 'wallet_requestPermissions':
              return [{ parentCapability: 'eth_accounts' }];

            default:
              console.log('[MockWallet] Unhandled:', method);
              return null;
          }
        },

        send(method, params) {
          return this.request({ method, params });
        },

        sendAsync(payload, callback) {
          this.request(payload)
            .then(result => callback(null, { result }))
            .catch(error => callback(error));
        },

        isConnected() { return true; }
      };

      // Also set on providers list
      window.ethereum.providers = [window.ethereum];

      console.log('[MockWallet] Injected mock ethereum provider');
    })();
  `;
}
