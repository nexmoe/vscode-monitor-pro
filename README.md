[github-shield]: https://img.shields.io/github/stars/nexmoe/vscode-monitor-pro?style=social
[github-url]: https://github.com/nexmoe/vscode-monitor-pro
[vscode-shield]: https://img.shields.io/visual-studio-marketplace/r/nexmoe.monitor-pro?logo=visual-studio-code&style=social
[vscode-url]: https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro

[![Github Repo][github-shield]][github-url]
[![VSCode Plugin][vscode-shield]][vscode-url]
![Visual Studio Marketplace Downloads](https://img.shields.io/visual-studio-marketplace/d/nexmoe.monitor-pro?logo=visual-studio-code&style=social)
![Visual Studio Marketplace Installs](https://img.shields.io/visual-studio-marketplace/i/nexmoe.monitor-pro?logo=visual-studio-code&style=social)

# Monitor Pro

English | [简体中文](./README_ZH.md)

Monitor Pro is a comprehensive resource monitoring tool for VS Code that tracks system metrics in real-time. It features a **hybrid architecture**: a native Go + gopsutil backend on Windows for maximum performance, and a built-in Node.js (`systeminformation`) fallback on other platforms.

## Architecture & Performance

| Platform | Backend | Data Source |
|----------|---------|-------------|
| Windows | Go + gopsutil | Raw OS APIs via native binary |
| Linux / macOS | Node.js | `systeminformation` library |

### Windows Performance

On Windows, the extension spawns a lightweight Go binary (`monitor.exe`) that reads system data directly via [gopsutil](https://github.com/shirou/gopsutil). This eliminates the overhead of PowerShell/WMI queries that the Node.js `systeminformation` library relies on, resulting in **10x+ faster data collection** — typical poll cycles drop from ~200ms to under 20ms.

The Go backend communicates with the extension over HTTP (localhost) using a raw JSON protocol. If the Go binary is unavailable or fails to start, the extension automatically falls back to the `systeminformation` data source.

## Features

- [x] **CPU Usage** — Overall utilization percentage
- [x] **CPU Frequency** — Current, average, min, and max frequency
- [x] **CPU Temperature** — Main and per-core temperatures
- [x] **Memory Usage** — Active, used, free, available, buffer/cache
- [x] **Network Usage** — Per-interface receive/transmit rates
- [x] **Disk Usage** — Per-mountpoint space and I/O rates
- [x] **Battery Status** — Percentage, charging state, remaining time
- [x] **OS Distro** — Operating system and platform info
- [x] **Uptime** — System uptime
- [ ] **High Occupancy Alerts** _(planned)_
- [ ] **Dashboard with Charts** _(planned)_

### Customization

- [x] **Order** — Reorder metrics displayed in the status bar
- [x] **Refresh Interval** — Configurable polling interval (default: 2000ms)
- [x] **No Layout Shift** — Stable status bar widths
- [x] **Remote SSH** — Monitor remote servers via VS Code Remote SSH
- [x] **Multi-language** — English, 简体中文, 繁體中文, 日本語

## Screenshots

![Screenshot 0](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot0.png)
![Screenshot 1](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot1.png)
![Screenshot 2](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot2.png)

## Requirements

- VS Code 1.104+
- Windows 10/11 (for Go backend; Linux/macOS use built-in fallback)

## Developing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

### Quick Start

```bash
pnpm install
pnpm run compile
```

### Commands

| Command | Description |
|---------|-------------|
| `pnpm run lint` | Lint TypeScript sources |
| `pnpm run go:test` | Run Go backend tests |
| `pnpm run go:vet` | Run Go vet |
| `pnpm run go:build:win32-x64` | Cross-compile Go binary for Windows x64 |
| `pnpm run go:build:win32-arm64` | Cross-compile Go binary for Windows ARM64 |
| `pnpm run package:vsix:universal` | Package universal VSIX (macOS/Linux) |
| `pnpm run package:vsix:win32-x64` | Package Windows x64 VSIX |
| `pnpm run package:vsix:win32-arm64` | Package Windows ARM64 VSIX |
| `pnpm run gen-l10n` | Regenerate l10n bundle from source |

## Inspired by

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

## Feedback

Issues and feature requests: [github.com/nexmoe/vscode-monitor-pro/issues](https://github.com/nexmoe/vscode-monitor-pro/issues)

## Support

Please give a star on [GitHub](https://github.com/nexmoe/vscode-monitor-pro) or leave a review on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details)!
