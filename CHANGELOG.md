# Change Log

All notable changes to the "Monitor Pro" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.7.2] - 2025-05-22

### Fixed

- **Windows CPU readings inflated**: Go backend's PDH query issued two back-to-back `PdhCollectQueryData` calls without an interval, producing garbage values for rate-based counters. Replaced with a persistent query handle matching [TrafficMonitor](https://github.com/zhongyang219/TrafficMonitor)'s pattern — baseline collection at init + single collection per tick — so readings now match Task Manager exactly. (Fixes [#5](https://github.com/nexmoe/vscode-monitor-pro/issues/5))

## [0.7.0] - 2025-05-21

### Breaking Changes

- **Status bar defaults reduced dramatically.** Only CPU, Memory Active, and Battery remain enabled by default. All other metrics — Network, CPU Temperature, CPU Speed, Uptime, Disk I/O, Disk Space, OS Distro — are now opt-in via `monitor-pro.metrics.*`. This keeps the default status bar clean and avoids redundancy with the newly added Resource Usage webview.

### Added

- **Resource Usage webview**: Dedicated side panel with 11 live line/bar charts, info cards, and per-metric configuration.
- **Native Go backend for Windows**: Spawns a native Go binary for direct OS API access via gopsutil, bypassing PowerShell/WMI. 10×+ faster data collection.
- **Battery power monitoring**: Signed watt display (+/- W) with 5-sample moving average, zero reference line, health percentage, and charge/discharge state detection.
- **PDH-based CPU percent (Windows)**: Uses the same counter as Task Manager (`% Processor Utility`) — non-blocking, instant results.
- **Non-blocking CPU percent (Linux)**: Delta-based calculation from `/proc/stat` with pre-seeded cache — 30× faster than traditional blocking approaches.
- **Dynamic CPU frequency (Windows)**: Reads `% Processor Performance` via PDH for live turbo boost and power-saving state visibility.
- **Full localization**: English, 简体中文, 繁體中文, 日本語 (68+ keys).
- **Independent info section config**: `showUptime` / `showOsDistro` toggle independently of status bar settings.
- **Configuration hot-reload**: React to config changes without extension restart.
- **Cross-platform VSIX packaging**: Platform-specific packages for universal, Windows x64, and Windows ARM64.

### Changed

- **Formatting consistency**: All formatted values (%, W, °C, GHz, byte rates) now consistently respect `showSpace`, `singleUnit`, and `significantDigits` across both status bar and webview.
- **CPU utilization**: Go backend returns overall (multi-core average) instead of per-core percentage.
- **CPU frequency subtitle**: Shows "Min / Max" only when min < max; single value otherwise (avoids redundancy on Windows where all cores share the same PDH value).
- **Build system**: Migrated from webpack to esbuild for faster compilation.

## [0.2.0] - 2023-10-05

### Added

- [feat: add support for all Intl.NumberFormat() constructor](https://github.com/nexmoe/vscode-monitor-pro/commit/c7b576735412df620fc23f20691a317c4ac4071f)
- Reduces the offset caused by numerical updates

### Changed

- [chore: pretty](https://github.com/nexmoe/vscode-monitor-pro/commit/5ced3d8ad1175d7cd78d81de769d6a217c487921)

### Fixed

- [fix: memory unit bug](https://github.com/nexmoe/vscode-monitor-pro/commit/e91944fde51b5d2d016dbd34664ba2d165f76d57) <https://github.com/nexmoe/vscode-monitor-pro/issues/1>
- [fix: no Battery](https://github.com/nexmoe/vscode-monitor-pro/commit/358552999f3c3593daa976056e59fe8277610a19) <https://github.com/nexmoe/vscode-monitor-pro/issues/2> [and layout shift](https://github.com/nexmoe/vscode-monitor-pro/commit/358552999f3c3593daa976056e59fe8277610a19)

## [0.1.1] - 2023-10-04

### Added

support for vscode 1.60 and newer

## [0.0.1] - 2023-10-04

### Added

- CPU temperature.
- Battery status.
- CPU usage.
- Memory usage.
- Network usage.
- Filesystem usage.
