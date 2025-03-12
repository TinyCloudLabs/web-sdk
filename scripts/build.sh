#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

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
