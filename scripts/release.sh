#!/usr/bin/env bash
set -e

# Skip branch checks in CI environment
if [ -z "$CI" ]; then
  # Check if on master branch
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  if [ "$CURRENT_BRANCH" != "master" ]; then
    echo "Error: You must be on the master branch to run this script."
    exit 1
  fi

  # Check if working directory is clean
  if [ -n "$(git status --porcelain)" ]; then
    echo "Error: Working directory is not clean. Commit or stash changes before running this script."
    exit 1
  fi

  # Update to latest master
  echo "Pulling latest changes from master..."
  git pull origin master
fi

# Version and publish changesets
echo "Versioning packages with changesets..."
bun changeset version

# Commit the version changes
echo "Committing version changes..."
git add .
git commit -m "Version packages"

# Build packages
echo "Building packages..."
bun run build

# Create package-specific tags
echo "Creating tags for each package..."
ROOT_DIR=$(pwd)

cd "$ROOT_DIR/packages/web-core"
CORE_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
git tag "web-core-v$CORE_VERSION"

cd "$ROOT_DIR/packages/web-sdk-rs"
SDK_RS_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
git tag "web-sdk-rs-v$SDK_RS_VERSION"

cd "$ROOT_DIR/packages/web-sdk"
SDK_VERSION=$(cat package.json | grep '"version"' | head -1 | awk -F: '{ print $2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
git tag "web-sdk-v$SDK_VERSION"

cd "$ROOT_DIR"

# Setup NPM authentication
echo "Setting up NPM authentication..."
if [ -z "$NPM_TOKEN" ]; then
  echo "ERROR: NPM_TOKEN environment variable is not set"
  exit 1
fi
./scripts/npm-auth.sh

# Switch to npm registry
echo "Switching to npm registry..."
bun run npm-pub

# Publish packages with changesets
echo "Publishing packages..."
bun changeset publish --access public

# Push commits and tags
echo "Pushing commits and tags..."
git push origin master --tags

echo "Release completed successfully!"
echo "The following packages were released:"
echo "- @tinycloudlabs/web-core@$CORE_VERSION"
echo "- @tinycloudlabs/web-sdk-wasm@$SDK_RS_VERSION"
echo "- @tinycloudlabs/web-sdk@$SDK_VERSION"