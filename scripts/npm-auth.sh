#!/usr/bin/env bash
set -e

# This script creates proper .npmrc files with authentication
# It should be called before publishing packages

# Check for NPM_TOKEN
if [ -z "$NPM_TOKEN" ]; then
  echo "ERROR: NPM_TOKEN environment variable is not set"
  exit 1
fi

# Create ~/.npmrc with proper format
echo "Creating ~/.npmrc file..."
echo "registry=https://registry.npmjs.org/" > ~/.npmrc
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> ~/.npmrc
echo "always-auth=true" >> ~/.npmrc

# Create root .npmrc as well
echo "Creating project root .npmrc file..."
echo "registry=https://registry.npmjs.org/" > .npmrc
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> .npmrc
echo "always-auth=true" >> .npmrc

# Also create .npmrc in each package directory
echo "Creating package-specific .npmrc files..."
mkdir -p packages/web-core
echo "registry=https://registry.npmjs.org/" > packages/web-core/.npmrc
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> packages/web-core/.npmrc
echo "always-auth=true" >> packages/web-core/.npmrc

mkdir -p packages/sdk-rs
echo "registry=https://registry.npmjs.org/" > packages/sdk-rs/.npmrc
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> packages/sdk-rs/.npmrc
echo "always-auth=true" >> packages/sdk-rs/.npmrc

mkdir -p packages/web-sdk
echo "registry=https://registry.npmjs.org/" > packages/web-sdk/.npmrc
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> packages/web-sdk/.npmrc
echo "always-auth=true" >> packages/web-sdk/.npmrc

# Verify npm auth works
if command -v npm &> /dev/null; then
  echo "Verifying npm authentication..."
  npm whoami || echo "Warning: npm authentication failed, but continuing anyway"
fi

echo "NPM authentication setup complete"