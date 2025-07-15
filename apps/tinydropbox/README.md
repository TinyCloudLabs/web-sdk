# TinyDropBox

TinyDropBox is a decentralized cloud storage application that provides a Dropbox-like experience using TinyCloud's web SDK. It allows users to store, organize, and manage their files in a decentralized manner using blockchain technology.

## Features

- **Decentralized Storage**: Files are stored using TinyCloud's decentralized network
- **Wallet Authentication**: Secure authentication using Web3 wallets
- **Folder Management**: Create, navigate, and manage folders
- **File Upload**: Drag-and-drop file uploads with support for multiple files
- **File Download**: Download files directly from the decentralized storage
- **File Management**: Delete files and folders
- **Dark/Light Theme**: Toggle between dark and light modes
- **Responsive Design**: Works on desktop and mobile devices

## Technologies Used

- **React**: Frontend framework
- **TinyCloud Web SDK**: Decentralized storage backend
- **Wagmi**: Ethereum wallet integration
- **ConnectKit**: Wallet connection UI
- **Tailwind CSS**: Styling framework
- **Lucide React**: Icon library

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- A Web3 wallet (MetaMask, WalletConnect, etc.)

### Installation

1. Navigate to the TinyDropBox directory:
   ```bash
   cd apps/tinydropbox
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory and add your WalletConnect project ID:
   ```
   REACT_APP_PROJECT_ID=your_walletconnect_project_id
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Usage

1. **Connect Wallet**: Click "Connect Wallet & Sign In" to connect your Web3 wallet
2. **Sign In**: Sign the authentication message to access your storage
3. **Upload Files**: Drag and drop files or click "Upload Files" to add content
4. **Create Folders**: Click "New Folder" to create a new folder
5. **Navigate**: Click on folders to navigate through your storage
6. **Download Files**: Click the download button on any file to download it
7. **Delete Items**: Click the trash button to delete files or folders
8. **Toggle Theme**: Use the sun/moon button to switch between light and dark modes

## Storage Structure

TinyDropBox uses a prefix-based storage system where:
- Files are stored with keys like `dropbox/filename.ext`
- Folders are represented by creating placeholder files like `dropbox/foldername/.placeholder`
- Navigation is handled by parsing the key structure

## Security

- Authentication is handled through Web3 wallet signatures
- Files are stored in a decentralized manner using TinyCloud's network
- No personal data is stored on centralized servers

## Bundle Size Optimization

The following optimizations have been applied to reduce the bundle size:

### Implemented Optimizations

1. **Code Splitting**
   - Added React.lazy and Suspense for route components
   - Implemented webpack splitChunks configuration for vendor modules

2. **Removed Unnecessary Polyfills**
   - Reduced Node.js polyfills to only essential ones (buffer)

3. **Build Optimizations**
   - Disabled source maps in production build
   - Added bundle analyzer for dependency size inspection

4. **Component Lazy Loading**
   - Lazy loaded heavy components

### Additional Recommendations

1. **Analyze Bundle**
   - Run `npm run build:analyze` to see which dependencies are taking up the most space

2. **Web3 Dependency Management**
   - Consider loading ethereum-related libraries dynamically only when needed
   - Explore using smaller alternatives to ethers.js (such as viem)
   - Only import specific components from web3modal

## Running the App

```bash
npm install
npm start
```

## Building for Production

```bash
npm run build
```

## Analyzing Bundle Size

```bash
npm run build:analyze
```

## Contributing

To contribute to TinyDropBox:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the same terms as the parent TinyCloud SDK project.