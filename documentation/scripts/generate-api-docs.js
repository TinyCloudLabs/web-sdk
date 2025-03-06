#!/usr/bin/env node

const { execSync } = require('child_process');
const { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '../../');
const WEB_SDK_DIR = path.join(ROOT_DIR, 'packages/web-sdk');
const OUTPUT_DIR = path.join(ROOT_DIR, 'documentation/docusaurus/docs/web-sdk/api');

// Ensure the output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Generate API docs using api-extractor and api-documenter
function generateApiDocs() {
  console.log('Generating API documentation...');
  
  try {
    // Run the build if needed
    if (!existsSync(path.join(WEB_SDK_DIR, 'dist'))) {
      console.log('Building web-sdk...');
      execSync('bun run build', { cwd: WEB_SDK_DIR, stdio: 'inherit' });
    }
    
    // Run API Extractor - using npx instead of bun
    console.log('Running API Extractor...');
    execSync('npx api-extractor run --local', { cwd: WEB_SDK_DIR, stdio: 'inherit' });
    
    // Run API Documenter - using npx instead of bun
    console.log('Running API Documenter...');
    execSync('npx api-documenter markdown -i temp -o temp/markdown', { cwd: WEB_SDK_DIR, stdio: 'inherit' });
    
    // Create temp/markdown directory if it doesn't exist
    const markdownDir = path.join(WEB_SDK_DIR, 'temp/markdown');
    if (!existsSync(markdownDir)) {
      console.warn('Markdown directory not found:', markdownDir);
      console.warn('Creating a placeholder file instead');
      
      // Create a placeholder file
      writeFileSync(
        path.join(OUTPUT_DIR, 'index.md'),
        `---
sidebar_position: 1
---

# API Reference

The API documentation is being generated. Please check back later.
`
      );
      return;
    }
    
    // Copy generated markdown files to the docusaurus directory
    console.log('Copying documentation to Docusaurus...');
    const files = readdirSync(markdownDir);
    
    files.forEach(file => {
      if (file.endsWith('.md')) {
        const sourcePath = path.join(markdownDir, file);
        const destPath = path.join(OUTPUT_DIR, file);
        
        // Read the file and add front matter
        let content = readFileSync(sourcePath, 'utf8');
        content = `---\nsidebar_position: 1\n---\n\n${content}`;
        
        // Write to the destination
        writeFileSync(destPath, content);
        console.log(`Copied ${file} to ${destPath}`);
      }
    });
    
    console.log('API documentation generation complete!');
  } catch (error) {
    console.error('Error generating API documentation:', error.message);
    
    // Create a placeholder file if there's an error
    console.warn('Creating a placeholder file instead');
    writeFileSync(
      path.join(OUTPUT_DIR, 'index.md'),
      `---
sidebar_position: 1
---

# API Reference

The API documentation generation encountered an error. Please try again later.

Error: ${error.message}
`
    );
    
    process.exit(1);
  }
}

generateApiDocs();