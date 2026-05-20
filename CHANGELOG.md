# Change Log

You can find change log in this way: <https://github.com/nexmoe/vscode-monitor-pro/releases>

All notable changes to the "Monitor Pro" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.7.0] - 2025-05-20

### Added

- **Go + gopsutil backend for Windows**: Native binary that reads system data directly via gopsutil, eliminating PowerShell/WMI overhead. 10x+ faster data collection (from ~200ms to under 20ms per poll cycle).
- **DataSource strategy pattern**: Pluggable data sources (`GoDataSource` / `SIDataSource`) with automatic fallback when Go binary is unavailable.
- **RawDataAdapter**: Transforms raw gopsutil JSON into the unified `SystemSnapshot` format with null-safety for all optional fields.
- **Resource usage webview**: Dedicated view with per-chart cards for CPU, memory, network, disk, battery, CPU temperature, CPU speed, disk space, OS distro, and uptime.
- **Cross-platform VSIX packaging**: Platform-specific packages for universal (macOS/Linux), Windows x64, and Windows ARM64 via `vsce --target`.
- **CI/CD pipeline**: Go cross-compilation verification, lint, automated Marketplace publishing, GitHub Releases with per-target VSIX artifacts.
- **Localization**: Full translations for 简体中文, 繁體中文, and 日本語 (64 keys each, aligned with English source).
- **Unavailable metrics detection**: Centralized mechanism in `SystemDataProvider` that detects and hides unsupported metrics (battery, CPU temperature, CPU speed) in the webview.
- **Configuration hot-reload**: React to config changes without extension restart.
- **Dev release workflow**: Package workflow creates GitHub Releases with draft=false, prerelease=true for development tags.

### Changed

- **CPU utilization**: Go backend now returns overall (multi-core average) instead of per-core percentage.
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
