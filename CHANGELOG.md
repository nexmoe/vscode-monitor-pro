# Change Log

All notable changes to the "Monitor Pro" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.9.2] - 2026-08-12

### Changed

- **GPU data now comes straight from `nvidia-smi`**: The GPU collector queries `nvidia-smi` directly via an async child process instead of enumerating controllers with `systeminformation`. This removes the implicit `lspci` dependency that hid GPU metrics in container environments, drops a per-cycle synchronous enquiry, and no longer constructs an intermediate graphics snapshot. Memory is still reported in bytes.
- **Go backend startup is deterministic**: Backend startup now uses `async/await`; when the Go backend fails to start, the data source is no longer silently swapped for the `systeminformation` fallback — the extension logs the error and does not start collection. The Windows `powerShellStart` / `powerShellRelease` hooks are removed, and the l10n strings for the removed fallback message are replaced.
- **Chart vertical headroom reduced**: `SCALE_HEADROOM` drops from 1.15 to 1.0, so auto-scaled line charts no longer reserve 15% empty space above the peak value and use the full chart height.

## [0.9.1] - 2026-08-09

### Changed

- **Theme colors are now sourced only from tokens every theme defines**: The webview dropped the layered `var(…, fallback)` chains for its root variables and chart border. Theme colors that VS Code only injects when a theme opts in (e.g. `widget.border`, `sideBar.foreground`) previously rendered the rounded chart frame invisible on many themes; the border is now derived from `editor.foreground` at the same 10% opacity as the grid lines, so framing is always visible and theme-consistent.
- **Chart lines are always drawn opaque**: `charts.orange` (used by the receive-rate and GPU temperature charts) defaults to a translucent find-match highlight that VS Code injects as `rgba()`, making those lines faint on the default themes. All chart colors are now normalized to opaque `rgb()` at lookup time, so lines stay crisp while user overrides in settings are still respected.

## [0.9.0] - 2026-08-09

### Added

- **GPU metrics from the mactop backend**: On macOS Apple Silicon, the mactop data source now maps `mactop_gpu_usage_percent` and `mactop_gpu_temp_celsius` into a single integrated-GPU card, so the GPU Usage and GPU Temperature charts work on macOS without NVIDIA hardware. VRAM is not available for the integrated GPU, so the GPU Memory chart stays hidden there.
- **Guided mactop installation**: When mactop is missing on first run, the extension now prompts with `Auto install` / `Don't show again` / `Dismiss` instead of opening the upstream repository page. `Auto install` runs `brew install mactop` and reports success or failure via notification.
- **mactop opt-out setting**: New `monitor-pro.mactop.enabled` setting (default `true`) gates the mactop backend entirely — set it to `false` to always use the built-in data source, even when mactop is already installed.

### Changed

- **Chart framing**: The resource usage webview now draws a rounded border around the chart area (1.5px, theme-aware `widget.border` with a `contrastBorder` fallback for high-contrast themes) instead of a faint background tint, giving single-GPU and multi-card layouts a cleaner look.
- **Area fill blends toward the card background**: The line-chart gradient is now computed with `color-mix(in oklab, …)` so light line colors keep their hue instead of washing out to gray at low alpha. It falls back to plain alpha compositing if the theme background var is unavailable.
- **Chart grid decluttered**: The redundant top/bottom edge lines are removed so the frame border acts as the zero/full-scale reference; the three inner grid lines stay at the original opacity. The gradient area depth was increased (30%/10% blend stops) for a heavier, richer fill.

### Fixed

- **Excessive decimal places on first run**: `fmtNum` in the webview previously applied raw `sig` digits to `toLocaleString`, so a missing `significantDigits` key (a partial user config object, or the GPU keys before first-run config hydration) rendered full float precision — e.g. GPU temperature showed `34.566` instead of `34.6`. It now falls back to 3 significant digits like the sibling formatters.
- **Per-card GPU array shown for a single GPU**: The GPU array view (`G0`, `G1`, …) and its toggle are now suppressed when only one GPU card is present (e.g., a single integrated Apple Silicon GPU), matching the `>1` core threshold used elsewhere.

## [0.8.0] - 2026-08-08

### Added

- **NVIDIA GPU monitoring**: Three new resource usage charts — GPU Usage, GPU Temperature, and GPU Memory (VRAM) — enabled by default. Each card has a per-card array view (`G0`, `G1`, …) showing individual GPU utilization / temperature / memory, with the card model on hover. Multi-GPU readings are aggregated for the main chart: utilization = average, temperature = maximum, memory = sum.
  - **Status bar metrics**: Optional `gpu`, `gpuTemp`, `gpuMem` status bar entries (disabled by default) mirroring the charts: average usage, max temperature, and summed used/total VRAM.
  - **NVIDIA only**: Metrics come from `nvidia-smi`. When `systeminformation` cannot enumerate controllers (e.g. containers without `lspci`), the data source falls back to parsing `nvidia-smi` directly. Machines without NVIDIA hardware/driver hide all GPU entries automatically.
  - **GPU temperature array view** uses the same fixed 0–110°C scale as the CPU temperature array, so cards above 100°C (e.g. GDDR6X) still show their real temperature.
- **Per-core CPU array view**: The CPU Usage and CPU Temperature charts now expose a per-core view (`C0`, `C1`, …) next to the line/bar toggle, showing individual core utilization and temperature with color-coded bars.

### Changed

- **Percentage label spacing tightened** next to usage bars in the webview.

## [0.7.8] - 2026-08-07

### Added

- **Scale labels for all auto-scaled charts**: Line charts now show the current scale maximum in the top-left corner (bar charts on the right), marked with an `↑` prefix to distinguish it from the live value in the top-right. CPU temperature, CPU speed, and battery power now show a scale label too — previously only network and disk rates did. Scale and value labels share identical formatting with a background halo for readability on any theme.

### Fixed

- **Long disk mount paths truncated**: Mount paths longer than the card width are trimmed with an ellipsis and show the full path on hover.

### Changed

- **Unified chart label rendering**: Scale and value labels are drawn through the same code path, removing duplicated per-label style setup.

### Chore

- **Auto-compile before debug**: The `Run Extension` launch now runs the `compile` task (type check + esbuild) first, keeping `dist/extension.js` current.

## [0.7.7] - 2026-07-25

### Added

- **mactop backend for macOS Apple Silicon**: When [mactop](https://github.com/context-labs/mactop) is installed via Homebrew, Monitor Pro automatically uses it as the data source on macOS ARM64, providing SoC-level metrics (CPU/GPU/ANE power, temperature) via a Prometheus HTTP endpoint. The extension detects mactop, starts/reuses a headless process on a free port, and falls back to `systeminformation` if unavailable.
- **SoC Power chart**: When using the mactop backend, the battery power chart shows total SoC power (always non-negative) instead of battery power.
- **New l10n strings**: 12 new i18n keys across all 4 locales for mactop backend integration (installation prompt, process lifecycle, health check, SoC Power label, etc.).

### Fixed

- **APFS disk capacity double-counting** (follow-up to 0.7.6): APFS volumes that share the same physical device are now deduplicated by `physicalDevice` in `diskSpace.ts`, preventing inflated capacity and usage totals on macOS.
- **macOS battery timeRemaining accuracy**: When using the mactop backend, battery ETA is now sourced from `pmset` instead of the SoC power value, since mactop reports total SoC power rather than battery charge/discharge rate.

## [0.7.6] - 2026-07-18

### Added

- **On-demand metric collection (true lazy querying)**: Metrics you disable are no longer queried at all. The collection set is the union of status bar `monitor-pro.metrics.*` and webview `resourceUsage.charts.*.enabled`, and only those groups are gathered — by both the Node (`systeminformation`) path and the Go backend (`/api/v1/all?metrics=`).
- **Unified webview info cards under `resourceUsage.charts`**: OS distribution, uptime, and disk-space info cards are now first-class entries in the `resourceUsage.charts` setting (default enabled), so hiding/showing them follows the same toggle flow as charts. The separate `monitor-pro.showUptime` / `monitor-pro.showOsDistro` settings are removed.
- **New `metricMap` module**: Centralizes the metric → data-source dimension mapping used by the collector worker and Go adapter.

### Changed

- **Go backend now collects only the requested metric groups**: `handlers.go` reads the `metrics` query param and gathers only those groups; the Load group was removed (folded into CPU).
- **Bar-view styling unified** across the resource usage webview for a consistent look.
- **`systeminformation` dependency updated** to 5.31.7.
- **Extension recommendations removed** from `.vscode/extensions.json`.

### Removed

- **Dead i18n keys**: Orphaned `resourceUsage` config translation keys dropped across all four language bundles (`package.nls*.json`).

## [0.7.5] - 2026-05-27

### Added

- **Battery estimated time in status bar & webview**: Status bar now shows e.g.
  
  `$(plug) 75% · 1h 30m until full` or `$(symbol-event) 50% · 2h 10m until empty`.
  
  The webview battery card appends the same estimate after the charge state.
- **Localized chart toggle tooltips**: The Line / Bar chart toggle buttons in the resource usage webview now show localized tooltips (`Line chart` / `Bar chart`).

### Changed

- **Status bar icons refreshed**: CPU icon changed from `$(pulse)` to `$(chip)`; memory icons changed from `$(server)` to `$(pie-chart)`; discharging battery now shows `$(symbol-event)` instead of `$(plug)`.
- **Compact battery status bar**: The charging/discharging state label is removed from the status bar—the icon and estimated time already convey the same info. The "Est." prefix is dropped from the webview battery card.
- **Hidden scrollbar in webview**: The resource usage webview now hides its scrollbar for a cleaner look (scroll still works).

### Fixed

- **No more `$(error)` icon flash on metric update failure**: Previously, when a metric update failed, the status bar would briefly show `$(error) <metric>`. The error is still logged; the status bar now simply keeps the last good value.
- **Language bundle cleanup**: Removed orphaned keys (`$(error) {0}`, `(Charging)`) and resorted bundles for consistency.

## [0.7.4] - 2026-05-24

### Fixed

- Fixes [#473](https://github.com/nexmoe/vscode-monitor-pro/issues/473)

- **Worker thread crash with systeminformation**: Fixed `DataCloneError` in the collector worker by normalizing data before posting to the main thread.
- **Polling stops after "Reload Window"**: Resolved a race condition where async ticks from a previous session would block the new polling cycle from starting.
- **Data collection could hang indefinitely**: Added a timeout guard to `collect()` to prevent a stuck promise from permanently halting updates.

### Changed

- **Concurrent data collection in Go backend**: CPU, memory, disk, network, host, load, and battery are now collected in parallel, with per-group context timeouts to prevent any single slow call from blocking the whole response.
- **Exponential backoff on collection failures**: The polling interval backs off (up to 30s) after consecutive failures, recovering automatically when the system stabilizes.
- **Centralized logging**: All logging consolidated into a shared logger with automatic caller location tracking for easier debugging.

## [0.7.3] - 2026-05-22

### Fixed

- **Windows CPU frequency stuck at static MHz**: Go backend's `pdhReadCounter` performed only one `PdhCollectQueryData` call, but the Processor Information kernel provider requires a priming collection before returning valid frequency data. Restored the second collection to match the proven pattern. (Fixes Windows dynamic frequency regression from 0.7.2.)

### Changed

- **CPU Speed chart disabled by default**: The CPU frequency line chart in the Resource Usage webview is now disabled by default due to this is not very useful. Users can enable it by `monitor-pro.resourceUsage.charts` settings.

## [0.7.2] - 2026-05-22

### Added

- **Worker Thread for system data collection**: Moves systeminformation polling (CPU, memory, disk, network, etc.) off the Extension Host main thread into a dedicated Worker Thread. Prevents blocking `statfs` calls on Linux from delaying other extensions' timers by up to 500ms per tick. Falls back to inline polling transparently if the Worker fails to start.

### Fixed

- **Windows CPU readings inflated**: Go backend's PDH query issued two back-to-back `PdhCollectQueryData` calls without an interval, producing garbage values for rate-based counters. Replaced with a persistent query handle matching [TrafficMonitor](https://github.com/zhongyang219/TrafficMonitor)'s pattern — baseline collection at init + single collection per tick — so readings now match Task Manager exactly. (Fixes [#5](https://github.com/nexmoe/vscode-monitor-pro/issues/5))
- **Negative battery power rate**: Discharging power now shows a leading "-" sign instead of unsigned positive value.
- **Worker module resolution**: `systeminformation` is now bundled into the Worker entry to avoid runtime resolution failures in VSIX deployments where `node_modules/` is excluded.

### Performance

- **Ring buffer for history data**: Replaced `Array.shift()` with `RingBuffer<T>` for O(1) enqueue/dequeue in resource usage data collection.
- **Go backend disk timeout**: Added `context.WithTimeout` guard to Go's `disk.Usage()` call to prevent indefinite hangs on slow/network mounts.
- **CSS caching**: Inline CSS in the resource usage webview is cached across re-renders instead of rebuilding the style element on each update.

### Changed

- **l10n extraction**: Migrated `systemData.ts` from `this._t()` wrapper to direct `vscode.l10n.t()` calls so all strings are auto-extractable by `@vscode/l10n-dev`. 6 previously missing strings are now available for localization.

### Chore

- **Prettier formatting**: All `.ts`, `.json`, and `.md` files reformatted with Prettier.

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
