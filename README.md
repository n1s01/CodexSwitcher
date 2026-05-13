🇬🇧 **English** | [🇷🇺 Русский](README.ru.md) | [🇨🇳 中文](README.zh.md)

# CodexSwitcher

A desktop app for switching between [OpenAI Codex](https://openai.com/index/introducing-codex/) accounts. One click — and you're on a different profile, with its own tokens, limits, and settings.

## Features

- **OAuth login** — sign in via OpenAI with PKCE, no password shared with the app
- **Multiple accounts** — store as many profiles as you need, switch in one click
- **Auto token refresh** — refresh tokens are used transparently, sessions don't expire
- **Usage stats** — see limit usage percentage and reset time for each account
- **Import / export** — accounts are encrypted (AES-256-GCM) and transferred between machines as a single string
- **Custom Codex directory** — point to a non-default `.codex/` path
- **macOS / Windows / Linux** — native builds for all platforms

## Install

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.sh | sh
```

Or download and run manually:

```bash
curl -fsSLO https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.sh
chmod +x install.sh
./install.sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.ps1 | iex
```

### Manual download

Grab the installer for your platform from the [latest release](https://github.com/n1s01/CodexSwitcher/releases/latest):

| Platform | File |
|----------|------|
| macOS Apple Silicon | `CodexSwitcher_*_aarch64.dmg` |
| macOS Intel | `CodexSwitcher_*_x64.dmg` |
| Windows | `CodexSwitcher_*_x64-setup.exe` |
| Linux (deb) | `CodexSwitcher_*_amd64.deb` |
| Linux (AppImage) | `CodexSwitcher_*_amd64.AppImage` |
| Linux (rpm) | `CodexSwitcher-*.x86_64.rpm` |

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- [Tauri CLI](https://v2.tauri.app/) (optional, installed via npm)

### Dev mode

```bash
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Binaries land in `src-tauri/target/release/bundle/`.

## Architecture

```
CodexSwitcher/
├── src/                    # React frontend (TypeScript, Vite)
│   ├── app/                # App root, global styles
│   ├── pages/              # Pages: accounts, settings, home
│   ├── features/           # Feature-based modules (navigation)
│   ├── widgets/            # Reusable widgets (sidebar, titlebar)
│   └── shared/             # Shared utils: i18n, UI components, config
├── src-tauri/              # Rust backend (Tauri v2)
│   └── src/
│       ├── lib.rs          # Tauri commands, business logic, OAuth, crypto
│       └── main.rs         # Entry point
├── install.sh              # macOS / Linux installer
├── install.ps1             # Windows installer
└── .github/workflows/      # CI/CD
    ├── release.yml         # Build for macOS/Win/Linux on push to main
    └── version-check.yml   # Blocks re-release of an existing version
```

### How switching works

When you switch accounts, the app:

1. Force-stops the Codex process
2. Cleans up runtime state: `auth.json`, `config.toml`, shell env vars, session storage
3. Writes the selected account's tokens to `~/.codex/auth.json`
4. Restarts Codex

## CI/CD

- **`release.yml`** — on push to `main`: builds binaries for macOS (aarch64 + x86_64), Windows, and Linux, creates a GitHub Release tagged `v{version}`
- **`version-check.yml`** — on every push: verifies the version in `src-tauri/tauri.conf.json` hasn't been released yet. Blocks the push if the tag already exists.

## License

MIT
