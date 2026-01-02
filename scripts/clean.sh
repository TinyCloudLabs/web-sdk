#!/bin/bash

# Clean each package
packages=(
  "packages/web-sdk"
  "packages/web-core"
  "packages/sdk-core"
  "packages/sdk-rs"
  "packages/node-sdk-wasm"
  "packages/node-sdk"
  "apps/web-sdk-example"
)

for package in "${packages[@]}"; do
  echo "Cleaning $package..."
  rm -rf "$package/node_modules"
  rm -rf "$package/dist"
  rm -rf "$package/temp"
  rm -rf "$package/web-sdk-wasm"
  rm -rf "$package/node-sdk-wasm"
done

# Clean root node_modules
echo "Cleaning root node_modules..."
rm -rf node_modules

echo "Cleaning rust artifacts..."
rm -rf target
