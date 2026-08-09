# Monitor Pro

[github-shield]: https://img.shields.io/github/stars/nexmoe/vscode-monitor-pro?style=social
[github-url]: https://github.com/nexmoe/vscode-monitor-pro

[![Github Repo][github-shield]][github-url]

[vscode-url]: https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro

[![VSCode Installs](https://img.shields.io/badge/install-20k+-green?logo=visual-studio-code)][vscode-url]

English | [简体中文](./README_zh-cn.md) | [繁體中文](./README_zh-tw.md) | [日本語](./README_ja.md)

Monitor Pro is a real-time system resource monitoring tool that works directly in the VS Code status bar and a dedicated Webview panel. From the very beginning, the plugin was designed with cross-platform and remote development machine performance monitoring in mind, with full implementations on local systems, Remote SSH, and WSL.

A **hybrid architecture** delivers the best of both worlds: a native Go binary on Windows bypasses PowerShell/WMI overhead for over 10x faster data collection compared to `systeminformation`; macOS Apple Silicon machines use [mactop](https://github.com/metaspartan/mactop) (when installed) for SoC-level metrics (CPU/GPU/ANE power, temperature) via a Prometheus HTTP endpoint; Linux and macOS without mactop fall back to the Node.js (`systeminformation`) data source, ensuring full platform compatibility.

> [!WARNING]
>
> **Breaking Change 0.7.0**
>
> The status bar now defaults to only CPU, Memory Active, and Battery. Other metrics (Network, CPU Temperature, CPU Speed, Uptime, Disk I/O, Disk Space, OS Distro) must be manually enabled in VSCode settings under `monitor-pro.metrics.*`.
>
> Rationale: with the new Resource Usage webview, most metrics are better visualized in their dedicated panel. Keeping the status bar lean avoids clutter for new users.

## 0.7.0 Major Update Overview

Side panel monitoring view:

![Side panel monitoring view](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image.png)

CPU speed, Disk and other info:

![CPU speed, Disk and other info](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-1.png)

Auxiliary panel fullscreen view:

![Auxiliary panel fullscreen view](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-2.png)

Main panel view:

![Main panel view](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-3.png)

Bottom panel sidebar view:

![Bottom panel sidebar view](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-4.png)

Theme adaptive — Dark:

![Theme adaptive — Dark](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-5.png)

Bar chart demo:

![Bar chart demo](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-6.png)

l10n — Japanese source:

![l10n — Japanese source](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-7.png)

l10n — Chinese, battery level, health and power:

![l10n — Chinese, battery level, health and power](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-8.png)

Discharge and charge chart transition:

![Discharge and charge chart transition](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-9.png)

## Features

### Status Bar

14 individually toggleable metrics shown as status bar items with Codicon icons:

| Metric          | Default | Icon                                | Example                 |
| --------------- | ------- | ----------------------------------- | ----------------------- |
| CPU             | on      | `$(chip)`                           | `73.2%`                 |
| Memory Active   | on      | `$(pie-chart)`                      | `4.21 / 15.6 GiB`       |
| Battery         | on      | `$(plug)`                           | `85.2% (Charging)`      |
| Memory Used     | off     | `$(pie-chart)`                      | `8.15 / 15.6 GiB`       |
| Network         | off     | `$(cloud-download) $(cloud-upload)` | `125 KiB/s 2.34 MiB/s`  |
| CPU Temperature | off     | `$(flame)`                          | `52.3°C`                |
| CPU Speed       | off     | `$(dashboard)`                      | `3.81 GHz`              |
| GPU             | off     | `$(circuit-board)`                   | `73.2%`                 |
| GPU Temperature | off     | `$(lightbulb-sparkle)`               | `52.3°C`                |
| GPU Memory      | off     | `$(layers)`                          | `11.2 / 24 GiB`         |
| Uptime          | off     | `$(clock)`                          | `2d 14h 32m`            |
| Disk I/O        | off     | `$(log-in) $(log-out)`              | `50.2 MiB/s 12.1 MiB/s` |
| Disk Space      | off     | `$(database)`                       | `/ 45.2% 120/256 GiB`   |
| OS Distro       | off     | —                                   | `Ubuntu 22.04`          |

> GPU metrics require NVIDIA hardware with `nvidia-smi`; they hide automatically otherwise.

### Resource Usage Webview

A dedicated side panel with live line/bar charts for 14 metrics: CPU, Memory (Active/Used), Network (Down/Up), Disk (Read/Write), Battery, Battery Power / SoC Power, CPU Temperature, CPU Speed, GPU, GPU Temperature, GPU Memory. On macOS Apple Silicon with the mactop backend, the power chart switches to SoC Power mode, showing total chip power consumption (CPU + GPU + ANE).

Each chart features:

- Live 2D canvas rendering with gradient fill and Bezier curves
- Auto-scaling Y-axis; the current scale maximum is labeled with an `↑` prefix
- Toggle between line and bar view
- **Per-core / per-card array view**: CPU Usage, CPU Temperature, GPU, GPU Temperature, and GPU Memory cards can switch to a grid of colored bars — one per CPU core (`C0`, `C1`, …) or per GPU (`G0`, `G1`, …) — showing each item's utilization / temperature / memory. Hovering a GPU cell reveals the card model (and used/total memory for the GPU Memory view).
- Subtitle: battery health, charge/discharge state, temperature min, speed range
- 10–500 configurable history points

GPU charts are enabled by default and automatically hidden on machines without NVIDIA hardware (`nvidia-smi`).

A lower **Info** section displays uptime, OS distro, and disk space with colored progress bars. These cards are part of the `resourceUsage.charts` configuration and can be toggled via `charts.osDistro.enabled` / `charts.uptime.enabled` / `charts.diskSpace.enabled` (enabled by default).

### On-Demand Querying

Disabled metrics are **never queried** — collection is driven entirely by what is enabled. The actual data source call (`systeminformation` on macOS/Linux, the Go backend on Windows) only fetches the dimensions currently in use:

- Status bar `monitor-pro.metrics.*` toggles and webview `resourceUsage.charts.*.enabled` are merged into a single enabled set.
- Unused `SI.*` calls and unused Go collection groups (CPU / Memory / Disk / Network / Host / Battery) are skipped entirely, not fetched-and-filtered.
- This keeps the refresh cycle lightweight when only a few metrics are shown. Change any toggle and collection adapts on the next tick via hot-reload.

### Battery / SoC Power Monitoring

Monitor Pro reports real-time power consumption in watts across two modes:

- **Windows**: Battery net power (positive for charging, negative for discharging) via the native Go backend.
- **macOS Apple Silicon**: Total SoC power (CPU + GPU + ANE) via the mactop backend, shown as a non-negative value. Also includes battery health and time remaining from `pmset`.

- **Signed values**: positive for charging, negative for discharging
- **Zero reference**: a dashed guideline always marks 0W
- **5-sample moving average** for stable readings
- **Health percentage**: ratio of current full capacity to design capacity
- **State detection**: Charging / Discharging / Idle

### Formatting Consistency

All formatted values (%, W, °C, GHz, byte rates) uniformly respect three configuration options:

- `showSpace`: whether to insert a space between number and unit
- `singleUnit`: abbreviate units to first letter (K, M, G)
- `significantDigits`: per-metric significant digits

These settings apply to the status bar and webview alike.

### CPU Performance

- **Windows**: Uses the same PDH counters as Task Manager (`% Processor Utility`) for accurate CPU readings. CPU frequency is read dynamically via `% Processor Performance` — reflects actual turbo boost and power-saving states in real time.
- **Linux**: Non-blocking delta-based calculation from `/proc/stat` with cached initial values — 30x faster than traditional blocking approaches.

### Cross-Platform

- Works in local, Remote SSH, and WSL environments
- Go binary for Windows (native performance); mactop for macOS Apple Silicon (SoC metrics); transparent fallback to Node.js on all platforms
- Multi-language: English, 简体中文, 繁體中文, 日本語

## Configuration

Settings are grouped under `monitor-pro.*` and apply instantly via hot-reload.

| Setting                                     | Default       | Description                                   |
| ------------------------------------------- | ------------- | --------------------------------------------- |
| `monitor-pro.metrics.*`                     | varies        | Toggle each status bar metric on/off          |
| `monitor-pro.metricsOrder`                  | —             | Reorder status bar items                      |
| `monitor-pro.refresh-interval`              | `2000` ms     | Polling interval (500–30000ms)                |
| `monitor-pro.unitSystem`                    | `binary`      | `binary` (KiB/MiB) or `decimal` (kB/MB)       |
| `monitor-pro.showSpace`                     | `false`       | Space between number and unit                 |
| `monitor-pro.singleUnit`                    | `false`       | Abbreviate unit to first letter (K, M, G)     |
| `monitor-pro.significantDigits`             | per-metric    | Significant digits (1–6) per metric           |
| `monitor-pro.uptimeFormat`                  | `auto`        | Custom format with `{d}`, `{h}`, `{m}`, `{s}` |
| `monitor-pro.resourceUsage.charts`          | —             | Chart/card enable/view/color per metric (incl. `osDistro`, `uptime`, `diskSpace`) |
| `monitor-pro.resourceUsage.samplingPoints`  | `60`          | Chart history length (10–500)                 |
| `monitor-pro.resourceUsage.diskSpaceMounts` | `["all"]`     | Mount filter for disk space card              |
| `monitor-pro.diskSpace`                     | `["/", "C:"]` | Mount filter for status bar                   |

## Screenshots (pre-0.6.0, still compatible with the current version)

![Screenshot 0](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot0.png)
![Screenshot 1](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot1.png)
![Screenshot 2](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot2.png)

## Requirements

- VS Code 1.104+
- Windows 10/11 (for native Go backend; Linux/macOS use built-in fallback)
- macOS 12+ Apple Silicon (optional): [mactop](https://github.com/metaspartan/mactop) via Homebrew (v2.1.4+) for SoC metrics (`brew install mactop`). When missing, the extension prompts once on first run offering to auto-install it (suppressible via the `monitor-pro.mactop.enabled` setting)

## Developing

See [CONTRIBUTING.md](./CONTRIBUTING.md)

### Quick Start

```bash
pnpm install
pnpm run compile
```

### Commands

| Command                             | Description                               |
| ----------------------------------- | ----------------------------------------- |
| `pnpm run lint`                     | Lint TypeScript sources                   |
| `pnpm run go:test`                  | Run Go backend tests                      |
| `pnpm run go:vet`                   | Run Go vet                                |
| `pnpm run go:build:win32-x64`       | Cross-compile Go binary for Windows x64   |
| `pnpm run go:build:win32-arm64`     | Cross-compile Go binary for Windows ARM64 |
| `pnpm run package:vsix:universal`   | Package universal VSIX (macOS/Linux)      |
| `pnpm run package:vsix:win32-x64`   | Package Windows x64 VSIX                  |
| `pnpm run package:vsix:win32-arm64` | Package Windows ARM64 VSIX                |
| `pnpm run gen-l10n`                 | Regenerate l10n bundle from source        |

## Inspiration & Acknowledgments

### Inspiration

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

### Acknowledgments

- [TrafficMonitor](https://github.com/zhongyang219/TrafficMonitor): Adopted its PDH query lifecycle pattern (persistent handle + baseline collection + single collection per tick) for the Windows Go backend CPU monitoring, ensuring readings match Task Manager exactly.

## Feedback

Issues and feature requests: [github.com/nexmoe/vscode-monitor-pro/issues](https://github.com/nexmoe/vscode-monitor-pro/issues)

## Support

Please give a star on [GitHub](https://github.com/nexmoe/vscode-monitor-pro) or leave a review on [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details)!
