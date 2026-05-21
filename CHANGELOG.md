# Change Log

You can find change log in this way: <https://github.com/nexmoe/vscode-monitor-pro/releases>

All notable changes to the "Monitor Pro" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.7.0] - 2025-05-20

### Breaking Changes

- **Status bar defaults reduced**: Only CPU, Memory Active, and Battery are enabled by default. Previously enabled metrics (Network, CPU Temperature, CPU Speed, Uptime, Disk I/O, Disk Space) are now opt-in. Re-enable via `monitor-pro.metrics.*` settings.
- **Status bar default toggled off**: `fileSystem`, `diskSpace` → `false` (was `true`)
  -- `network`, `cpuTemp`, `cpuSpeed`, `uptime` → `false` (was `true`)

### Added

- **Go battery endpoint**: New `/api/v1/battery` endpoint using `github.com/distatus/battery` with 5-sample moving average power rate, signed power (positive = charging, negative = discharging), and health percentage.
- **PDH-based CPU percent (Windows)**: Uses `\Processor Information(_Total)\% Processor Utility` — same counter as Task Manager (Win8+). Falls back to `\Processor(_Total)\% Processor Time`. Non-blocking, instant results, no gopsutil dependency for percent.
- **Non-blocking CPU percent (Linux)**: Delta-based calculation from `/proc/stat` with pre-seeded cache. 30x faster than gopsutil's blocking `Percent()` (0.14s vs 4.2s).
- **Dynamic CPU frequency (Windows)**: Reads `\Processor Information(_Total)\% Processor Performance` via PDH and computes real-time MHz. Replaces static ACPI/registry values in the webview.
- **Battery power chart**: Signed power display (+/- W) with auto-scaling Y-axis in the resource usage webview.
- **Battery health, power state, power rate**: Added to data pipeline (Go → RawDataAdapter → SystemSnapshot → webview) and shown in subtitle (Health%, Charging/Discharging/Idle).
- **samplingPoints config**: `monitor-pro.resourceUsage.samplingPoints` (10–500, default 60) controls chart history length.
- **batteryPower chart config**: Independent chart in resource usage webview with configurable enable/view/color.
- **l10n keys**: Health, Charging, Discharging, Idle, Min, Max — translated for zh-cn, zh-tw, ja.
- **Webview subtitle l10n**: All chart subtitles use pre-formatted `vscode.l10n.t()` strings instead of hardcoded HTML text.
- **Decoupled metric visibility**: `batteryPower` hidden independently of `battery` via `UNAVAILABLE_CHECKERS` in systemData.ts.
- **Go + gopsutil backend for Windows**: Native binary that reads system data directly via gopsutil, eliminating PowerShell/WMI overhead. 10x+ faster data collection (from ~200ms to under 20ms per poll cycle).
- **DataSource strategy pattern**: Pluggable data sources (`GoDataSource` / `SIDataSource`) with automatic fallback when Go binary is unavailable.
- **RawDataAdapter**: Transforms raw gopsutil JSON into the unified `SystemSnapshot` format with null-safety for all optional fields.
- **Resource usage webview**: Dedicated view with per-chart cards for CPU, memory, network, disk, battery, battery power, CPU temperature, CPU speed, disk space, OS distro, and uptime.
- **Cross-platform VSIX packaging**: Platform-specific packages for universal (macOS/Linux), Windows x64, and Windows ARM64 via `vsce --target`.
- **CI/CD pipeline**: Go cross-compilation verification, lint, automated Marketplace publishing, GitHub Releases with per-target VSIX artifacts.
- **Localization**: Full translations for 简体中文, 繁體中文, and 日本語 (64 keys each, aligned with English source).
- **Unavailable metrics detection**: Centralized mechanism in `SystemDataProvider` that detects and hides unsupported metrics (battery, CPU temperature, CPU speed) in the webview.
- **Configuration hot-reload**: React to config changes without extension restart.
- **Dev release workflow**: Package workflow creates GitHub Releases with draft=false, prerelease=true for development tags.

### Changed

- **CPU utilization**: Go backend now returns overall (multi-core average) instead of per-core percentage.
- **Webview subtitle logic**: Min/Max frequency shown only when min < max; otherwise shows single current value (avoids redundant display on Windows where all cores share same PDH value).
- **Battery percent formatting**: `.toFixed(1)` applied in provider to prevent `97.9987%`-style decimals.
- **Formatting**: Unified value formatting with `fmtSigNum` — clamps to `"0"` when `|n| < 0.001` to prevent exponential notation.
- **Disk mount sort**: Removed platform-specific `/` first sort; uses alphabetical `localeCompare` throughout.
- **Network interface selection**: Automatically picks the first non-loopback interface for rate calculation.
- **Disk I/O selection**: Picks the first non-loop physical disk device. For containers, manual `/` fallback is added (Linux only).
- **Memory metrics**: Optimized collection with default refresh interval of 2000ms.
- **Build system**: Migrated from webpack to esbuild for faster compilation.
- **Workflows**: All GitHub Actions release notes and comments translated to English.

### Fixed

- **CPU frequency**: Corrected MHz → GHz division in status bar display.
- **Disk percentage**: `Math.round(u.usedPercent * 100) / 100` ensures 0–100 scale (not 0–1).
- **Webview emoji**: Removed hardcoded ⚡ and ⬇ from battery subtitle.
- **Battery power coupling**: Power view no longer auto-hides when battery view is hidden.
- **Fetch timeout**: Go backend HTTP requests have a 5s timeout; prevents polling loop hang.
- **Polling hang**: `_collectPromise` properly reset via `.finally()`.
- **Null slices from Go backend**: Empty `[]*disk.UsageStat` slices are initialized as empty arrays (not `null`).
- **Windows `/` mount**: Go backend disk handler skips `/` fallback on Windows.
- **l10n gaps**: Hardcoded warn strings (`Metric "..."" is not available on this system`, `Collection failed: ...`) now use `l10n.t()`.
- **pnpm in CI**: Go CI job now installs pnpm before running Go test scripts.
- **Memory configurations**: Applied data memory configuration.

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
