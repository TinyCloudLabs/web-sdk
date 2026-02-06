# TinyCloud + OpenKey Example App

This example demonstrates using [TinyCloud](https://tinycloud.xyz) with [OpenKey](https://openkey.so) as the signing backend instead of browser wallets (MetaMask, WalletConnect, etc.).

## Architecture

The app uses an EIP-1193 compatible provider that wraps the OpenKey SDK:

```
User clicks "Connect with OpenKey"
  -> OpenKey popup opens (passkey auth, key selection)
  -> Returns { address, keyId }
  -> OpenKeyEIP1193Provider created
  -> Wrapped in ethers Web3Provider
  -> Passed to TinyCloudWeb
  -> signIn() triggers SIWE signing via OpenKey popup
  -> TinyCloud operations work as normal
```

## Prerequisites

You need three services running:

1. **OpenKey** - Authentication and signing service
2. **TinyCloud Node** - Storage backend
3. **This Demo App** - The frontend

## Setup

### 1. Start OpenKey (localhost:5173)

```bash
cd /path/to/openkey

# Start the API (Docker)
docker compose up -d

# Start the web app
bun dev:web
```

OpenKey will be available at:
- Web: http://localhost:5173
- API: http://localhost:3001

### 2. Start TinyCloud Node (localhost:8000)

```bash
cd /path/to/tinycloud-node
cargo run
```

### 3. Start this Demo App (localhost:3002)

```bash
# From the web-sdk root
cd apps/openkey-example

# Install dependencies
bun install

# Start on port 3002 (to avoid conflict with OpenKey API on 3000)
PORT=3002 bun run start
```

## Usage

1. Open http://localhost:3002
2. Click **"Connect with OpenKey"**
3. In the OpenKey popup:
   - Sign in with passkey or email OTP
   - Select or generate a key
4. Back in the demo, approve the SIWE message in the OpenKey popup
5. You're now signed in to TinyCloud via OpenKey!

### Dev Mode

For local development, enable dev mode to use localhost endpoints:

1. Open browser console
2. Run `enableDev()` or set `localStorage.setItem('__DEV_MODE__', 'true')`
3. Reload the page

This sets:
- OpenKey Host: `http://localhost:5173`
- TinyCloud Host: `http://localhost:8000`

## Testing with agent-browser

For automated end-to-end testing, we recommend using [agent-browser](https://github.com/vercel-labs/agent-browser) CLI:

```bash
# Install agent-browser
npm install -g agent-browser
```

### Example Test Flow

```bash
# 1. Open the demo app
agent-browser open http://localhost:3002

# 2. Enable dev mode and reload
agent-browser eval "localStorage.setItem('__DEV_MODE__', 'true'); location.reload()"
agent-browser wait 2000

# 3. Click Connect with OpenKey
agent-browser snapshot -i
agent-browser click @e5  # The "CONNECT WITH OPENKEY" button

# 4. In the OpenKey popup, select a key
agent-browser wait 3000
agent-browser tab 1  # Switch to popup
agent-browser snapshot -i
agent-browser click @e4  # Select key

# 5. Approve SIWE signing in sign popup
agent-browser wait 3000
agent-browser tab 1  # Switch to sign popup
agent-browser snapshot -i
agent-browser click @e5  # Click "Sign Message"

# 6. Verify signed in
agent-browser tab 0
agent-browser snapshot -i
# Should show "SIGN-OUT FROM TINYCLOUD" button
```

### Headless Testing

```bash
# Run in headed mode to see what's happening
agent-browser --headed open http://localhost:3002

# Take screenshots for debugging
agent-browser screenshot ./debug.png
```

## Project Structure

```
src/
├── components/          # UI components (Button, Input, etc.)
├── pages/
│   ├── Home.tsx         # Main page with OpenKey auth flow
│   ├── StorageModule.tsx    # KV storage demo
│   ├── SpaceModule.tsx      # Space-scoped KV demo
│   └── DelegationModule.tsx # Delegation management demo
└── utils/
    └── openkey-provider.ts  # EIP-1193 provider wrapping OpenKey SDK
```

## Key Files

### `src/utils/openkey-provider.ts`

The EIP-1193 compatible provider that routes signing requests to OpenKey:

```typescript
export class OpenKeyEIP1193Provider {
  async request({ method, params }) {
    switch (method) {
      case 'eth_accounts':
      case 'eth_requestAccounts':
        return [this.address];
      case 'personal_sign':
        // Route to OpenKey popup for signing
        const result = await this.openkey.signMessage({ message, keyId });
        return result.signature;
      // ...
    }
  }
}
```

### `src/pages/Home.tsx`

The main authentication flow:

```typescript
const connectAndSignIn = async () => {
  // 1. Connect to OpenKey
  const openkey = new OpenKey({ host: openKeyHost });
  const { address, keyId } = await openkey.connect();

  // 2. Create EIP-1193 provider
  const eip1193Provider = new OpenKeyEIP1193Provider(openkey, address, keyId);

  // 3. Wrap in ethers Web3Provider
  const web3Provider = new providers.Web3Provider(eip1193Provider);

  // 4. Create TinyCloudWeb with the provider
  const tcw = new TinyCloudWeb({
    providers: { web3: { driver: web3Provider } },
    // ...
  });

  // 5. Sign in (SIWE signing routed through OpenKey)
  await tcw.signIn();
};
```

## Building for Production

```bash
bun run build
```

## Deployment

Deploy to Cloudflare Pages or any static hosting:

```bash
# Build
bun run build

# The build output is in the `build/` directory
```

For Cloudflare Pages:
- Build command: `bun run build`
- Build output directory: `build`
- Environment variables:
  - `REACT_APP_DEVELOPMENT`: Set to `false` for production
