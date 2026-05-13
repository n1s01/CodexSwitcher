[🇬🇧 English](README.md) | [🇷🇺 Русский](README.ru.md) | 🇨🇳 **中文**

# CodexSwitcher

一款用于切换 [OpenAI Codex](https://openai.com/index/introducing-codex/) 账户的桌面应用。一键切换不同 Profile，各自拥有独立的 Token、配额与设置。

## 功能

- **OAuth 登录** — 通过 OpenAI 的 PKCE 流程登录，应用不接触密码
- **多账户管理** — 存储任意数量的 Profile，一键切换
- **Token 自动刷新** — 自动使用 Refresh Token，会话不会过期
- **用量统计** — 查看每个账户的配额使用百分比和重置时间
- **导入 / 导出** — 账户数据经 AES-256-GCM 加密，用一行字符串即可跨设备迁移
- **自定义 Codex 目录** — 可指定非默认的 `.codex/` 路径
- **macOS / Windows / Linux** — 全平台原生构建

## 安装

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.sh | sh
```

或手动下载运行：

```bash
curl -fsSLO https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.sh
chmod +x install.sh
./install.sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.ps1 | iex
```

### 手动下载

从 [最新发布页](https://github.com/n1s01/CodexSwitcher/releases/latest) 下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| macOS Apple Silicon | `CodexSwitcher_*_aarch64.dmg` |
| macOS Intel | `CodexSwitcher_*_x64.dmg` |
| Windows | `CodexSwitcher_*_x64-setup.exe` |
| Linux (deb) | `CodexSwitcher_*_amd64.deb` |
| Linux (AppImage) | `CodexSwitcher_*_amd64.AppImage` |
| Linux (rpm) | `CodexSwitcher-*.x86_64.rpm` |

## 开发

### 环境要求

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- [Tauri CLI](https://v2.tauri.app/)（可选，通过 npm 安装）

### 开发模式

```bash
npm install
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

## 架构

```
CodexSwitcher/
├── src/                    # React 前端 (TypeScript, Vite)
│   ├── app/                # 应用入口、全局样式
│   ├── pages/              # 页面：账户、设置、主页
│   ├── features/           # 功能模块（导航）
│   ├── widgets/            # 可复用组件（侧边栏、标题栏）
│   └── shared/             # 公共工具：i18n、UI 组件、配置
├── src-tauri/              # Rust 后端 (Tauri v2)
│   └── src/
│       ├── lib.rs          # Tauri 命令、业务逻辑、OAuth、加密
│       └── main.rs         # 入口点
├── install.sh              # macOS / Linux 安装脚本
├── install.ps1             # Windows 安装脚本
└── .github/workflows/      # CI/CD
    ├── release.yml         # 推送到 main 时构建 macOS/Win/Linux 并发布
    └── version-check.yml   # 阻止重复发布已存在的版本
```

### 切换原理

切换账户时，应用会：

1. 强制停止 Codex 进程
2. 清理运行时状态：`auth.json`、`config.toml`、Shell 环境变量、Session Storage
3. 将所选账户的 Token 写入 `~/.codex/auth.json`
4. 重启 Codex

## CI/CD

- **`release.yml`** — 推送到 `main` 时：构建 macOS (aarch64 + x86_64)、Windows 和 Linux 的二进制文件，并创建标签为 `v{version}` 的 GitHub Release
- **`version-check.yml`** — 每次推送时：验证 `src-tauri/tauri.conf.json` 中的版本号尚未发布。如果标签已存在则阻止构建。

## 许可证

MIT
