#!/usr/bin/env bash
set -euo pipefail

REPO="n1s01/CodexSwitcher"
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { printf "${CYAN}%s${NC}\n" "$*"; }
ok()    { printf "${GREEN}%s${NC}\n" "$*"; }
err()   { printf "${RED}%s${NC}\n" "$*" >&2; }

# --- detect OS / arch ---
OS=$(uname -s)
ARCH=$(uname -m)

if [ "$OS" = "Darwin" ]; then
    case "$ARCH" in
        arm64|aarch64) ASSET_SUFFIX="_aarch64.app.tar.gz" ;;
        x86_64)        ASSET_SUFFIX="_x64.app.tar.gz" ;;
        *) err "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
elif [ "$OS" = "Linux" ]; then
    if [ -f /etc/debian_version ]; then
        PKG_TYPE="deb"
    elif [ -f /etc/redhat-release ] || [ -f /etc/fedora-release ]; then
        PKG_TYPE="rpm"
    else
        PKG_TYPE="appimage"
    fi
    case "$ARCH" in
        x86_64|amd64) ASSET_SUFFIX="_amd64.${PKG_TYPE}" ;;
        aarch64|arm64)
            # No native aarch64 Linux build — try AppImage or warn
            if [ "$PKG_TYPE" = "appimage" ]; then
                ASSET_SUFFIX="_amd64.AppImage"
            else
                err "No native aarch64 build for Linux. Try the amd64 .AppImage with box64."
                exit 1
            fi
            ;;
        *) err "Unsupported architecture: $ARCH"; exit 1 ;;
    esac
else
    err "Unsupported OS: $OS"
    exit 1
fi

info "==> CodexSwitcher installer"
info "    OS: $OS  Arch: $ARCH"

# --- fetch latest release ---
info "--> Fetching latest release info..."
RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest") || {
    err "Failed to fetch release info from GitHub"
    exit 1
}
TAG=$(echo "$RELEASE_JSON" | grep -o '"tag_name": *"[^"]*"' | head -1 | sed 's/.*"\(.*\)"/\1/')

# Find asset URL matching suffix pattern
ASSET_URL=$(echo "$RELEASE_JSON" | grep -o "\"browser_download_url\": *\"[^\"]*${ASSET_SUFFIX}\"" | head -1 | sed 's/.*"\(https:[^"]*\)"/\1/')

# Linux: if exact match failed, try without version (e.g., AppImage without version)
if [ -z "$ASSET_URL" ] && [ "$OS" = "Linux" ]; then
    BASE_SUFFIX="${ASSET_SUFFIX#_*_}"  # strip _0.1.0_ prefix pattern
    ASSET_URL=$(echo "$RELEASE_JSON" | grep -o "\"browser_download_url\": *\"[^\"]*${BASE_SUFFIX}\"" | head -1 | sed 's/.*"\(https:[^"]*\)"/\1/')
fi

if [ -z "$ASSET_URL" ]; then
    err "No matching asset found for $OS/$ARCH (suffix: $ASSET_SUFFIX)"
    err "Available assets:"
    echo "$RELEASE_JSON" | grep -o '"name": *"[^"]*"' | sed 's/"name": *"\(.*\)"/  \1/'
    exit 1
fi

ASSET_NAME=$(basename "$ASSET_URL")
info "--> Latest: $TAG → $ASSET_NAME"

# --- download ---
info "--> Downloading $ASSET_NAME ..."
curl -fsSL -o "$TMP_DIR/$ASSET_NAME" "$ASSET_URL" || {
    err "Download failed"
    exit 1
}

# --- install ---
if [ "$OS" = "Darwin" ]; then
    info "--> Extracting .app..."
    tar xzf "$TMP_DIR/$ASSET_NAME" -C "$TMP_DIR"
    APP_BUNDLE=$(find "$TMP_DIR" -name "*.app" -maxdepth 2 | head -1)
    if [ -z "$APP_BUNDLE" ]; then
        err "No .app bundle found in archive"
        exit 1
    fi

    APP_NAME=$(basename "$APP_BUNDLE")
    DEST="/Applications/$APP_NAME"

    if [ -d "$DEST" ]; then
        info "--> Removing previous version..."
        rm -rf "$DEST"
    fi

    info "--> Installing to /Applications/$APP_NAME ..."
    cp -R "$APP_BUNDLE" /Applications/

    # Remove quarantine attribute
    xattr -dr com.apple.quarantine "$DEST" 2>/dev/null || true

    ok "✓ Installed to $DEST"
    ok "✓ Run: open /Applications/$APP_NAME"

elif [ "$OS" = "Linux" ]; then
    case "$PKG_TYPE" in
        deb)
            info "--> Installing .deb package (sudo required)..."
            sudo dpkg -i "$TMP_DIR/$ASSET_NAME" || {
                info "--> Fixing dependencies..."
                sudo apt-get install -f -y
            }
            ok "✓ Installed. Run: codex-switcher"
            ;;
        rpm)
            info "--> Installing .rpm package (sudo required)..."
            sudo rpm -i "$TMP_DIR/$ASSET_NAME" 2>/dev/null || \
                sudo dnf install -y "$TMP_DIR/$ASSET_NAME" 2>/dev/null || \
                sudo yum install -y "$TMP_DIR/$ASSET_NAME"
            ok "✓ Installed. Run: codex-switcher"
            ;;
        appimage)
            DEST_DIR="$HOME/.local/bin"
            mkdir -p "$DEST_DIR"
            DEST="$DEST_DIR/codex-switcher"
            info "--> Installing AppImage to $DEST ..."
            cp "$TMP_DIR/$ASSET_NAME" "$DEST"
            chmod +x "$DEST"

            # Add to PATH if needed
            if ! echo "$PATH" | grep -q "$DEST_DIR"; then
                info "    Add $DEST_DIR to your PATH:"
                info "    echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
            fi
            ok "✓ Installed to $DEST"
            ok "✓ Run: codex-switcher"
            ;;
    esac
fi

ok "Done!"
