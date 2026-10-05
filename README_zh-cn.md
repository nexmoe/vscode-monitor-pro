# Monitor Pro

[github-shield]: https://img.shields.io/github/stars/nexmoe/vscode-monitor-pro?style=social
[github-url]: https://github.com/nexmoe/vscode-monitor-pro

[![Github Repo][github-shield]][github-url]

[vscode-url]: https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro

[![VSCode Installs](https://img.shields.io/badge/install-20k+-green?logo=visual-studio-code)][vscode-url]

[English](./README.md) | 简体中文 | [繁體中文](./README_zh-tw.md) | [日本語](./README_ja.md)

Monitor Pro 是一款实时系统资源监控工具，直接在 VS Code 状态栏和专属 Webview 面板中呈现。本插件在设计之初就考虑了跨平台与远程开发机性能监控的需求，在本地系统、Remote SSH、WSL 上均有完整的实现。

采用**混合架构**：Windows 上使用原生 Go 二进制，绕开 PowerShell/WMI 的开销，采集速度相比 `systeminformation` **提升 10 倍以上**；macOS Apple Silicon 机器使用 [mactop](https://github.com/metaspartan/mactop)（若已启用）通过 Prometheus HTTP 端点获取 SoC 级别指标（CPU/GPU/ANE 功率、温度）；Linux 和未启用 mactop 的 macOS 使用 Node.js (`systeminformation`) 数据源。数据源绝不会自动切换：mactop 启用期间若启动失败即停止采集，改用内置数据源是失败通知里给出的显式选项。

> [!WARNING]
>
> **破坏性变更 0.7.0**
>
> 状态栏默认仅显示 CPU、活跃内存和电池三项。其余指标（网络、CPU 温度、CPU 频率、运行时间、磁盘 I/O、磁盘空间、系统发行版）需在 VS Code 设置 `monitor-pro.metrics.*` 中手动开启。
>
> 背景：资源占用视图上线后，大多数指标在专属面板中显示效果更好。状态栏只保留最核心的三项指标，避免新用户初次安装时状态栏过于拥挤。

## 0.8 / 0.9 新增内容

- **macOS Apple Silicon（mactop）**：可选的 [mactop](https://github.com/metaspartan/mactop) 后端提供 SoC 级指标——CPU/GPU/ANE 功率、温度与 GPU 使用率。首次运行会提示一键执行 `brew install mactop`。
- **GPU 监控**：通过 `nvidia-smi` 支持 NVIDIA GPU，并借助 mactop 支持 Apple Silicon 集成 GPU——提供使用率、温度与显存（仅 NVIDIA）图表，以及单卡阵列视图。
- **瓦特功率**：Windows 显示带符号的电池净功率，Apple Silicon 显示 SoC 总功率；0W 虚线参考线与 5 样本滑动平均使读数更稳定。
- **每核 CPU 视图**：CPU 使用率与温度卡片可切换为按核心排列的网格视图。
- 另有一批修复：图表配色随主题自适应、macOS 27 电池健康度、关闭最后一个 VS Code 窗口时退出 mactop 等。

## 0.7.0 重大更新速览

右边栏监控面板：

![右边栏监控面板](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image.png)

CPU 频率、磁盘等信息：

![CPU 频率、磁盘等信息](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-1.png)

辅面板全屏视图：

![辅面板全屏视图](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-2.png)

主面板视图：

![主面板视图](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-3.png)

底面板边栏视图：

![底面板边栏视图](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-4.png)

主题自适应——暗色：

![主题自适应——暗色](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-5.png)

条形视图演示：

![条形视图演示](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-6.png)

l10n——日语源码：

![l10n——日语源码](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-7.png)

l10n——中文：电量、电池健康度与功率：

![l10n——中文：电量、电池健康度与功率](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-8.png)

放电与充电的图线切换：

![放电与充电的图线切换](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-9.png)

## 功能特性

### 状态栏

14 项可独立开关的指标，以 Codicon 图标搭配格式化数值显示：

| 指标       | 默认 | 图标                                | 示例                    |
| ---------- | ---- | ----------------------------------- | ----------------------- |
| CPU        | 开   | `$(chip)`                           | `73.2%`                 |
| 活跃内存   | 开   | `$(pie-chart)`                      | `4.21 / 15.6 GiB`       |
| 电池       | 开   | `$(plug)`                           | `85.2% (充电中)`        |
| 已用内存   | 关   | `$(pie-chart)`                      | `8.15 / 15.6 GiB`       |
| 网络       | 关   | `$(cloud-download) $(cloud-upload)` | `125 KiB/s 2.34 MiB/s`  |
| CPU 温度   | 关   | `$(flame)`                          | `52.3°C`                |
| CPU 频率   | 关   | `$(dashboard)`                      | `3.81 GHz`              |
| GPU        | 关   | `$(circuit-board)`                  | `73.2%`                 |
| GPU 温度   | 关   | `$(lightbulb-sparkle)`              | `52.3°C`                |
| GPU 显存   | 关   | `$(layers)`                         | `11.2 / 24 GiB`         |
| 运行时间   | 关   | `$(clock)`                          | `2d 14h 32m`            |
| 磁盘 I/O   | 关   | `$(log-in) $(log-out)`              | `50.2 MiB/s 12.1 MiB/s` |
| 磁盘空间   | 关   | `$(database)`                       | `/ 45.2% 120/256 GiB`   |
| 系统发行版 | 关   | —                                   | `Ubuntu 22.04`          |

> GPU 指标需要配备 `nvidia-smi` 的 NVIDIA 硬件，或使用 mactop 后端的 Apple Silicon；否则自动隐藏。GPU 显存一项还要求能读取 VRAM，而 mactop 的集成 GPU 后端不提供该数据。

### 资源占用视图

侧边栏专属面板，为 14 项指标提供实时折线图与柱状图：CPU、内存（活跃/已用）、网络（下行/上行）、磁盘（读取/写入）、电池、电池功率 / SoC 功率、CPU 温度、CPU 频率、GPU、GPU 温度、GPU 显存。在 macOS Apple Silicon 上使用 mactop 后端时，功率图会切换为 SoC 功率模式，显示芯片总功耗（CPU + GPU + ANE）。

每张图表包含：

- 基于 Canvas 2D 的实时渲染，带渐变填充与贝塞尔曲线
- 自适应 Y 轴缩放，当前最大刻度以 `↑` 前缀标注
- 折线图/柱状图一键切换
- **单核/单卡阵列视图**：CPU 使用率、CPU 温度、GPU、GPU 温度、GPU 显存卡片可切换为彩色条形网格——每个 CPU 核心（`C0`、`C1`、…）或每张显卡（`G0`、`G1`、…）对应一根条形，展示各自的使用率 / 温度 / 显存。将鼠标悬停在某个 GPU 单元上可查看显卡型号（GPU 显存视图还显示已用/总量）。
- 副标题：电池健康度、充放电状态、温度最低值、频率范围
- 历史点数可配置（10~500）

GPU 图表默认启用，在无 GPU 数据源（NVIDIA `nvidia-smi` 或 Apple Silicon 上的 mactop 后端）时自动隐藏。单卡阵列视图仅在两块及以上 GPU 时显示。

底部**信息区**显示运行时间、系统发行版和磁盘空间，并配有彩色进度条。这些信息卡属于 `resourceUsage.charts` 配置的一部分，可通过 `charts.osDistro.enabled` / `charts.uptime.enabled` / `charts.diskSpace.enabled` 开关控制（默认启用）。

### 按需查询

被关闭的指标**不会产生任何查询**——采集完全由启用项驱动。底层数据源调用（macOS/Linux 上的 `systeminformation`，Windows 上的 Go 后端）只会获取当前用到的维度：

- 状态栏 `monitor-pro.metrics.*` 开关与 Webview `resourceUsage.charts.*.enabled` 合并为同一份“已启用集合”。
- 未使用的 `SI.*` 调用、未使用的 Go 采集组（CPU / 内存 / 磁盘 / 网络 / 主机 / 电池）都会被直接跳过，而不是先查询再过滤。
- 只显示少数指标时，刷新一次的开销可以保持在很低的水平。修改任意开关后，采集会在下一次刷新时立即调整（热重载）。

### 电池 / SoC 功率监控

Monitor Pro 以瓦特为单位，支持两种模式的实时功率监测：

- **Windows**：电池净功率（充电为正、放电为负）通过原生 Go 后端获取。
- **macOS Apple Silicon**：总 SoC 功率（CPU + GPU + ANE）通过 mactop 后端获取，以非负值显示。同时包含来自 `pmset` 的电池健康度和剩余时间。

- **带符号显示**：正值为充电，负值为放电
- **0W 参考线**：虚线始终标出 0W 位置
- **5 样本滑动平均**确保读数稳定
- **健康度百分比**：当前满充容量与设计容量之比
- **状态检测**：充电中 / 放电中 / 空闲

### 格式一致性

所有指标的格式化输出（百分比、瓦特、摄氏度、GHz、字节速率）统一遵循三个配置项：

- `showSpace`：数字与单位间是否加空格
- `singleUnit`：单位缩写为首字母（K、M、G）
- `significantDigits`：每项指标独立的有效数字位数

三个配置在状态栏和 Webview 中同时生效。

### CPU 性能

- **Windows**：使用与任务管理器相同的 PDH 计数器（`% Processor Utility`），CPU 利用率读数准确。频率通过 `% Processor Performance` 实时读取，实时反映睿频与节能状态的变化。
- **Linux**：基于 `/proc/stat` 做增量计算，不阻塞等待，首次采样结果会被缓存——比传统的阻塞方案快约 30 倍。

### 跨平台

- 支持本地、Remote SSH、WSL
- Windows 使用原生 Go 二进制（原生性能）；macOS Apple Silicon 使用 mactop（SoC 指标）；Linux 与未启用 mactop 的 macOS 使用 Node.js——切换到内置数据源始终是用户的显式选择，不会是自动回退
- 多语言：英语、简体中文、繁体中文、日语

## 配置

所有配置项都归在 `monitor-pro.*` 下，修改后即时生效（热重载）。

| 配置                                        | 默认值        | 说明                                                                               |
| ------------------------------------------- | ------------- | ---------------------------------------------------------------------------------- |
| `monitor-pro.metrics.*`                     | 见上表        | 开关状态栏各项指标                                                                 |
| `monitor-pro.metricsOrder`                  | —             | 调整状态栏显示顺序                                                                 |
| `monitor-pro.mactop.enabled`                | `true`        | 启用 macOS mactop 后端（SoC 指标）及其安装提示；启用期间启动失败将停止采集而不回退 |
| `monitor-pro.refresh-interval`              | `2000` ms     | 轮询间隔（500~30000ms）                                                            |
| `monitor-pro.unitSystem`                    | `binary`      | `binary`（KiB/MiB）或 `decimal`（kB/MB）                                           |
| `monitor-pro.showSpace`                     | `false`       | 数字与单位间是否加空格                                                             |
| `monitor-pro.singleUnit`                    | `false`       | 单位缩写为首字母（K, M, G）                                                        |
| `monitor-pro.significantDigits`             | 各指标不同    | 有效数字位数（1~6）                                                                |
| `monitor-pro.uptimeFormat`                  | `auto`        | 自定义格式，支持 `{d}` `{h}` `{m}` `{s}`                                           |
| `monitor-pro.resourceUsage.charts`          | —             | 图表/卡片启用、视图、颜色（含 `osDistro`、`uptime`、`diskSpace`）                  |
| `monitor-pro.resourceUsage.samplingPoints`  | `60`          | 图表历史点数（10~500）                                                             |
| `monitor-pro.resourceUsage.diskSpaceMounts` | `["all"]`     | 磁盘空间卡片挂载点过滤                                                             |
| `monitor-pro.diskSpace`                     | `["/", "C:"]` | 状态栏磁盘空间挂载点过滤                                                           |

## 0.6.0 之前的截图（当前版本仍兼容）

![截图 0](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot0.png)
![截图 1](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot1.png)
![截图 2](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot2.png)

## 系统要求

- VS Code 1.104+
- Windows 10/11（使用原生 Go 后端时所需；其他平台走内置数据源）
- macOS 12+ Apple Silicon（可选）：安装 [mactop](https://github.com/metaspartan/mactop)（v2.1.4+）以获取 SoC 指标（`brew install mactop`）。首次运行时若检测到缺失，会提示一次是否自动安装（可通过 `monitor-pro.mactop.enabled` 关闭该提示）。mactop 启用期间若启动失败即停止采集；失败通知提供一键切换到内置数据源，若不理会安装提示，指标会一直保持停用，直到安装 mactop 或关闭该设置

## 开发

参见 [CONTRIBUTING.md](./CONTRIBUTING.md)

### 快速开始

```bash
pnpm install
pnpm run compile
```

### 命令

| 命令                                | 说明                             |
| ----------------------------------- | -------------------------------- |
| `pnpm run lint`                     | 检查 TypeScript 源码（ESLint）   |
| `pnpm run go:test`                  | 运行 Go 后端测试                 |
| `pnpm run go:vet`                   | 运行 Go 静态检查                 |
| `pnpm run go:build:win32-x64`       | 交叉编译 Windows x64 Go 二进制   |
| `pnpm run go:build:win32-arm64`     | 交叉编译 Windows ARM64 Go 二进制 |
| `pnpm run package:vsix:universal`   | 打包通用 VSIX（macOS/Linux）     |
| `pnpm run package:vsix:win32-x64`   | 打包 Windows x64 VSIX            |
| `pnpm run package:vsix:win32-arm64` | 打包 Windows ARM64 VSIX          |
| `pnpm run gen-l10n`                 | 从源码重新生成本地化文件         |
| `pnpm run l10n:check`               | 校验本地化文件与源码一致         |
| `pnpm run l10n:parity`              | 校验各语言的键完全一致           |

## 灵感来源与致谢

### 灵感

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

### 致谢

- [TrafficMonitor](https://github.com/zhongyang219/TrafficMonitor)：沿用其 PDH 查询生命周期（常驻句柄、基线采集、每次刷新只采集一次），用于 Windows Go 后端的 CPU 监控，使读数与任务管理器完全一致。

## 反馈

问题与功能建议：[提交 Issue](https://github.com/nexmoe/vscode-monitor-pro/issues)

## 支持本项目

欢迎到 [GitHub](https://github.com/nexmoe/vscode-monitor-pro) 点个 star，或在 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details) 留下评价！
