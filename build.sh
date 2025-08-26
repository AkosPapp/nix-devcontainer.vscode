#!/usr/bin/env bash
set -euo pipefail

# Build script for VS Code extension using Nix
cd "$(dirname "$0")"

echo "Building Nix Devcontainer extension..."

# Use Nix shell to ensure Node.js and npm are available
echo 'Installing dependencies...'
npm install

echo 'Compiling TypeScript...'
npm run compile

echo 'Packaging extension...'
npm run package

echo "Extension built successfully!"
echo "VSIX file: $(ls -1 *.vsix | head -1)"
echo ""
echo "To install: code --install-extension $(ls -1 *.vsix | head -1)"
#code --install-extension $(ls -1 *.vsix | head -1)

