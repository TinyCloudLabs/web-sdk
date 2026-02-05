import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-bg-alt py-6 border-t border-border">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="mb-4 md:mb-0">
            <p className="text-sm text-text-muted">&copy; {new Date().getFullYear()} TinyCloud. All rights reserved.</p>
          </div>
          <div className="flex space-x-6">
            <a 
              href="https://www.npmjs.com/package/@tinycloud/web-sdk" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm text-text-muted hover:text-primary-600 transition-colors"
            >
              NPM
            </a>
            <a 
              href="https://github.com/tinycloudlabs/web-sdk" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm text-text-muted hover:text-primary-600 transition-colors"
            >
              GitHub
            </a>
            <a 
              href="https://docs.tinycloud.xyz" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm text-text-muted hover:text-primary-600 transition-colors"
            >
              Documentation
            </a>
            <a 
              href="https://tinycloud.xyz/protocol" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-sm text-text-muted hover:text-primary-600 transition-colors"
            >
              Protocol
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;