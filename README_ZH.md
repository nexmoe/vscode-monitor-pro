# Monitor Pro

[English](./README.md) | 简体中文

Monitor Pro 是一款实时系统资源监控工具，直接在 VS Code 状态栏和专属 Webview 面板中呈现。无论本地开发、Remote SSH 还是 WSL 环境，均可一致运行，无需图形界面。

采用**混合架构**：Windows 上使用原生 Go 二进制绕过 PowerShell/WMI 开销，实现 **10 倍以上的数据采集速度提升**；macOS 和 Linux 则自动回退到 Node.js (`systeminformation`) 数据源，确保全平台兼容。

## 功能特性

### 状态栏
11 项可独立开关的指标，以 Codicon 图标 + 格式化数值展示：

| 指标 | 默认 | 图标 | 示例 |
|------|------|------|------|
| CPU | 开 | `$(pulse)` | `73.2%` |
| 活跃内存 | 开 | `$(server)` | `4.21 / 15.6 GiB` |
| 已用内存 | 关 | `$(server)` | `8.15 / 15.6 GiB` |
| 网络 | 开 | `$(cloud-download) $(cloud-upload)` | `125 KiB/s 2.34 MiB/s` |
| 电池 | 开 | `$(plug)` | `85.2% (充电中)` |
| CPU 温度 | 开 | `$(flame)` | `52.3°C` |
| CPU 频率 | 开 | `$(dashboard)` | `3.81 GHz` |
| 运行时间 | 开 | `$(clock)` | `2d 14h 32m` |
| 磁盘 I/O | 关 | `$(log-in) $(log-out)` | `50.2 MiB/s 12.1 MiB/s` |
| 磁盘空间 | 关 | `$(database)` | `/ 45.2% 120/256 GiB` |
| 系统发行版 | 关 | — | `Ubuntu 22.04` |

### 资源占用视图
侧边栏专属面板，提供 11 项实时折线/柱状图：CPU、内存（活跃/已用）、网络（下行/上行）、磁盘（读取/写入）、电池、电池功率、CPU 温度、CPU 频率。

每张图表包含：
- Canvas 2D 实时渲染，渐变填充与贝塞尔曲线
- 自适应 Y 轴缩放，标注最小/最大值
- 折线图/柱状图一键切换
- 副标题：电池健康度、充放电状态、温度最低值、频率范围
- 可调节历史点数（10~500）

底部**信息区**显示运行时间、系统发行版和彩色磁盘空间进度条。

### 电池功率监控
本扩展独有的电池功率实时监测：
- **带符号显示**：正值为充电，负值为放电
- **5 样本滑动平均**确保读数稳定
- **健康度百分比**：当前满充容量与设计容量之比
- **状态检测**：充电中 / 放电中 / 空闲

### CPU 性能优化
- **Windows**：直接调用 PDH 计数器（与任务管理器同源 `% Processor Utility`），CPU 利用率准确可靠。频率通过 `% Processor Performance` 实时读取，真实反映睿频和节能状态变化。
- **Linux**：基于 `/proc/stat` 增量计算，免阻塞休眠，首次采样预缓存——较传统阻塞方案快约 30 倍。

### 跨平台
- 支持本地、Remote SSH、WSL
- Windows 使用原生 Go 二进制；其余平台自动回退 Node.js
- 多语言：English, 简体中文, 繁體中文, 日本語

## 配置

所有配置项以 `monitor-pro.*` 开头，修改后即时热重载生效。

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `monitor-pro.metrics.*` | 见上表 | 开关状态栏各项指标 |
| `monitor-pro.metricsOrder` | — | 调整状态栏显示顺序 |
| `monitor-pro.refresh-interval` | `2000`ms | 轮询间隔（500~30000ms） |
| `monitor-pro.unitSystem` | `binary` | `binary`（KiB/MiB）或 `decimal`（kB/MB） |
| `monitor-pro.showSpace` | `false` | 数字与单位间是否加空格 |
| `monitor-pro.singleUnit` | `false` | 单位缩写为首字母（K, M, G） |
| `monitor-pro.significantDigits` | 各指标不同 | 有效数字位数（1~6） |
| `monitor-pro.uptimeFormat` | `auto` | 自定义格式，支持 `{d}` `{h}` `{m}` `{s}` |
| `monitor-pro.resourceUsage.charts` | — | 图表启用/视图/颜色 |
| `monitor-pro.resourceUsage.samplingPoints` | `60` | 图表历史点数（10~500） |
| `monitor-pro.resourceUsage.diskSpaceMounts` | `["all"]` | 磁盘空间图表挂载点过滤 |
| `monitor-pro.diskSpace` | `["/", "C:"]` | 状态栏磁盘空间挂载点过滤 |

## 屏幕截图

![截图 0](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot0.png)
![截图 1](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot1.png)
![截图 2](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot2.png)

## 系统要求

- VS Code 1.104+
- Windows 10/11（Go 后端需要；Linux/macOS 使用内置回退）

## 开发

参见 [CONTRIBUTING.md](./CONTRIBUTING.md)

### 快速开始

```bash
pnpm install
pnpm run compile
```

### 命令

| 命令 | 说明 |
|------|------|
| `pnpm run lint` | 检查 TypeScript 代码格式 |
| `pnpm run go:test` | 运行 Go 后端测试 |
| `pnpm run go:vet` | 运行 Go 静态检查 |
| `pnpm run go:build:win32-x64` | 交叉编译 Windows x64 Go 二进制 |
| `pnpm run go:build:win32-arm64` | 交叉编译 Windows ARM64 Go 二进制 |
| `pnpm run package:vsix:universal` | 打包通用 VSIX（macOS/Linux） |
| `pnpm run package:vsix:win32-x64` | 打包 Windows x64 VSIX |
| `pnpm run package:vsix:win32-arm64` | 打包 Windows ARM64 VSIX |
| `pnpm run gen-l10n` | 从源码重新生成本地化文件 |

## 灵感来源

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

## 反馈

问题和功能建议：[发起 issue](https://github.com/nexmoe/vscode-monitor-pro/issues)

## 支持我

来 [GitHub](https://github.com/nexmoe/vscode-monitor-pro) 点个 star 或是来 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details) 给个好评吧！
