#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

#!/usr/bin/env bash

# Ensure SSH directory exists
mkdir -p ~/.ssh

# Add GitHub's SSH public key to known_hosts only if it doesn't exist
if [ ! -f ~/.ssh/known_hosts ] || ! grep -q "github.com" ~/.ssh/known_hosts; then
    echo "Adding GitHub's SSH public key to known_hosts..."
    ssh-keyscan github.com >> ~/.ssh/known_hosts
fi

# Check if rustup is installed
if ! command -v rustup &> /dev/null; then
    echo "Installing rustup..."
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    export PATH="$HOME/.cargo/bin:$PATH"
fi


# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo "Installing wasm-pack..."
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

# Build packages in order
echo "Building packages..."

# Build web-sdk-rs (WASM) first
echo "Building web-sdk-rs..."
cd packages/web-sdk-rs
bun run build || { echo "Failed to build web-sdk-rs"; exit 1; }
bun run bundle || { echo "Failed to bundle web-sdk-rs"; exit 1; }
cd ../..

# Build web-core
echo "Building web-core..."
cd packages/web-core
bun run build || { echo "Failed to build web-core"; exit 1; }
cd ../..

# Build web-sdk
echo "Building web-sdk..."
cd packages/web-sdk
bun run build || { echo "Failed to build web-sdk"; exit 1; }
cd ../..

# Build example app
echo "Building example app..."
cd examples/web-sdk-example
bun run build || { echo "Failed to build example app"; exit 1; }
cd ../..

echo "Build complete!"
