#!/usr/bin/env bash
set -e

# URLs
GH_BINARY_URL_LINUX_AARCH64="https://github.com/deposure-lab/Client/releases/download/Release/deposure-client-linux-arm64"
GH_BINARY_URL_LINUX_X86="https://github.com/deposure-lab/Client/releases/download/Release/deposure-client-linux-x64"
GH_BINARY_URL_MAC_AARCH64="https://github.com/deposure-lab/Client/releases/download/Release/deposure-client-macos-arm64"
GH_BINARY_URL_MAC_X86="https://github.com/deposure-lab/Client/releases/download/Release/deposure-client-macos-x64"

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux)
        if [[ "$ARCH" == "x86_64" ]]; then
            DOWNLOAD_URL="$GH_BINARY_URL_LINUX_X86"
        elif [[ "$ARCH" == "aarch64" || "$ARCH" == "arm64" ]]; then
            DOWNLOAD_URL="$GH_BINARY_URL_LINUX_AARCH64"
        else
            echo "Unsupported Linux architecture: $ARCH"
            exit 1
        fi
        ;;
    Darwin)
        if [[ "$ARCH" == "x86_64" ]]; then
            DOWNLOAD_URL="$GH_BINARY_URL_MAC_X86"
        elif [[ "$ARCH" == "arm64" ]]; then
            DOWNLOAD_URL="$GH_BINARY_URL_MAC_AARCH64"
        else
            echo "Unsupported macOS architecture: $ARCH"
            exit 1
        fi
        ;;
    *)
        echo "Unsupported OS: $OS"
        exit 1
        ;;
esac

INSTALL_DIR="/etc/deposure/bin"
WRAPPER_PATH="/usr/local/bin/deposure"
BINARY_PATH="$INSTALL_DIR/deposure-bin"

echo "Creating directories (may require sudo)..."
sudo mkdir -p "$INSTALL_DIR"

loading_spinner() {
    local pid=$1
    local spin='|/-\'
    local i=0

    printf "Downloading... "

    while kill -0 "$pid" >/dev/null 2>&1; do
        i=$(( (i+1) %4 ))
        printf "\rDownloading... %s" "${spin:$i:1}"
        sleep 0.1
    done

    printf "\rDownloading... done\n"
}

TEMP_FILE="$(mktemp)"
curl --silent --location "$DOWNLOAD_URL" -o "$TEMP_FILE" &
CURL_PID=$!

loading_spinner "$CURL_PID"

wait "$CURL_PID"

echo "Installing binary..."
sudo mv "$TEMP_FILE" "$BINARY_PATH"
sudo chmod +x "$BINARY_PATH"

echo "Creating global 'deposure' command..."

sudo bash -c "cat > '$WRAPPER_PATH' <<'EOF'
#!/usr/bin/env bash
exec /etc/deposure/bin/deposure-bin "\$@"
EOF"

sudo chmod +x "$WRAPPER_PATH"

echo "Installation complete."
echo "You can now run the Deposure client using:"
echo "  deposure [command]"
