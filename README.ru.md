[🇬🇧 English](README.md) | 🇷🇺 **Русский** | [🇨🇳 中文](README.zh.md)

# CodexSwitcher

Десктопное приложение для переключения между аккаунтами [OpenAI Codex](https://openai.com/index/introducing-codex/). Одна команда — и вы под другим профилем, со своими токенами, лимитами и настройками.

## Возможности

- **OAuth-авторизация** — вход через OpenAI с PKCE, без передачи пароля приложению
- **Несколько аккаунтов** — храните любое количество профилей, переключайтесь в один клик
- **Автообновление токенов** — refresh token используется прозрачно, сессия не протухает
- **Статистика использования** — видно процент исчерпания лимита и время сброса для каждого аккаунта
- **Импорт / экспорт** — аккаунты шифруются (AES-256-GCM) и переносятся между машинами одной строкой
- **Кастомная директория Codex** — можно указать нестандартный путь к `.codex/`
- **MacOS / Windows / Linux** — нативные сборки под все платформы

## Установка

### macOS / Linux

```bash
curl -fsSL https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.sh | sh
```

Или скачать скрипт и запустить вручную:

```bash
curl -fsSLO https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.sh
chmod +x install.sh
./install.sh
```

### Windows (PowerShell)

```powershell
irm https://raw.githubusercontent.com/n1s01/CodexSwitcher/main/install.ps1 | iex
```

### Вручную

Скачайте установщик для вашей платформы со [страницы релизов](https://github.com/n1s01/CodexSwitcher/releases/latest):

| Платформа | Файл |
|-----------|------|
| macOS Apple Silicon | `CodexSwitcher_*_aarch64.dmg` |
| macOS Intel | `CodexSwitcher_*_x64.dmg` |
| Windows | `CodexSwitcher_*_x64-setup.exe` |
| Linux (deb) | `CodexSwitcher_*_amd64.deb` |
| Linux (AppImage) | `CodexSwitcher_*_amd64.AppImage` |
| Linux (rpm) | `CodexSwitcher-*.x86_64.rpm` |

## Разработка

### Требования

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) stable
- [Tauri CLI](https://v2.tauri.app/) (опционально, устанавливается через npm)

### Запуск в dev-режиме

```bash
npm install
npm run tauri dev
```

### Сборка

```bash
npm run tauri build
```

Бинарники появятся в `src-tauri/target/release/bundle/`.

## Архитектура

```
CodexSwitcher/
├── src/                    # React-фронтенд (TypeScript, Vite)
│   ├── app/                # Корень приложения, стили
│   ├── pages/              # Страницы: аккаунты, настройки, домашняя
│   ├── features/           # Feature-based модули (навигация)
│   ├── widgets/            # Переиспользуемые виджеты (сайдбар, тайтлбар)
│   └── shared/             # Общие утилиты: i18n, UI-компоненты, конфиг
├── src-tauri/              # Rust-бэкенд (Tauri v2)
│   └── src/
│       ├── lib.rs          # Tauri-команды, бизнес-логика, OAuth, шифрование
│       └── main.rs         # Точка входа
├── install.sh              # Установщик для macOS / Linux
├── install.ps1             # Установщик для Windows
└── .github/workflows/      # CI/CD
    ├── release.yml         # Сборка под macOS/Win/Linux при пуше в main
    └── version-check.yml   # Блокирует повторный релиз с той же версией
```

### Как работает переключение

При смене аккаунта приложение:

1. Принудительно завершает процесс Codex
2. Очищает runtime-состояние: `auth.json`, `config.toml`, shell-переменные окружения, session storage
3. Записывает токены выбранного аккаунта в `~/.codex/auth.json`
4. Перезапускает Codex

## CI/CD

- **`release.yml`** — при пуше в `main` собирает бинарники под macOS (aarch64 + x86_64), Windows и Linux, создаёт GitHub Release с тегом `v{версия}`
- **`version-check.yml`** — при любом пуше проверяет, что версия в `src-tauri/tauri.conf.json` ещё не была зарелизена. Если тег уже существует — билд блокируется

## Лицензия

MIT
