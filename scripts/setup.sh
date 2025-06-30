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
    fi

    # Check if wasm-pack is installed
    if ! command -v wasm-pack &> /dev/null; then
        echo "Installing wasm-pack..."
        curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
    fi
    
    echo "Rust and WASM toolchain setup complete!"
else
    echo "Rust and WASM toolchain already available"
fi

# Always ensure cargo env is sourced for subsequent commands
if [ -f "$HOME/.cargo/env" ]; then
    echo "Sourcing cargo environment..."
    . "$HOME/.cargo/env"
fi

# Export PATH to make tools available system-wide
export PATH="$HOME/.cargo/bin:$PATH"

# Add cargo bin to system PATH permanently for this session
echo "$HOME/.cargo/bin" >> $GITHUB_PATH 2>/dev/null || true

echo "Environment setup complete. PATH: $PATH"