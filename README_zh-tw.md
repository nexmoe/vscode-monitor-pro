# Monitor Pro

[github-shield]: https://img.shields.io/github/stars/nexmoe/vscode-monitor-pro?style=social
[github-url]: https://github.com/nexmoe/vscode-monitor-pro

[![Github Repo][github-shield]][github-url]

[vscode-url]: https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro

[![VSCode Installs](https://img.shields.io/badge/install-10k+-green?logo=visual-studio-code)][vscode-url]

[English](./README.md) | [简体中文](./README_zh-cn.md) | 繁體中文 | [日本語](./README_ja.md)

Monitor Pro 是一款即時系統資源監控工具，直接在 VS Code 狀態列和專屬 Webview 面板中呈現。本擴充套件在設計之初就充分考慮到了跨平台與遠端開發機效能監控的能力，在原始系統、Remote SSH、WSL 上均有完善的實作。

採用**混合架構**：Windows 上使用原生 Go 二進位繞過 PowerShell/WMI 開銷，相較於 `systeminformation` 實現 **10 倍以上的資料收集速度提升**；macOS 和 Linux 自動回退到 Node.js (`systeminformation`) 資料來源，確保全平台相容。

> [!WARNING]
>
> **破壞性變更 0.7.0**
>
> 狀態列預設僅顯示 CPU、活躍記憶體和電池三項。其餘指標（網路、CPU 溫度、CPU 頻率、執行時間、磁碟 I/O、磁碟空間、系統發行版）需在 VSCode 設定 `monitor-pro.metrics.*` 中手動開啟。
>
> 背景：資源佔用視圖上線後，大多數指標在專屬面板中視覺化效果更好。狀態列保留最核心的三項指標，避免新使用者初次安裝時狀態列過於擁擠。

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

主題自適應 — 暗色：

![主題自適應 — 暗色](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-5.png)

長條圖檢視示範：

![長條圖檢視示範](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-6.png)

l10n — 日語原始碼：

![l10n — 日語原始碼](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-7.png)

l10n — 中文、電量、電池健康度與功率：

![l10n — 中文、電量、電池健康度與功率](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-8.png)

放電與充電的圖線切換：

![放電與充電的圖線切換](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-9.png)

## 功能特性

### 狀態列

11 項可獨立開關的指標，以 Codicon 圖示 + 格式化數值展示：

| 指標       | 預設 | 圖示                                | 範例                    |
| ---------- | ---- | ----------------------------------- | ----------------------- |
| CPU        | 開   | `$(pulse)`                          | `73.2%`                 |
| 活躍記憶體 | 開   | `$(server)`                         | `4.21 / 15.6 GiB`       |
| 電池       | 開   | `$(plug)`                           | `85.2% (充電中)`        |
| 已用記憶體 | 關   | `$(server)`                         | `8.15 / 15.6 GiB`       |
| 網路       | 關   | `$(cloud-download) $(cloud-upload)` | `125 KiB/s 2.34 MiB/s`  |
| CPU 溫度   | 關   | `$(flame)`                          | `52.3°C`                |
| CPU 頻率   | 關   | `$(dashboard)`                      | `3.81 GHz`              |
| 執行時間   | 關   | `$(clock)`                          | `2d 14h 32m`            |
| 磁碟 I/O   | 關   | `$(log-in) $(log-out)`              | `50.2 MiB/s 12.1 MiB/s` |
| 磁碟空間   | 關   | `$(database)`                       | `/ 45.2% 120/256 GiB`   |
| 系統發行版 | 關   | —                                   | `Ubuntu 22.04`          |

### 資源佔用視圖

側邊欄專屬面板，提供 11 項即時折線/長條圖：CPU、記憶體（活躍/已用）、網路（下行/上行）、磁碟（讀取/寫入）、電池、電池功率、CPU 溫度、CPU 頻率。

每張圖表包含：

- Canvas 2D 即時渲染，漸層填滿與貝茲曲線
- 自適應 Y 軸縮放，標註最小/最大值
- 折線圖/長條圖一鍵切換
- 副標題：電池健康度、充放電狀態、溫度最低值、頻率範圍
- 可調節歷史點數（10~500）

底部**資訊區**顯示執行時間、系統發行版和彩色磁碟空間進度條。執行時間和系統發行版可透過 `resourceUsage.showUptime` / `showOsDistro` 獨立開關。

### 電池功率監控（目前僅在 Windows 上提供完整實作）

本擴充套件獨有的電池功率即時監測：

- **帶符號顯示**：正值為充電，負值為放電
- **零線參考**：虛線引導線始終標出 0W 位置
- **5 樣本滑動平均**確保讀數穩定
- **健康度百分比**：目前滿充容量與設計容量之比
- **狀態檢測**：充電中 / 放電中 / 空閒

### 格式一致性

所有指標的格式化輸出（百分比、瓦特、攝氏度、GHz、位元組速率）統一遵循三個設定項：

- `showSpace`：數字與單位間是否加空格
- `singleUnit`：單位縮寫為首字母（K、M、G）
- `significantDigits`：每項指標獨立的有效數字位數

三個設定在狀態列和 Webview 中同時生效。

### CPU 效能

- **Windows**：直接呼叫 PDH 計數器（與工作管理員同源 `% Processor Utility`），CPU 利用率準確可靠。頻率透過 `% Processor Performance` 即時讀取，真實反映渦輪增壓和節能狀態變化。
- **Linux**：基於 `/proc/stat` 增量計算，免阻塞休眠，首次取樣預快取——較傳統阻塞方案快約 30 倍。

### 跨平台

- 支援本地、Remote SSH、WSL
- Windows 使用原生 Go 二進位；其餘平台自動回退 Node.js
- 多語言：English, 简体中文, 繁體中文, 日本語

## 配置

所有設定項以 `monitor-pro.*` 開頭，修改後即時熱重載。

| 設定                                        | 預設值        | 說明                                     |
| ------------------------------------------- | ------------- | ---------------------------------------- |
| `monitor-pro.metrics.*`                     | 見上表        | 開關狀態列各項指標                       |
| `monitor-pro.metricsOrder`                  | —             | 調整狀態列顯示順序                       |
| `monitor-pro.refresh-interval`              | `2000` ms     | 輪詢間隔（500~30000ms）                  |
| `monitor-pro.unitSystem`                    | `binary`      | `binary`（KiB/MiB）或 `decimal`（kB/MB） |
| `monitor-pro.showSpace`                     | `false`       | 數字與單位間是否加空格                   |
| `monitor-pro.singleUnit`                    | `false`       | 單位縮寫為首字母（K, M, G）              |
| `monitor-pro.significantDigits`             | 各指標不同    | 有效數字位數（1~6）                      |
| `monitor-pro.uptimeFormat`                  | `auto`        | 自訂格式，支援 `{d}` `{h}` `{m}` `{s}`   |
| `monitor-pro.resourceUsage.charts`          | —             | 圖表啟用/檢視/顏色                       |
| `monitor-pro.resourceUsage.samplingPoints`  | `60`          | 圖表歷史點數（10~500）                   |
| `monitor-pro.resourceUsage.showUptime`      | `true`        | 資源檢視顯示執行時間卡片                 |
| `monitor-pro.resourceUsage.showOsDistro`    | `true`        | 資源檢視顯示系統發行版卡片               |
| `monitor-pro.resourceUsage.diskSpaceMounts` | `["all"]`     | 磁碟空間圖表掛載點過濾                   |
| `monitor-pro.diskSpace`                     | `["/", "C:"]` | 狀態列磁碟空間掛載點過濾                 |

## 0.6.0 前螢幕截圖（目前版本仍保持相容）

![截圖 0](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot0.png)
![截圖 1](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot1.png)
![截圖 2](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot2.png)

## 系統需求

- VS Code 1.104+
- Windows 10/11（Go 後端需要；Linux/macOS 使用內建回退）

## 開發

參見 [CONTRIBUTING.md](./CONTRIBUTING.md)

### 快速開始

```bash
pnpm install
pnpm run compile
```

### 指令

| 命令                                | 說明                             |
| ----------------------------------- | -------------------------------- |
| `pnpm run lint`                     | 檢查 TypeScript 程式碼格式       |
| `pnpm run go:test`                  | 執行 Go 後端測試                 |
| `pnpm run go:vet`                   | 執行 Go 靜態檢查                 |
| `pnpm run go:build:win32-x64`       | 交叉編譯 Windows x64 Go 二進位   |
| `pnpm run go:build:win32-arm64`     | 交叉編譯 Windows ARM64 Go 二進位 |
| `pnpm run package:vsix:universal`   | 打包通用 VSIX（macOS/Linux）     |
| `pnpm run package:vsix:win32-x64`   | 打包 Windows x64 VSIX            |
| `pnpm run package:vsix:win32-arm64` | 打包 Windows ARM64 VSIX          |
| `pnpm run gen-l10n`                 | 從原始碼重新產生在地化檔案       |

## 靈感來源與致謝

### 靈感

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

### 致謝

- [TrafficMonitor](https://github.com/zhongyang219/TrafficMonitor)：參考其 PDH 查詢生命週期（常駐控制代碼 + 初始基線採集 + 逐次單次採集）重構了 Windows CPU 使用率監控，使讀數與工作管理員完全一致

## 回饋

問題和功能建議：[發起 issue](https://github.com/nexmoe/vscode-monitor-pro/issues)

## 支持我

來 [GitHub](https://github.com/nexmoe/vscode-monitor-pro) 點個 star 或是來 [VS Code 市集](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details) 給個好評吧！
