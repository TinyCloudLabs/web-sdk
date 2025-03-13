#!/bin/bash

# Clean each package
packages=(
  "packages/web-sdk"
  "packages/web-core"
  "packages/web-sdk-rs"
  "examples/web-sdk-example"
)

for package in "${packages[@]}"; do
  echo "Cleaning $package..."
  rm -rf "$package/node_modules"
  rm -rf "$package/dist"
  rm -rf "$package/temp"
done

# Clean root node_modules
echo "Cleaning root node_modules..."
rm -rf node_modules
