#!/usr/bin/env node

/**
 * API Documentation Generator for TinyCloud SDK
 * 
 * This script automates the process of generating API documentation for the TinyCloud SDK
 * using Microsoft's API Extractor and API Documenter tools. It handles:
 * 
 * 1. Building the SDK if needed
 * 2. Running API Extractor to create an API model
 * 3. Running API Documenter to generate markdown documentation
 * 4. Processing and enhancing the generated markdown
 * 5. Organizing documentation into the Docusaurus site structure
 */

const { execSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync } = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '../../');
const WEB_SDK_DIR = path.join(ROOT_DIR, 'packages/web-sdk');
const DOCS_DIR = path.join(ROOT_DIR, 'documentation/docs/web-sdk');
const API_DOCS_DIR = path.join(DOCS_DIR, 'api');
const GUIDES_DIR = path.join(DOCS_DIR, 'guides');
const TEMP_DIR = path.join(WEB_SDK_DIR, 'temp');

// Ensure the output directories exist
[DOCS_DIR, API_DOCS_DIR, GUIDES_DIR].forEach(dir => {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
});

// Make the script executable in case we need to run it directly
try {
  execSync('chmod +x ' + __filename);
} catch (error) {
  console.warn('Could not make the script executable:', error.message);
}

/**
 * Builds the SDK if the dist directory does not exist.
 */
function buildSDKIfNeeded() {
  if (!existsSync(path.join(WEB_SDK_DIR, 'dist'))) {
    console.log('Building web-sdk...');
    execSync('bun run build', { cwd: WEB_SDK_DIR, stdio: 'inherit' });
  }
}

/**
 * Runs API Extractor to generate the API model.
 */
function runApiExtractor() {
  console.log('Running API Extractor...');
  try {
    execSync('bun run api-extractor run --local', { cwd: WEB_SDK_DIR, stdio: 'inherit' });
  } catch (error) {
    console.warn('API Extractor completed with warnings (this may be normal)');
  }
}

/**
 * Runs API Documenter to generate markdown documentation from the API model.
 */
function runApiDocumenter() {
  console.log('Running API Documenter...');
  execSync('bun run api-documenter markdown -i temp -o temp/markdown', { cwd: WEB_SDK_DIR, stdio: 'inherit' });
}

/**
 * Enhances the generated API documentation with better formatting and additional metadata.
 */
function enhanceApiDocs() {
  console.log('Enhancing API documentation...');
  
  const markdownDir = path.join(TEMP_DIR, 'markdown');
  if (!existsSync(markdownDir)) {
    console.warn('Markdown directory not found:', markdownDir);
    return false;
  }
  
  // Get all markdown files
  const files = readdirSync(markdownDir);
  
  // Process each file
  files.forEach((file, index) => {
    if (file.endsWith('.md')) {
      const sourcePath = path.join(markdownDir, file);
      const destPath = path.join(API_DOCS_DIR, file);
      
      // Read the file content
      let content = readFileSync(sourcePath, 'utf8');
      
      // Add Docusaurus frontmatter
      const title = content.match(/^# (.*)/m)?.[1] || 'API Reference';
      content = `---
sidebar_position: ${index + 1}
title: "${title}"
---

${content}`;
      
      // Improve content formatting (replace Microsoft-specific syntax with more standard markdown)
      content = content
        // Make links nicer
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
          // Clean up API Documenter's link paths
          return `[${text}](${url.replace(/%20/g, '-').toLowerCase()})`;
        })
        // Fix code block formatting
        .replace(/```(\w+)/g, '```$1')
        // Add line breaks for better readability
        .replace(/<!-- -->/g, '\n');
      
      // Write to the destination
      writeFileSync(destPath, content);
      console.log(`Enhanced ${file} to ${destPath}`);
    }
  });
  
  // Create index file for API docs
  createIndexFile(API_DOCS_DIR, 'API Reference', 
    'Comprehensive reference documentation for the TinyCloud Web SDK API.',
    files.map(file => file.replace('.md', '')));
  
  return true;
}

/**
 * Creates an index file with links to child pages.
 * 
 * @param {string} dir - The directory to create the index file in
 * @param {string} title - The title of the index page
 * @param {string} description - The description text
 * @param {string[]} links - Array of page names to link to
 */
function createIndexFile(dir, title, description, links = []) {
  const content = `---
sidebar_position: 1
---

# ${title}

${description}

${links.map(link => `- [${formatLinkName(link)}](./${link.toLowerCase()})`).join('\n')}
`;

  writeFileSync(path.join(dir, 'index.md'), content);
  console.log(`Created index file in ${dir}`);
}

/**
 * Formats a filename into a readable link name.
 * 
 * @param {string} name - The filename without extension
 * @returns {string} A formatted version for display
 */
function formatLinkName(name) {
  return name
    .replace(/\.md$/, '')
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Creates or updates the main documentation layout with guides and API reference sections.
 */
function setupDocumentationStructure() {
  console.log('Setting up documentation structure...');
  
  // Create main index file
  const mainIndexContent = `---
sidebar_position: 1
---

# TinyCloud Web SDK

Welcome to the TinyCloud Web SDK documentation. This SDK provides all the tools you need to build decentralized web applications with TinyCloud.

## Getting Started

To get started with the TinyCloud Web SDK, first install the package:

\`\`\`bash
npm install @tinycloudlabs/web-sdk
# or
bun add @tinycloudlabs/web-sdk
\`\`\`

Then import and initialize the SDK in your application:

\`\`\`typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

const tc = new TinyCloudWeb({
  // Configuration options here
});

// Connect to the user's wallet
await tc.connect();
\`\`\`

## Documentation Sections

- [**Guides**](./guides/) - Step-by-step tutorials and how-to guides
- [**API Reference**](./api/) - Detailed reference documentation for all SDK components
`;

  writeFileSync(path.join(DOCS_DIR, 'index.md'), mainIndexContent);
  
  // Create guides index if it doesn't exist
  if (!existsSync(path.join(GUIDES_DIR, 'index.md'))) {
    createIndexFile(GUIDES_DIR, 'Guides', 
      'Step-by-step tutorials and how-to guides for using the TinyCloud Web SDK.');
    
    // Create a getting-started guide as an example
    const gettingStartedContent = `---
sidebar_position: 1
---

# Getting Started

This guide will help you get started with the TinyCloud Web SDK.

## Installation

Install the SDK using your preferred package manager:

\`\`\`bash
npm install @tinycloudlabs/web-sdk
# or
bun add @tinycloudlabs/web-sdk
\`\`\`

## Basic Usage

Here's a simple example of how to initialize the SDK and connect to a user's wallet:

\`\`\`typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

// Initialize the SDK
const tc = new TinyCloudWeb({
  // Your configuration options
});

// Connect to the user's wallet
await tc.connect();

// Now you can use the SDK's functionality
// For example, storing data with Kepler
const storage = tc.storage;
await storage.put('myKey', { hello: 'world' });

// Or retrieving data
const result = await storage.get('myKey');
console.log(result.data); // { hello: 'world' }
\`\`\`

## Next Steps

Check out these guides to learn more:

- [Working with Storage](./storage-guide)
- [Authentication](./authentication-guide)
`;
    
    writeFileSync(path.join(GUIDES_DIR, 'getting-started.md'), gettingStartedContent);
  }
}

/**
 * Main function to generate API documentation.
 */
function generateApiDocs() {
  console.log('Generating API documentation for TinyCloud SDK...');
  
  try {
    // Step 1: Build the SDK if needed
    buildSDKIfNeeded();
    
    // Step 2: Run API Extractor to generate API model
    runApiExtractor();
    
    // Step 3: Run API Documenter to generate markdown
    runApiDocumenter();
    
    // Step 4: Enhance the generated documentation
    const success = enhanceApiDocs();
    
    if (!success) {
      createFallbackDocumentation();
      return;
    }
    
    // Step 5: Setup documentation structure
    setupDocumentationStructure();
    
    console.log('API documentation generation complete!');
    
  } catch (error) {
    console.error('Error generating API documentation:', error.message);
    createFallbackDocumentation(error.message);
    process.exit(1);
  }
}

/**
 * Creates fallback documentation when the normal generation process fails.
 * 
 * @param {string} errorMessage - Optional error message to include
 */
function createFallbackDocumentation(errorMessage = '') {
  console.warn('Creating fallback documentation...');
  
  writeFileSync(
    path.join(API_DOCS_DIR, 'index.md'),
    `---
sidebar_position: 1
---

# API Reference

The API documentation is currently being updated. Please check back later.

${errorMessage ? `Error: ${errorMessage}` : ''}
`
  );
}

// Execute the script
generateApiDocs();