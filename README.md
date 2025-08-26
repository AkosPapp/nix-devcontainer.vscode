# Nix DevContainer Extension

A VS Code extension that provides Nix flake management for development containers. This extension automatically creates shell scripts from the output of `nix print-dev-env` for each devshell, making Nix development environments seamlessly available in your devcontainer.

## Features

- Automatically find Nix flakes in workspace folders
- Create shell scripts from `nix print-dev-env` output for each devshell
- Generate environment scripts in `/etc/profile.d/` for automatic loading
- Update Nix development shell profiles
- Reload window after profile updates
- Support for multiple flakes in a workspace

## Commands

- `Nix DevContainer: Find Flakes` - Discovers all flake.nix files in workspace folders
- `Nix DevContainer: Update Single Flake` - Update a specific flake by name
- `Nix DevContainer: Update All Flakes` - Update all discovered flakes
- `Nix DevContainer: Find and Update All Flakes` - Find and update all flakes in one command

## How it Works

The extension scans workspace folders for `flake.nix` files and creates shell scripts from the output of `nix print-dev-env` for each devshell. These scripts are saved in `/etc/profile.d/nix-devcontainer-{flake-name}.sh` to provide the development environment automatically when opening a terminal. When a flake is updated, you'll be prompted to reload the window to apply the changes.

## Installation

This extension is designed to be used with the Nix DevContainer feature. Add this to your `devcontainer.json`:

```json
{
  "features": {
    "ghcr.io/akospapp/devcontainer-features/nix-devcontainer:latest": {}
  }
}
```

## Requirements

- Nix package manager installed (automatically provided by the devcontainer feature)
- Running in a container or environment with sudo access to `/etc/profile.d/`
- VS Code with workspace folders containing `flake.nix` files

## Usage

### Automatic Usage (Recommended)
1. Add the devcontainer feature to your `devcontainer.json`
2. Open your workspace in a devcontainer
3. The extension will automatically activate and process all flakes
4. Reload the window when prompted to apply environment changes

### Manual Usage
1. Open a workspace containing Nix flakes
2. Use `Ctrl+Shift+P` to open the command palette
3. Run `Nix DevContainer: Find and Update All Flakes` to get started
4. Reload the window when prompted to apply environment changes

## Development

### Building the Extension

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes during development
npm run watch

# Lint the code
npm run lint

# Package the extension
npm run package
```

### Testing the Extension

1. Open this folder in VS Code
2. Press `F5` to run the extension in a new Extension Development Host window
3. Open the Command Palette (`Ctrl+Shift+P`) and try the Nix DevContainer commands

### Installing the Extension

After packaging, you can install the extension using:

```bash
npm run install-extension
```

Or manually install the generated `.vsix` file through VS Code.
