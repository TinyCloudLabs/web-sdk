#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "Setting up Rust and WASM toolchain..."

# Only run setup if BUILD_SETUP_ENABLED is set or if tools are missing
if [ -n "$BUILD_SETUP_ENABLED" ] || ! command -v rustup &> /dev/null || ! command -v wasm-pack &> /dev/null; then
    # Check if rustup is installed
    if ! command -v rustup &> /dev/null; then
        echo "Installing rustup..."
        curl https://sh.rustup.rs -sSf | sh -s -- -y
        export PATH="$HOME/.cargo/bin:$PATH"
        source $HOME/.cargo/env
    fi

    # Check if wasm-pack is installed
    if ! command -v wasm-pack &> /dev/null; then
        echo "Installing wasm-pack..."
        curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    fi
fi

# Create a cache marker file
mkdir -p .turbo
echo "$(date)" > .turbo/setup-cache

echo "Rust and WASM toolchain setup complete!"