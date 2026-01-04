#!/usr/bin/env bash
set -e

echo "Deposure Uninstaller"
echo "---------------------"

INSTALL_DIR="/etc/deposure/bin"
PARENT_DIR="/etc/deposure"
WRAPPER_PATH="/usr/local/bin/deposure"
BINARY_PATH="$INSTALL_DIR/deposure-bin"

echo "Stopping Deposure services (if any)..."
if command -v deposure >/dev/null 2>&1; then
    sudo deposure stop >/dev/null 2>&1 || true
fi

echo "Removing Deposure binary..."
if [ -f "$BINARY_PATH" ]; then
    sudo rm -f "$BINARY_PATH"
    echo "Removed: $BINARY_PATH"
else
    echo "Binary not found."
fi

echo "Removing Deposure bin directory..."
if [ -d "$INSTALL_DIR" ]; then
    sudo rm -rf "$INSTALL_DIR"
    echo "Removed: $INSTALL_DIR"
else
    echo "Directory not found."
fi

echo "Removing top-level /etc/deposure if empty..."
if [ -d "$PARENT_DIR" ]; then
    sudo rmdir "$PARENT_DIR" 2>/dev/null || true
fi

echo "Removing CLI wrapper..."
if [ -f "$WRAPPER_PATH" ]; then
    sudo rm -f "$WRAPPER_PATH"
    echo "Removed: $WRAPPER_PATH"
else
    echo "CLI wrapper not found."
fi

echo "Cleanup complete!"
echo "Deposure is fully uninstalled."
