// Browser-compatible replacement for @noble/hashes/crypto
// This provides the crypto functionality that @noble/hashes needs in a browser environment

// Use the browser's built-in crypto if available, otherwise provide a fallback
const getWebCrypto = () => {
  if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    return globalThis.crypto;
  }
  if (typeof window !== 'undefined' && window.crypto) {
    return window.crypto;
  }
  if (typeof self !== 'undefined' && self.crypto) {
    return self.crypto;
  }
  return undefined;
};

// Create a crypto object that matches what @noble/hashes expects
export const crypto = {
  web: getWebCrypto(),
  node: undefined, // Disable node crypto in browser
  
  // Provide the methods that @noble/hashes might need
  getRandomValues: function(array) {
    const webCrypto = getWebCrypto();
    if (webCrypto && webCrypto.getRandomValues) {
      return webCrypto.getRandomValues(array);
    }
    // Fallback to a simple random implementation (not cryptographically secure)
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }
};
