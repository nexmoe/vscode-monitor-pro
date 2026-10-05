# Monitor Pro

[github-shield]: https://img.shields.io/github/stars/nexmoe/vscode-monitor-pro?style=social
[github-url]: https://github.com/nexmoe/vscode-monitor-pro

[![Github Repo][github-shield]][github-url]

[vscode-url]: https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro

[![VSCode Installs](https://img.shields.io/badge/install-20k+-green?logo=visual-studio-code)][vscode-url]

[English](./README.md) | [简体中文](./README_zh-cn.md) | 繁體中文 | [日本語](./README_ja.md)

Monitor Pro 是一款即時系統資源監控工具，直接在 VS Code 狀態列和專屬 Webview 面板中呈現。本擴充套件在設計之初就考慮了跨平台與遠端開發機效能監控的需求，在本機系統、Remote SSH、WSL 上均有完整的實作。

採用**混合架構**：Windows 上使用原生 Go 二進位，繞開 PowerShell/WMI 的開銷，收集速度相較於 `systeminformation` **提升 10 倍以上**；macOS Apple Silicon 機器使用 [mactop](https://github.com/metaspartan/mactop)（若已啟用）透過 Prometheus HTTP 端點取得 SoC 層級指標（CPU/GPU/ANE 功率、溫度）；Linux 和未啟用 mactop 的 macOS 使用 Node.js (`systeminformation`) 資料來源。資料來源絕不會自動切換：mactop 啟用期間若啟動失敗即停止收集，改用內建資料來源是失敗通知裡提供的顯式選項。

> [!WARNING]
>
> **破壞性變更 0.7.0**
>
> 狀態列預設僅顯示 CPU、活躍記憶體和電池三項。其餘指標（網路、CPU 溫度、CPU 頻率、執行時間、磁碟 I/O、磁碟空間、系統發行版）需在 VS Code 設定 `monitor-pro.metrics.*` 中手動開啟。
>
> 背景：資源佔用視圖上線後，大多數指標在專屬面板中顯示效果更好。狀態列只保留最核心的三項指標，避免新使用者初次安裝時狀態列過於擁擠。

## 0.8 / 0.9 新增內容

- **macOS Apple Silicon（mactop）**：可選的 [mactop](https://github.com/metaspartan/mactop) 後端提供 SoC 層級指標——CPU/GPU/ANE 功率、溫度與 GPU 使用率。首次執行會提示一鍵執行 `brew install mactop`。
- **GPU 監控**：透過 `nvidia-smi` 支援 NVIDIA GPU，並藉由 mactop 支援 Apple Silicon 整合 GPU——提供使用率、溫度與顯示記憶體（僅 NVIDIA）圖表，以及單卡陣列檢視。
- **瓦特功率**：Windows 顯示帶符號的電池淨功率，Apple Silicon 顯示 SoC 總功率；0W 虛線參考線與 5 樣本移動平均使讀值更穩定。
- **每核 CPU 檢視**：CPU 使用率與溫度卡片可切換為依核心排列的網格檢視。
- 另有一批修正：圖表配色隨主題自適應、macOS 27 電池健康度、關閉最後一個 VS Code 視窗時結束 mactop 等。

## 0.7.0 重大更新速覽

右側邊欄監控面板：

![右側邊欄監控面板](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image.png)

CPU 頻率、磁碟等資訊：

![CPU 頻率、磁碟等資訊](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-1.png)

輔面板全螢幕檢視：

![輔面板全螢幕檢視](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-2.png)

主面板檢視：

![主面板檢視](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-3.png)

底面板側邊欄檢視：

![底面板側邊欄檢視](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-4.png)

主題自適應——暗色：

![主題自適應——暗色](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-5.png)

長條圖檢視示範：

![長條圖檢視示範](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-6.png)

l10n——日語原始碼：

![l10n——日語原始碼](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-7.png)

l10n——中文：電量、電池健康度與功率：

![l10n——中文：電量、電池健康度與功率](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-8.png)

放電與充電的圖線切換：

![放電與充電的圖線切換](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-9.png)

## 功能特性

### 狀態列

14 項可獨立開關的指標，以 Codicon 圖示搭配格式化數值顯示：

| 指標           | 預設 | 圖示                                | 範例                    |
| -------------- | ---- | ----------------------------------- | ----------------------- |
| CPU            | 開   | `$(chip)`                           | `73.2%`                 |
| 活躍記憶體     | 開   | `$(pie-chart)`                      | `4.21 / 15.6 GiB`       |
| 電池           | 開   | `$(plug)`                           | `85.2% (充電中)`        |
| 已用記憶體     | 關   | `$(pie-chart)`                      | `8.15 / 15.6 GiB`       |
| 網路           | 關   | `$(cloud-download) $(cloud-upload)` | `125 KiB/s 2.34 MiB/s`  |
| CPU 溫度       | 關   | `$(flame)`                          | `52.3°C`                |
| CPU 頻率       | 關   | `$(dashboard)`                      | `3.81 GHz`              |
| GPU            | 關   | `$(circuit-board)`                  | `73.2%`                 |
| GPU 溫度       | 關   | `$(lightbulb-sparkle)`              | `52.3°C`                |
| GPU 顯示記憶體 | 關   | `$(layers)`                         | `11.2 / 24 GiB`         |
| 執行時間       | 關   | `$(clock)`                          | `2d 14h 32m`            |
| 磁碟 I/O       | 關   | `$(log-in) $(log-out)`              | `50.2 MiB/s 12.1 MiB/s` |
| 磁碟空間       | 關   | `$(database)`                       | `/ 45.2% 120/256 GiB`   |
| 系統發行版     | 關   | —                                   | `Ubuntu 22.04`          |

> GPU 指標需要配備 `nvidia-smi` 的 NVIDIA 硬體，或使用 mactop 後端的 Apple Silicon；否則自動隱藏。GPU 顯示記憶體一項還需能讀取 VRAM，而 mactop 的整合式 GPU 後端不提供此資料。

### 資源佔用視圖

側邊欄專屬面板，為 14 項指標提供即時折線圖與長條圖：CPU、記憶體（活躍/已用）、網路（下行/上行）、磁碟（讀取/寫入）、電池、電池功率 / SoC 功率、CPU 溫度、CPU 頻率、GPU、GPU 溫度、GPU 顯示記憶體。在 macOS Apple Silicon 上使用 mactop 後端時，功率圖會切換為 SoC 功率模式，顯示晶片總功耗（CPU + GPU + ANE）。

每張圖表包含：

- 基於 Canvas 2D 的即時渲染，帶漸層填滿與貝茲曲線
- 自適應 Y 軸縮放，目前最大刻度以 `↑` 前置符號標註
- 折線圖/長條圖一鍵切換
- **單核心/單卡陣列檢視**：CPU 使用率、CPU 溫度、GPU、GPU 溫度、GPU 顯示記憶體卡片可切換為彩色長條網格——每個 CPU 核心（`C0`、`C1`、…）或每張顯示卡（`G0`、`G1`、…）對應一條長條，展示各自的使用率 / 溫度 / 顯示記憶體。將滑鼠游標停在某個 GPU 單元上可查看顯示卡型號（GPU 顯示記憶體檢視還顯示已用/總量）。
- 副標題：電池健康度、充放電狀態、溫度最低值、頻率範圍
- 歷史點數可設定（10~500）

GPU 圖表預設啟用，在無 GPU 資料來源（NVIDIA `nvidia-smi` 或 Apple Silicon 上的 mactop 後端）時自動隱藏。單卡陣列檢視僅在有兩張以上 GPU 時顯示。

底部**資訊區**顯示執行時間、系統發行版和磁碟空間，並配有彩色進度條。這些資訊卡屬於 `resourceUsage.charts` 設定的一部分，可透過 `charts.osDistro.enabled` / `charts.uptime.enabled` / `charts.diskSpace.enabled` 開關控制（預設啟用）。

### 按需查詢

被關閉的指標**不會產生任何查詢**——收集完全由啟用項驅動。底層資料來源呼叫（macOS/Linux 上的 `systeminformation`，Windows 上的 Go 後端）只會取得目前用到的維度：

- 狀態列 `monitor-pro.metrics.*` 開關與 Webview `resourceUsage.charts.*.enabled` 合併為同一份「已啟用集合」。
- 未使用的 `SI.*` 呼叫、未使用的 Go 收集群組（CPU / 記憶體 / 磁碟 / 網路 / 主機 / 電池）都會被直接跳過，而不是先查詢再過濾。
- 只顯示少數指標時，重新整理一次的開銷可以保持在很低的水平。修改任意開關後，收集會在下一次重新整理時立即調整（熱重載）。

### 電池 / SoC 功率監控

Monitor Pro 以瓦特為單位，支援兩種模式的即時功率監測：

- **Windows**：電池淨功率（充電為正、放電為負）透過原生 Go 後端獲取。
- **macOS Apple Silicon**：總 SoC 功率（CPU + GPU + ANE）透過 mactop 後端取得，以非負值顯示。同時包含來自 `pmset` 的電池健康度和剩餘時間。

- **帶符號顯示**：正值為充電，負值為放電
- **0W 參考線**：虛線始終標出 0W 位置
- **5 樣本移動平均**，確保讀數穩定
- **健康度百分比**：目前滿充容量與設計容量之比
- **狀態檢測**：充電中 / 放電中 / 空閒

### 格式一致性

所有指標的格式化輸出（百分比、瓦特、攝氏度、GHz、位元組速率）統一遵循三個設定項：

- `showSpace`：數字與單位間是否加空格
- `singleUnit`：單位縮寫為首字母（K、M、G）
- `significantDigits`：每項指標獨立的有效數字位數

三個設定在狀態列和 Webview 中同時生效。

### CPU 效能

- **Windows**：使用與工作管理員相同的 PDH 計數器（`% Processor Utility`），CPU 利用率讀數準確。頻率透過 `% Processor Performance` 即時讀取，即時反映渦輪增壓與節能狀態的變化。
- **Linux**：基於 `/proc/stat` 做增量計算，不阻塞等待，首次取樣結果會被快取——比傳統的阻塞方案快約 30 倍。

### 跨平台

- 支援本地、Remote SSH、WSL
- Windows 使用原生 Go 二進位（原生效能）；macOS Apple Silicon 使用 mactop（SoC 指標）；Linux 與未啟用 mactop 的 macOS 使用 Node.js——切換到內建資料來源始終是使用者的顯式選擇，不會是自動回退
- 多語言：英文、簡體中文、繁體中文、日文

## 配置

所有設定項都歸在 `monitor-pro.*` 下，修改後即時生效（熱重載）。

| 設定                                        | 預設值        | 說明                                                                               |
| ------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `monitor-pro.metrics.*`                     | 見上表        | 開關狀態列各項指標                                                                 |
| `monitor-pro.metricsOrder`                  | —             | 調整狀態列顯示順序                                                                 |
| `monitor-pro.mactop.enabled`                | `true`        | 啟用 macOS mactop 後端（SoC 指標）及其安裝提示；啟用期間啟動失敗將停止收集而不回退 |
| `monitor-pro.refresh-interval`              | `2000` ms     | 輪詢間隔（500~30000ms）                                                            |
| `monitor-pro.unitSystem`                    | `binary`      | `binary`（KiB/MiB）或 `decimal`（kB/MB）                                           |
| `monitor-pro.showSpace`                     | `false`       | 數字與單位間是否加空格                                                             |
| `monitor-pro.singleUnit`                    | `false`       | 單位縮寫為首字母（K, M, G）                                                        |
| `monitor-pro.significantDigits`             | 各指標不同    | 有效數字位數（1~6）                                                                |
| `monitor-pro.uptimeFormat`                  | `auto`        | 自訂格式，支援 `{d}` `{h}` `{m}` `{s}`                                             |
| `monitor-pro.resourceUsage.charts`          | —             | 圖表/卡片啟用、檢視、顏色（含 `osDistro`、`uptime`、`diskSpace`）                  |
| `monitor-pro.resourceUsage.samplingPoints`  | `60`          | 圖表歷史點數（10~500）                                                             |
| `monitor-pro.resourceUsage.diskSpaceMounts` | `["all"]`     | 磁碟空間卡片掛載點過濾                                                             |
| `monitor-pro.diskSpace`                     | `["/", "C:"]` | 狀態列磁碟空間掛載點過濾                                                           |

## 0.6.0 之前的螢幕截圖（目前版本仍相容）

![截圖 0](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot0.png)
![截圖 1](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot1.png)
![截圖 2](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot2.png)

## 系統需求

- VS Code 1.104+
- Windows 10/11（使用原生 Go 後端時所需；其他平台走內建資料來源）
- macOS 12+ Apple Silicon（可選）：安裝 [mactop](https://github.com/metaspartan/mactop)（v2.1.4+）以取得 SoC 指標（`brew install mactop`）。首次執行時若偵測到缺失，會提示一次是否自動安裝（可透過 `monitor-pro.mactop.enabled` 關閉該提示）。mactop 啟用期間若啟動失敗即停止收集；失敗通知提供一鍵切換到內建資料來源，若不理會安裝提示，指標會一直保持停用，直到安裝 mactop 或關閉該設定

## 開發

參見 [CONTRIBUTING.md](./CONTRIBUTING.md)

### 快速開始

```bash
pnpm install
pnpm run compile
```

### 指令

| 指令                                | 說明                             |
| ----------------------------------- | -------------------------------- |
| `pnpm run lint`                     | 檢查 TypeScript 原始碼（ESLint） |
| `pnpm run go:test`                  | 執行 Go 後端測試                 |
| `pnpm run go:vet`                   | 執行 Go 靜態檢查                 |
| `pnpm run go:build:win32-x64`       | 交叉編譯 Windows x64 Go 二進位   |
| `pnpm run go:build:win32-arm64`     | 交叉編譯 Windows ARM64 Go 二進位 |
| `pnpm run package:vsix:universal`   | 打包通用 VSIX（macOS/Linux）     |
| `pnpm run package:vsix:win32-x64`   | 打包 Windows x64 VSIX            |
| `pnpm run package:vsix:win32-arm64` | 打包 Windows ARM64 VSIX          |
| `pnpm run gen-l10n`                 | 從原始碼重新產生在地化檔案       |
| `pnpm run l10n:check`               | 驗證在地化檔案與原始碼一致       |
| `pnpm run l10n:parity`              | 驗證各語系的鍵完全一致           |

## 靈感來源與致謝

### 靈感

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

### 致謝

- [TrafficMonitor](https://github.com/zhongyang219/TrafficMonitor)：沿用其 PDH 查詢生命週期（常駐控制代碼、基線收集、每次重新整理只收集一次），用於 Windows Go 後端的 CPU 監控，使讀數與工作管理員完全一致。

## 回饋

問題與功能建議：[提交 Issue](https://github.com/nexmoe/vscode-monitor-pro/issues)

## 支持本專案

歡迎到 [GitHub](https://github.com/nexmoe/vscode-monitor-pro) 點個 star，或在 [VS Code 市集](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details) 留下評價！
