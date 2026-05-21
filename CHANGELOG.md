# Change Log

All notable changes to the "Monitor Pro" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.7.0] - 2025-05-20

### Breaking Changes

- **Status bar defaults reduced dramatically.** Only CPU, Memory Active, and Battery remain enabled by default. All other metrics — Network, CPU Temperature, CPU Speed, Uptime, Disk I/O, Disk Space, OS Distro — are now opt-in via `monitor-pro.metrics.*`. This keeps the default status bar clean and avoids redundancy with the newly added Resource Usage webview, where all metrics are available as live charts.

### Added

- **Go backend battery endpoint** (`/api/v1/battery`): Reads real battery data via `github.com/distatus/battery`. Returns signed power (positive = charging, negative = discharging) with a 5-sample moving average, plus health percentage (full / design capacity ratio).
- **PDH-based CPU percent (Windows)**: Uses `\Processor Information(_Total)\% Processor Utility` — identical counter to Windows Task Manager (Win8+). Falls back to `\Processor(_Total)\% Processor Time`. Non-blocking, instant results, no gopsutil dependency for percent.
- **Non-blocking CPU percent (Linux)**: Delta-based calculation from `/proc/stat` with pre-seeded cache. 30× faster than gopsutil's blocking `Percent()` (0.14s vs 4.2s).
- **Dynamic CPU frequency (Windows)**: Reads `\Processor Information(_Total)\% Processor Performance` via PDH and computes live MHz. Replaces static ACPI/registry values — turbo boost and power-saving states now visible in real time.
- **Battery power chart**: Signed watt display (+/- W) with auto-scaling Y-axis and a dashed zero reference line in the webview.
- **Battery health, power state, power rate**: Complete pipeline from Go → RawDataAdapter → SystemSnapshot → webview, shown in the battery chart subtitle (Health%, Charging/Discharging/Idle).
- **Independent info section config**: `monitor-pro.resourceUsage.showUptime` and `showOsDistro` (both default `true`) let users independently toggle uptime and OS distro info cards without affecting status bar settings.
- **samplingPoints config**: `monitor-pro.resourceUsage.samplingPoints` (10–500, default 60) controls chart history length.
- **batteryPower chart config**: Independent chart entry in `monitor-pro.resourceUsage.charts` with configurable enable/view/color.
- **l10n keys**: Health, Charging, Discharging, Idle, Min, Max — translated for zh-cn, zh-tw, ja.
- **Webview subtitle l10n**: All chart subtitles now use pre-formatted `vscode.l10n.t()` strings instead of hardcoded HTML text.
- **Decoupled metric visibility**: `batteryPower` hides independently of `battery` via `UNAVAILABLE_CHECKERS` in `systemData.ts`.
- **Native Go backend for Windows**: Spawns `monitor.exe` using gopsutil v4 for direct OS API access. Communicates via HTTP on localhost. 10×+ faster collection (from ~200ms to under 20ms per poll cycle).
- **DataSource strategy pattern**: `GoDataSource` and `SIDataSource` implement a common `DataSource` interface with automatic fallback when the Go binary is unavailable.
- **RawDataAdapter**: Transforms raw gopsutil JSON into the unified `SystemSnapshot` format with null-safety for all optional fields.
- **Resource Usage webview**: Dedicated side panel with 11 live line/bar charts (CPU, Memory, Network, Disk, Battery, Battery Power, CPU Temperature, CPU Speed) and info cards (Uptime, OS Distro, Disk Space with colored progress bars).
- **Cross-platform VSIX packaging**: Platform-specific packages for universal (macOS/Linux), Windows x64, and Windows ARM64.
- **CI/CD pipeline**: Go cross-compilation verification, lint, automated Marketplace publishing, GitHub Releases with per-target VSIX artifacts.
- **Localization**: Full translations for 简体中文, 繁體中文, and 日本語 (69+ keys aligned with English source).
- **Unavailable metrics detection**: Centralized mechanism that detects and hides unsupported sensors (battery, temperature, speed) in the webview.
- **Configuration hot-reload**: React to config changes without extension restart.

### Changed

- **Formatting consistency**: All formatted values (%, W, °C, GHz, byte rates) now consistently respect `showSpace`, `singleUnit`, and `significantDigits` configurations across both the status bar and webview.
- **showSpace honored everywhere**: Previously only `byteFormat()` calls respected `showSpace`; non-byte values (% , W, °C) were always compact. Now all chart labels, info cards, and status bar items consistently add/omit spaces between number and unit.
- **singleUnit extended to webview**: The HTML client-side `formatRate()` and `formatBytes()` now support `singleUnit`, abbreviating e.g. "MiB" → "M" when enabled.
- **Per-metric significantDigits**: `significantDigits` config is now read for cpu, battery, cpuTemp, cpuSpeed, and diskSpace sections, not just memoryActive and network.
- **CPU utilization**: Go backend returns overall (multi-core average) instead of per-core percentage.
- **Webview subtitle**: CPU frequency subtitle shows "Min / Max" only when min < max; otherwise displays a single value (avoids redundant display on Windows where all cores share the same PDH value).
- **Battery percent**: `.toFixed(1)` applied in provider to prevent extreme decimal precision (e.g. `97.9987%`).
- **Minimum value clamping**: `fmtSigNum` clamps to `"0"` when `|n| < 0.001` to prevent exponential notation.
- **Disk mount sort**: Removed platform-specific `/` -first sort; uses alphabetical `localeCompare` throughout.
- **Network interface selection**: Automatically picks the first non-loopback interface.
- **Disk I/O selection**: Picks the first non-loop physical disk. For containers, a manual `/` fallback is added (Linux only).
- **Memory metrics**: Optimized collection with default refresh interval of 2000ms.
- **Build system**: Migrated from webpack to esbuild for faster compilation.
- **Workflows**: All GitHub Actions release notes and comments translated to English.

### Fixed

- **Zero reference line**: Battery power chart now always draws a dashed horizontal line at 0W to distinguish charging (positive) from discharging (negative).
- **CPU frequency**: Corrected MHz → GHz division in status bar display.
- **Disk percentage**: `Math.round(u.usedPercent * 100) / 100` ensures 0–100 scale (not 0–1).
- **Webview emoji**: Removed hardcoded ⚡ and ⬇ from battery subtitle.
- **Battery power coupling**: Power view no longer auto-hides when battery view is hidden in the webview.
- **Fetch timeout**: Go backend HTTP requests have a 5s timeout; prevents polling loop hang.
- **Polling hang**: `_collectPromise` properly reset via `.finally()`.
- **Null slices from Go backend**: Empty `[]*disk.UsageStat` slices are initialized as empty arrays (not `null`).
- **Windows `/` mount**: Go backend disk handler skips root fallback on Windows.
- **l10n gaps**: Hardcoded warning strings now use `l10n.t()`.
- **pnpm in CI**: Go CI job installs pnpm before running Go test scripts.

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
