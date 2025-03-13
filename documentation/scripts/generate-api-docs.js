#!/usr/bin/env node

/**
 * API Documentation Generator for TinyCloud SDK
 * 
 * This script automates the process of generating API documentation for the TinyCloud SDK
 * using Microsoft's API Extractor and API Documenter tools. It handles:
 * 
 * 1. Building all SDK packages if needed
 * 2. Running API Extractor to create API models for each package
 * 3. Running API Documenter to generate markdown documentation
 * 4. Processing and enhancing the generated markdown with additional metadata
 * 5. Organizing documentation into the Docusaurus site structure
 * 6. Generating cross-links between related API components
 * 7. Adding code examples and usage notes where applicable
 */

const { execSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync, renameSync } = require('fs');
const { resolve, join, basename, dirname } = require('path');

// Configuration
const ROOT_DIR = resolve(__dirname, '../../');
const PACKAGES_DIR = join(ROOT_DIR, 'packages');
const DOCUMENTATION_DIR = join(ROOT_DIR, 'documentation');
const DOCS_DIR = join(DOCUMENTATION_DIR, 'docs/web-sdk');
const API_DOCS_DIR = join(DOCS_DIR, 'api');
const GUIDES_DIR = join(DOCS_DIR, 'guides');
const EXAMPLES_DIR = join(DOCS_DIR, 'examples');
const WEB_CORE_DIR = join(PACKAGES_DIR, 'web-core');
const WEB_SDK_DIR = join(PACKAGES_DIR, 'web-sdk');
const WEB_SDK_RS_DIR = join(PACKAGES_DIR, 'web-sdk-rs');
const TEMP_DIR = join(DOCUMENTATION_DIR, 'temp');
const EXAMPLES_SOURCE_DIR = join(ROOT_DIR, 'examples/web-sdk-example/src');

// Package configuration
const PACKAGES = [
  {
    name: 'web-sdk',
    dir: WEB_SDK_DIR,
    title: 'Web SDK',
    description: 'The main TinyCloud Web SDK package',
    buildCommand: 'bun run build',
    apiExtractorConfig: 'api-extractor.json'
  },
  {
    name: 'web-core',
    dir: WEB_CORE_DIR,
    title: 'Web Core',
    description: 'Core utilities and types for TinyCloud SDKs',
    buildCommand: 'bun run build',
    apiExtractorConfig: 'api-extractor.json'
  }
];

// Ensure the output directories exist
[DOCS_DIR, API_DOCS_DIR, GUIDES_DIR, EXAMPLES_DIR, TEMP_DIR].forEach(dir => {
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
 * Builds all SDK packages if their dist directories do not exist.
 */
function buildSDKPackages() {
  console.log('Checking SDK packages and building if needed...');
  
  // Build all configured packages
  for (const pkg of PACKAGES) {
    if (!existsSync(join(pkg.dir, 'dist'))) {
      console.log(`Building ${pkg.name}...`);
      try {
        execSync(pkg.buildCommand, { cwd: pkg.dir, stdio: 'inherit' });
      } catch (error) {
        console.error(`Error building ${pkg.name}:`, error.message);
        throw error;
      }
    } else {
      console.log(`${pkg.name} already built, skipping...`);
    }
  }
}

/**
 * Runs API Extractor for all packages to generate API models.
 */
function runApiExtractor() {
  console.log('Running API Extractor for all packages...');
  
  // Clear the temp directory to avoid stale files
  try {
    execSync(`rm -rf ${TEMP_DIR}/*`, { stdio: 'inherit' });
  } catch (error) {
    // It's okay if this fails (e.g., first run)
  }
  
  // Create package-specific directories in temp
  for (const pkg of PACKAGES) {
    const pkgTempDir = join(TEMP_DIR, pkg.name);
    if (!existsSync(pkgTempDir)) {
      mkdirSync(pkgTempDir, { recursive: true });
    }
    
    console.log(`Running API Extractor for ${pkg.name}...`);
    try {
      execSync(`bun run api-extractor run --local --config ${pkg.apiExtractorConfig}`, { 
        cwd: pkg.dir, 
        stdio: 'inherit',
        env: { ...process.env, API_EXTRACTOR_OUTPUT_DIR: pkgTempDir }
      });
      
      // Copy the API model to the temp directory
      if (existsSync(join(pkg.dir, 'temp/api-extractor.api.json'))) {
        copyFileSync(
          join(pkg.dir, 'temp/api-extractor.api.json'), 
          join(pkgTempDir, 'api-extractor.api.json')
        );
      }
    } catch (error) {
      console.warn(`API Extractor for ${pkg.name} completed with warnings (this may be normal)`);
    }
  }
}

/**
 * Runs API Documenter to generate markdown documentation from all API models.
 */
function runApiDocumenter() {
  console.log('Running API Documenter...');
  
  // Create the markdown output directory
  const markdownDir = join(TEMP_DIR, 'markdown');
  if (!existsSync(markdownDir)) {
    mkdirSync(markdownDir, { recursive: true });
  }
  
  try {
    // Run API Documenter on all API models in the temp directory
    execSync(`bun run api-documenter markdown -i ${TEMP_DIR} -o ${markdownDir}`, { 
      cwd: DOCUMENTATION_DIR, 
      stdio: 'inherit' 
    });
  } catch (error) {
    console.error('Error running API Documenter:', error.message);
    throw error;
  }
}

/**
 * Enhances the generated API documentation with better formatting and additional metadata.
 */
function enhanceApiDocs() {
  console.log('Enhancing API documentation...');
  
  const markdownDir = join(TEMP_DIR, 'markdown');
  if (!existsSync(markdownDir)) {
    console.warn('Markdown directory not found:', markdownDir);
    return false;
  }
  
  // Get all markdown files
  const files = readdirSync(markdownDir);
  const filesByPackage = {};
  
  // Group files by package
  files.forEach(file => {
    if (file.endsWith('.md')) {
      const content = readFileSync(join(markdownDir, file), 'utf8');
      
      // Determine which package this file belongs to
      let packageName = 'web-sdk'; // Default
      for (const pkg of PACKAGES) {
        if (content.includes(pkg.name) || file.toLowerCase().includes(pkg.name.toLowerCase())) {
          packageName = pkg.name;
          break;
        }
      }
      
      if (!filesByPackage[packageName]) {
        filesByPackage[packageName] = [];
      }
      
      filesByPackage[packageName].push(file);
    }
  });
  
  // Process each file with enhanced metadata
  let processedFiles = [];
  let fileIndex = 1;
  
  Object.entries(filesByPackage).forEach(([packageName, packageFiles]) => {
    // Create package directory if needed
    const packageDir = join(API_DOCS_DIR, packageName.replace('web-', ''));
    if (!existsSync(packageDir)) {
      mkdirSync(packageDir, { recursive: true });
    }
    
    // Process each file in the package
    packageFiles.forEach((file, index) => {
      const sourcePath = join(markdownDir, file);
      const destPath = join(packageDir, file);
      
      // Read the file content
      let content = readFileSync(sourcePath, 'utf8');
      
      // Extract title and description
      const title = content.match(/^# (.*)/m)?.[1] || 'API Reference';
      const descriptionMatch = content.match(/^# .*\n\n(.*?)(\n\n|\n##|$)/s);
      const description = descriptionMatch ? descriptionMatch[1].trim() : '';
      
      // Find package info
      const pkg = PACKAGES.find(p => p.name === packageName) || PACKAGES[0];
      
      // Add enhanced Docusaurus frontmatter
      content = `---
id: ${file.replace('.md', '')}
title: "${title}"
sidebar_position: ${index + 1}
description: "${description.replace(/"/g, '\\"') || `API reference for ${title}`}"
package: "${pkg.name}"
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

${content}`;
      
      // Improve content formatting
      content = enhanceMarkdownContent(content, packageName, filesByPackage);
      
      // Add usage examples if available
      content = addCodeExamples(content, title, packageName);
      
      // Write to the destination
      writeFileSync(destPath, content);
      console.log(`Enhanced ${file} to ${destPath}`);
      
      processedFiles.push({
        packageName,
        file,
        title,
        description,
        path: destPath.replace(API_DOCS_DIR, '').replace(/^\//, '')
      });
      
      fileIndex++;
    });
    
    // Create package index file
    createPackageIndexFile(packageDir, packageName, processedFiles.filter(f => f.packageName === packageName));
  });
  
  // Create main API reference index
  createMainApiIndex(processedFiles);
  
  return true;
}

/**
 * Enhances markdown content with improved formatting and cross-linking.
 * 
 * @param {string} content - The original markdown content
 * @param {string} packageName - The package this content belongs to
 * @param {Object} filesByPackage - Files grouped by package
 * @returns {string} - Enhanced content
 */
function enhanceMarkdownContent(content, packageName, filesByPackage) {
  return content
    // Improve heading formatting
    .replace(/^# (.*)/m, (match, title) => {
      return `# ${title}\n\n<div className="api-docs-package-badge">${packageName}</div>`;
    })
    
    // Fix links to other API items
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      // Don't modify external links or anchor links
      if (url.startsWith('http') || url.startsWith('#')) {
        return match;
      }
      
      // Clean up API Documenter's link paths and resolve cross-package links
      let cleanUrl = url.replace(/%20/g, '-').toLowerCase();
      
      // Determine if link points to a file in a different package
      const targetFile = cleanUrl.endsWith('.md') 
        ? basename(cleanUrl)
        : `${cleanUrl}.md`;
      
      let targetPackage = packageName;
      
      // Check if the target file exists in a different package
      for (const [pkgName, files] of Object.entries(filesByPackage)) {
        if (pkgName !== packageName && files.includes(targetFile)) {
          targetPackage = pkgName;
          break;
        }
      }
      
      // Construct the correct path
      const relativePath = targetPackage === packageName 
        ? cleanUrl 
        : `../${targetPackage.replace('web-', '')}/${basename(cleanUrl)}`;
      
      return `[${text}](${relativePath})`;
    })
    
    // Fix code block formatting
    .replace(/```(\w+)/g, '```$1')
    
    // Add line breaks for better readability
    .replace(/<!-- -->/g, '\n')
    
    // Enhance method signatures for better readability
    .replace(/^## (.*)\(.*\)/gm, (match, methodName) => {
      return `## ${methodName}()`;
    })
    
    // Add method signature details
    .replace(/^## ([^\s(]+)\(\)/gm, (match, methodName, offset) => {
      // Look for the method signature after the heading
      const signatureMatch = content.slice(offset).match(/(?:public|protected|private)?\s+\w+\s*\(([^)]*)\)/);
      if (signatureMatch) {
        return `## ${methodName}()\n\n<div className="api-method-signature">\`${signatureMatch[0]}\`</div>`;
      }
      return match;
    })
    
    // Add "Returns" heading before return statements
    .replace(/Returns (.*?)(?=\n\n|\n##|$)/gs, 'Returns:\n\n$1')
    
    // Enhance parameter tables
    .replace(/\| Parameter \| Type \| Description \|\n\|[- |]+\|\n((?:\|[^|]+\|[^|]+\|[^|]+\|\n)+)/g, 
      '<h3>Parameters</h3>\n\n| Parameter | Type | Description |\n|:----------|:-----|:------------|\n$1')
    
    // Fix type links in parameter tables
    .replace(/\| `([^`]+)` \| \[([^\]]+)\]\(([^)]+)\) \| (.*) \|/g, 
      '| `$1` | <a href="$3">$2</a> | $4 |');
}

/**
 * Adds code examples to API documentation where applicable.
 * 
 * @param {string} content - The markdown content
 * @param {string} title - The title of the API item
 * @param {string} packageName - The package name
 * @returns {string} - Content with added examples
 */
function addCodeExamples(content, title, packageName) {
  // Only add examples for key items
  const importantItems = [
    'TinyCloudWeb', 'TinyCloudStorage', 'UserAuthorization',
    'connect', 'authenticate', 'put', 'get', 'delete', 'list'
  ];
  
  if (!importantItems.some(item => title.includes(item))) {
    return content;
  }
  
  // Extract base name to look for in example code
  const baseName = title.replace(/Class|Interface|Type|Function|Method|Property/g, '').trim();
  
  // Read example code if available
  try {
    const examplesFound = findExampleCode(baseName, packageName);
    
    if (examplesFound && examplesFound.length > 0) {
      const examplesSection = `
## Examples

${examplesFound.map(example => `
<Tabs>
  <TabItem value="typescript" label="TypeScript" default>

\`\`\`typescript
${example.code}
\`\`\`

  </TabItem>
  <TabItem value="javascript" label="JavaScript">

\`\`\`javascript
${example.code.replace(/<.*>/g, '').replace(/: \w+/g, '')}
\`\`\`

  </TabItem>
</Tabs>

${example.description ? `_${example.description}_` : ''}
`).join('\n')}
`;
      
      // Add examples section before the first second-level heading or at the end
      const headingMatch = content.match(/\n## /);
      if (headingMatch) {
        return content.slice(0, headingMatch.index) + examplesSection + content.slice(headingMatch.index);
      } else {
        return content + '\n' + examplesSection;
      }
    }
  } catch (error) {
    console.warn(`Could not find examples for ${title}:`, error.message);
  }
  
  return content;
}

/**
 * Finds example code for a given API item.
 * 
 * @param {string} apiItemName - The name of the API item
 * @param {string} packageName - The package name
 * @returns {Array} - Array of found examples with code and description
 */
function findExampleCode(apiItemName, packageName) {
  const examples = [];
  
  // Skip empty or generic names
  if (!apiItemName || apiItemName === 'index' || apiItemName.length < 3) {
    return examples;
  }
  
  // Search example files to find usage of this API item
  try {
    if (existsSync(EXAMPLES_SOURCE_DIR)) {
      const files = readdirSync(EXAMPLES_SOURCE_DIR, { recursive: true });
      
      for (const file of files) {
        const filePath = join(EXAMPLES_SOURCE_DIR, file);
        if (statSync(filePath).isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
          const content = readFileSync(filePath, 'utf8');
          
          // Look for usage of the API item
          if (content.includes(apiItemName)) {
            // Try to extract a relevant code snippet
            const lines = content.split('\n');
            let startLine = -1;
            let endLine = -1;
            
            // Find a block of code that uses this API item
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].includes(apiItemName)) {
                // Find the start of the containing function/block
                let level = 0;
                let j = i;
                while (j >= 0) {
                  if (lines[j].includes('{')) level--;
                  if (lines[j].includes('}')) level++;
                  if ((lines[j].includes('function') || lines[j].includes('=>') || lines[j].includes('const')) && level <= 0) {
                    startLine = j;
                    break;
                  }
                  j--;
                }
                
                // If we couldn't find a function start, use a window around the API item
                if (startLine === -1) {
                  startLine = Math.max(0, i - 5);
                }
                
                // Find the end of the block
                level = 0;
                j = i;
                while (j < lines.length) {
                  if (lines[j].includes('{')) level++;
                  if (lines[j].includes('}')) level--;
                  if (level <= 0 && lines[j].includes('}')) {
                    endLine = j + 1;
                    break;
                  }
                  j++;
                }
                
                // If we couldn't find the end, use a reasonable window
                if (endLine === -1) {
                  endLine = Math.min(lines.length, i + 15);
                }
                
                // Extract the code snippet
                const codeSnippet = lines.slice(startLine, endLine).join('\n');
                
                // Only add if the snippet is not too long and contains meaningful code
                if (codeSnippet.length > 0 && codeSnippet.length < 500 && !codeSnippet.includes('import { ')) {
                  examples.push({
                    code: codeSnippet,
                    description: `Example from ${file}`
                  });
                  break; // Only use one example per file
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.warn(`Error searching for examples:`, error.message);
  }
  
  return examples;
}

/**
 * Creates an index file for a specific package's API docs.
 * 
 * @param {string} packageDir - The directory for the package
 * @param {string} packageName - The name of the package
 * @param {Array} files - Array of processed files for this package
 */
function createPackageIndexFile(packageDir, packageName, files) {
  // Find package info
  const pkg = PACKAGES.find(p => p.name === packageName) || {
    name: packageName,
    title: `${packageName.charAt(0).toUpperCase() + packageName.slice(1)}`,
    description: `API documentation for the ${packageName} package`
  };
  
  // Group files by type
  const classes = files.filter(f => f.title.includes('Class'));
  const interfaces = files.filter(f => f.title.includes('Interface'));
  const functions = files.filter(f => f.title.includes('Function'));
  const types = files.filter(f => f.title.includes('Type') || (!f.title.includes('Class') && !f.title.includes('Interface') && !f.title.includes('Function')));
  
  const content = `---
sidebar_position: 1
title: "${pkg.title} API"
---

# ${pkg.title} API Reference

${pkg.description}

${classes.length > 0 ? `
## Classes

${classes.map(f => `- [${f.title.replace(' Class', '')}](./${basename(f.path).replace('.md', '')}) - ${f.description}`).join('\n')}
` : ''}

${interfaces.length > 0 ? `
## Interfaces

${interfaces.map(f => `- [${f.title.replace(' Interface', '')}](./${basename(f.path).replace('.md', '')}) - ${f.description}`).join('\n')}
` : ''}

${functions.length > 0 ? `
## Functions

${functions.map(f => `- [${f.title.replace(' Function', '')}](./${basename(f.path).replace('.md', '')}) - ${f.description}`).join('\n')}
` : ''}

${types.length > 0 ? `
## Types

${types.map(f => `- [${f.title.replace(' Type', '')}](./${basename(f.path).replace('.md', '')}) - ${f.description}`).join('\n')}
` : ''}
`;

  writeFileSync(join(packageDir, 'index.md'), content);
  console.log(`Created package index file for ${packageName}`);
}

/**
 * Creates the main API reference index file.
 * 
 * @param {Array} allFiles - All processed files
 */
function createMainApiIndex(allFiles) {  
  const content = `---
sidebar_position: 1
title: "API Reference"
---

# TinyCloud SDK API Reference

Comprehensive reference documentation for the TinyCloud SDK packages.

${PACKAGES.map(pkg => {
  const pkgPath = pkg.name.replace('web-', '');
  return `## [${pkg.title}](./${pkgPath}/)

${pkg.description}

[View full ${pkg.title} API Reference](./${pkgPath}/)
`;
}).join('\n')}
`;

  writeFileSync(join(API_DOCS_DIR, 'index.md'), content);
  console.log('Created main API index file');
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
 * Creates examples documentation from SDK examples.
 */
function createExamplesDocs() {
  console.log('Creating examples documentation...');
  
  if (!existsSync(EXAMPLES_SOURCE_DIR)) {
    console.warn('Examples source directory not found:', EXAMPLES_SOURCE_DIR);
    return;
  }
  
  // Create the examples index file
  const examplesIndexContent = `---
sidebar_position: 1
title: "Code Examples"
---

# TinyCloud SDK Code Examples

Practical examples showing how to use the TinyCloud SDK.

These examples demonstrate common patterns and use cases to help you get started with the SDK quickly.

## Available Examples

- [Basic Storage Operations](#storage-operations) - How to store and retrieve data
- [Authentication](#authentication) - How to authenticate users with wallets
- [Complete Applications](#complete-applications) - Full examples integrating multiple SDK features
`;

  writeFileSync(join(EXAMPLES_DIR, 'index.md'), examplesIndexContent);

  // Extract interesting examples from the examples app
  try {
    // Find key examples from the source code
    const exampleCategories = [
      {
        id: 'storage',
        title: 'Storage Examples',
        description: 'Examples demonstrating how to use the TinyCloud storage functionality',
        keywordPatterns: ['storage', 'put\\(', 'get\\(', 'delete\\(', 'list\\(']
      },
      {
        id: 'auth',
        title: 'Authentication Examples',
        description: 'Examples showing how to handle user authentication and wallet connections',
        keywordPatterns: ['connect\\(', 'authenticate', 'UserAuthorization', 'wallet']
      }
    ];
    
    // Process each category
    for (const category of exampleCategories) {
      const examples = [];
      
      // Search for files containing the keywords
      for (const pattern of category.keywordPatterns) {
        try {
          // Use grep to find files containing the pattern
          const grepCommand = `grep -r "${pattern}" ${EXAMPLES_SOURCE_DIR} --include="*.ts" --include="*.tsx"`;
          const grepResult = execSync(grepCommand, { encoding: 'utf8' }).trim();
          
          // Process grep results
          if (grepResult) {
            const lines = grepResult.split('\n');
            for (const line of lines) {
              const [filePath, ...rest] = line.split(':');
              if (filePath && !examples.includes(filePath)) {
                examples.push(filePath);
              }
            }
          }
        } catch (error) {
          // Grep may return an error if no files match - that's okay
        }
      }
      
      // Create a documentation file for this category
      if (examples.length > 0) {
        let categoryContent = `---
sidebar_position: ${exampleCategories.indexOf(category) + 2}
title: "${category.title}"
---

# ${category.title}

${category.description}

`;

        // Process each example file
        for (const examplePath of examples) {
          const fileName = basename(examplePath);
          const content = readFileSync(examplePath, 'utf8');
          
          // Extract usable code examples
          const lines = content.split('\n');
          const exampleBlocks = [];
          let currentBlock = { start: -1, end: -1, blockType: '' };
          
          // Find coherent blocks of code demonstrating SDK usage
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for method calls that might be examples
            for (const pattern of category.keywordPatterns) {
              if (line.match(new RegExp(pattern))) {
                // Found a line matching our pattern, start collecting a block
                if (currentBlock.start === -1) {
                  // Look backwards to find a good starting point (function, component, etc.)
                  let blockStart = i;
                  let blockType = 'snippet';
                  
                  // Check previous lines to find a function/component definition
                  for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
                    if (lines[j].match(/function \w+|const \w+ = \(|export (default )?function/)) {
                      blockStart = j;
                      blockType = 'function';
                      break;
                    }
                  }
                  
                  currentBlock = { start: blockStart, end: -1, blockType };
                }
                
                // Update the end of the block to include this line
                currentBlock.end = i + 1;
                
                // Look ahead to find a good ending point (at least include the call and its response handling)
                let j = i + 1;
                while (j < Math.min(lines.length, i + 15)) {
                  if (lines[j].includes('}') && 
                      (lines[j-1].includes('return') || lines[j-1].match(/;$/))) {
                    currentBlock.end = j + 1;
                    break;
                  }
                  j++;
                }
              }
            }
            
            // If we've moved past the current block, save it and reset
            if (currentBlock.start !== -1 && i > currentBlock.end + 10) {
              exampleBlocks.push({
                code: lines.slice(currentBlock.start, currentBlock.end).join('\n'),
                type: currentBlock.blockType
              });
              currentBlock = { start: -1, end: -1, blockType: '' };
            }
          }
          
          // Add any final block
          if (currentBlock.start !== -1 && currentBlock.end !== -1) {
            exampleBlocks.push({
              code: lines.slice(currentBlock.start, currentBlock.end).join('\n'),
              type: currentBlock.blockType
            });
          }
          
          // Only include the file if we found meaningful examples
          if (exampleBlocks.length > 0) {
            const componentName = fileName.replace(/\.\w+$/, '');
            
            categoryContent += `## ${formatLinkName(componentName)}\n\n`;
            
            // Add a description if we can determine one
            const fileDescription = content.match(/\/\*\*([\s\S]*?)\*\//);
            if (fileDescription) {
              categoryContent += `${fileDescription[1].replace(/\s*\*\s*/g, ' ').trim()}\n\n`;
            }
            
            // Add each example block
            exampleBlocks.forEach((block, index) => {
              categoryContent += `### Example ${index + 1}: ${block.type === 'function' ? 'Complete Function' : 'Code Snippet'}\n\n`;
              categoryContent += `\`\`\`typescript\n${block.code}\n\`\`\`\n\n`;
            });
          }
        }
        
        // Write the category file
        writeFileSync(join(EXAMPLES_DIR, `${category.id}.md`), categoryContent);
        console.log(`Created ${category.title} documentation`);
      }
    }
  } catch (error) {
    console.warn('Error creating examples documentation:', error.message);
  }
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

## Key Features

- **Decentralized Storage** - Store and retrieve data using the TinyCloud protocol
- **Web3 Authentication** - Sign-in with Ethereum (SIWE) integration
- **Wallet Integration** - Seamless connection with popular Ethereum wallets
- **Type Safety** - Written in TypeScript with comprehensive type definitions
- **Easy to Use** - Simple API for common decentralized application needs

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

// Use storage
const storage = tc.storage;
await storage.put('myKey', { hello: 'world' });
const result = await storage.get('myKey');
console.log(result.data); // { hello: 'world' }
\`\`\`

## Documentation Sections

- [**Guides**](./guides/) - Step-by-step tutorials and how-to guides
- [**API Reference**](./api/) - Detailed reference documentation for all SDK components
- [**Examples**](./examples/) - Code examples for common use cases
`;

  writeFileSync(join(DOCS_DIR, 'index.md'), mainIndexContent);
  
  // Create guides index if it doesn't exist
  if (!existsSync(join(GUIDES_DIR, 'index.md'))) {
    createIndexFile(GUIDES_DIR, 'Guides', 
      'Step-by-step tutorials and how-to guides for using the TinyCloud Web SDK.');
    
    // Create a getting-started guide as an example
    const gettingStartedContent = `---
sidebar_position: 1
---

# Getting Started with TinyCloud SDK

This guide will help you get started with the TinyCloud Web SDK, a comprehensive toolkit for building decentralized web applications.

## Prerequisites

Before you begin, make sure you have:

- Node.js (v16 or later) or Bun installed
- A modern web browser
- Basic knowledge of JavaScript/TypeScript
- (Optional) A Web3 wallet like MetaMask for testing authentication

## Installation

Install the SDK using your preferred package manager:

\`\`\`bash
# Using npm
npm install @tinycloudlabs/web-sdk

# Using Bun (recommended)
bun add @tinycloudlabs/web-sdk
\`\`\`

## Basic Usage

Here's a simple example of how to initialize the SDK and connect to a user's wallet:

\`\`\`typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

// Initialize the SDK
const tc = new TinyCloudWeb({
  projectId: 'your-project-id', // Get this from your TinyCloud dashboard
  environment: 'development' // 'development' or 'production'
});

// Connect to the user's wallet
try {
  await tc.connect();
  console.log('Connected to wallet:', tc.address);
  
  // Now you can use the SDK's functionality
  const storage = tc.storage;
  
  // Store data
  await storage.put('myKey', { hello: 'world' });
  console.log('Data stored successfully');
  
  // Retrieve data
  const result = await storage.get('myKey');
  console.log('Retrieved data:', result.data); // { hello: 'world' }
} catch (error) {
  console.error('Error connecting to wallet:', error);
}
\`\`\`

## Next Steps

Now that you have the basics, check out these guides to learn more:

- [Working with Storage](./storage-guide) - Learn how to store, retrieve, and manage data
- [Authentication Guide](./authentication-guide) - Understand user authentication with wallets
- [Advanced Configuration](./advanced-configuration) - Explore advanced SDK options

## Example Projects

For complete working examples, check out our [example projects](../examples/) that demonstrate common patterns and use cases.
`;
    
    writeFileSync(join(GUIDES_DIR, 'getting-started.md'), gettingStartedContent);
    
    // Create additional guide files
    const storageGuide = `---
sidebar_position: 2
---

# Working with Storage

This guide explains how to use the storage capabilities of the TinyCloud SDK.

## Overview

TinyCloud provides a decentralized storage solution that lets you store and retrieve data without relying on centralized servers. The storage interface is designed to be familiar to developers who have worked with key-value stores.

## Basic Operations

### Initializing Storage

Once you've initialized the SDK and connected to a wallet, you can access the storage interface:

\`\`\`typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

const tc = new TinyCloudWeb({
  projectId: 'your-project-id'
});

await tc.connect();

// Access the storage interface
const storage = tc.storage;
\`\`\`

### Storing Data

Store data using the \`put\` method:

\`\`\`typescript
// Store a simple value
await storage.put('user-preferences', { 
  theme: 'dark',
  notifications: true 
});

// Store with metadata
await storage.put('profile-image', imageBlob, {
  contentType: 'image/jpeg',
  public: true
});
\`\`\`

### Retrieving Data

Retrieve data using the \`get\` method:

\`\`\`typescript
// Get data
const result = await storage.get('user-preferences');
console.log(result.data); // { theme: 'dark', notifications: true }

// Check if retrieval was successful
if (result.success) {
  // Use the data
}
\`\`\`

### Deleting Data

Delete data using the \`delete\` method:

\`\`\`typescript
await storage.delete('temporary-data');
\`\`\`

### Listing Keys

List all keys in your storage:

\`\`\`typescript
const keys = await storage.list();
console.log(keys); // ['user-preferences', 'profile-image', ...]
\`\`\`

## Advanced Features

### Storage Options

When storing data, you can specify various options:

\`\`\`typescript
await storage.put('my-data', data, {
  // Set content type (useful for files)
  contentType: 'application/json',
  
  // Make the data publicly accessible
  public: true,
  
  // Set custom metadata
  metadata: {
    created: new Date().toISOString(),
    category: 'user-content'
  }
});
\`\`\`

### Working with Files

You can store and retrieve files using the same interface:

\`\`\`typescript
// Storing a file
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];

await storage.put('profile-image', file, {
  contentType: file.type
});

// Retrieving a file
const imageResult = await storage.get('profile-image');
const imageUrl = URL.createObjectURL(imageResult.data);
document.querySelector('img').src = imageUrl;
\`\`\`

## Best Practices

- Use descriptive key names with a consistent pattern
- Group related data using prefixes (e.g., 'user:profile', 'user:settings')
- Consider data size limitations (current limit is 50MB per item)
- Handle errors appropriately with try/catch
- Use the appropriate content type when storing files

## Next Steps

- Check out the [API Reference](../api/sdk) for detailed information
- Learn about [authentication options](./authentication-guide)
- Explore [example applications](../examples) using storage
`;
    
    writeFileSync(join(GUIDES_DIR, 'storage-guide.md'), storageGuide);
    
    const authGuide = `---
sidebar_position: 3
---

# Authentication Guide

This guide explains how to use the authentication capabilities of the TinyCloud SDK.

## Overview

TinyCloud uses Web3 authentication methods, primarily Sign-in with Ethereum (SIWE), to authenticate users. This approach allows users to authenticate using their blockchain wallets without sharing private keys or passwords.

## Basic Authentication Flow

### 1. Connecting to a Wallet

The first step is to connect to the user's wallet:

\`\`\`typescript
import { TinyCloudWeb } from '@tinycloudlabs/web-sdk';

const tc = new TinyCloudWeb({
  projectId: 'your-project-id'
});

try {
  // This will prompt the user to connect their wallet
  await tc.connect();
  
  // Now you can access the user's address
  console.log('Connected wallet address:', tc.address);
} catch (error) {
  console.error('Failed to connect wallet:', error);
}
\`\`\`

### 2. Authenticating the User

After connecting to a wallet, you can authenticate the user:

\`\`\`typescript
try {
  // This will prompt the user to sign a message
  await tc.authenticate();
  
  // The user is now authenticated
  console.log('User authenticated:', tc.isAuthenticated);
  
  // You can access user information
  const userInfo = tc.userInfo;
} catch (error) {
  console.error('Authentication failed:', error);
}
\`\`\`

## Advanced Authentication

### Custom Authentication Message

You can customize the message that users sign:

\`\`\`typescript
await tc.authenticate({
  message: 'Sign this message to log in to My Awesome App',
  include: ['domain', 'uri', 'address', 'version', 'chainId']
});
\`\`\`

### Authentication Events

Listen for authentication events:

\`\`\`typescript
tc.on('auth:login', (userInfo) => {
  console.log('User logged in:', userInfo);
});

tc.on('auth:logout', () => {
  console.log('User logged out');
});

tc.on('wallet:change', (address) => {
  console.log('Wallet changed to:', address);
});
\`\`\`

### Checking Authentication Status

Check if a user is authenticated:

\`\`\`typescript
if (tc.isAuthenticated) {
  // User is authenticated
} else {
  // User is not authenticated
}
\`\`\`

### Logging Out

Log out a user:

\`\`\`typescript
await tc.logout();
\`\`\`

## Authentication Patterns

### 1. Session Management

The SDK includes built-in session management:

\`\`\`typescript
// Configure session duration when initializing
const tc = new TinyCloudWeb({
  projectId: 'your-project-id',
  auth: {
    sessionDuration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    autoRenew: true // Automatically renew session before expiry
  }
});
\`\`\`

### 2. Protected Routes

For a React application, you can create protected routes:

\`\`\`typescript
function ProtectedRoute({ children }) {
  const tc = useTinyCloud();
  
  useEffect(() => {
    const checkAuth = async () => {
      if (!tc.isAuthenticated) {
        try {
          await tc.connect();
          await tc.authenticate();
        } catch (error) {
          // Redirect to login page
          window.location.href = '/login';
        }
      }
    };
    
    checkAuth();
  }, [tc]);
  
  if (!tc.isAuthenticated) {
    return <div>Loading...</div>;
  }
  
  return children;
}
\`\`\`

## Best Practices

- Always handle authentication errors gracefully
- Provide clear feedback to users during the authentication process
- Don't request signature for non-essential actions
- Store sensitive user data in authenticated storage only
- Implement proper session management for better user experience

## Next Steps

- Check out the [API Reference](../api/sdk) for detailed information
- Learn about [storage options](./storage-guide)
- Explore [example applications](../examples) with authentication
`;
    
    writeFileSync(join(GUIDES_DIR, 'authentication-guide.md'), authGuide);
  }
  
  // Create examples documentation
  createExamplesDocs();
}

/**
 * Main function to generate API documentation.
 */
function generateApiDocs() {
  console.log('Generating API documentation for TinyCloud SDK...');
  
  try {
    // Create needed directories
    if (!existsSync(TEMP_DIR)) {
      mkdirSync(TEMP_DIR, { recursive: true });
    }
    
    // Step 1: Build all SDK packages if needed
    buildSDKPackages();
    
    // Step 2: Run API Extractor to generate API models for all packages
    runApiExtractor();
    
    // Step 3: Run API Documenter to generate markdown
    runApiDocumenter();
    
    // Step 4: Enhance the generated documentation with examples and better formatting
    const success = enhanceApiDocs();
    
    if (!success) {
      createFallbackDocumentation();
      return;
    }
    
    // Step 5: Setup documentation structure (main pages, guides, examples)
    setupDocumentationStructure();
    
    // Step 6: Add custom CSS for API documentation styling
    addCustomCSS();
    
    console.log('API documentation generation complete!');
    
  } catch (error) {
    console.error('Error generating API documentation:', error.message);
    console.error(error.stack);
    createFallbackDocumentation(error.message);
    process.exit(1);
  }
}

/**
 * Adds custom CSS for API documentation styling.
 */
function addCustomCSS() {
  const cssPath = join(DOCUMENTATION_DIR, 'src/css/custom.css');
  
  if (existsSync(cssPath)) {
    let cssContent = readFileSync(cssPath, 'utf8');
    
    // Only add our custom styles if they don't exist yet
    if (!cssContent.includes('.api-docs-package-badge')) {
      const apiStyles = `
/* API Documentation Styles */
.api-docs-package-badge {
  display: inline-block;
  padding: 0.2rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: bold;
  color: var(--ifm-color-white);
  background-color: var(--ifm-color-primary);
  margin-bottom: 1rem;
}

.api-method-signature {
  margin-bottom: 1rem;
  padding: 0.5rem;
  background-color: var(--ifm-code-background);
  border-radius: 0.25rem;
  overflow-x: auto;
}

/* Parameter tables styling */
.api-docs h3 {
  margin-top: 1.5rem;
}

.api-docs table {
  display: table;
  width: 100%;
}

.api-docs table th:first-child,
.api-docs table td:first-child {
  width: 20%;
  min-width: 150px;
}

.api-docs table th:nth-child(2),
.api-docs table td:nth-child(2) {
  width: 25%;
  min-width: 150px;
}

/* Example code blocks */
.api-docs .tabs {
  margin-top: 1rem;
  margin-bottom: 1rem;
}
`;
      
      cssContent += apiStyles;
      writeFileSync(cssPath, cssContent);
      console.log('Added custom CSS for API documentation');
    }
  } else {
    console.warn('Could not find custom CSS file to update');
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