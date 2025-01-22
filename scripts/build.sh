#!/bin/bash

# Build packages in order
echo "Building packages..."

# Build web-sdk-rs (WASM) first
echo "Building web-sdk-rs..."
cd packages/web-sdk-rs
bun run build
bun run bundle
cd ../..

# Build web-core
echo "Building web-core..."
cd packages/web-core
bun run build
cd ../..

# Build web-sdk
echo "Building web-sdk..."
cd packages/web-sdk
bun run build
cd ../..

# Build example app
echo "Building example app..."
cd examples/react-test-app
bun run build
cd ../..

echo "Build complete!"
