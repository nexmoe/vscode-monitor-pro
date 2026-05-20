# Monitor Pro

[English](./README.md) | 简体中文

Monitor Pro 是一款全面的 VS Code 资源监控工具，实时跟踪系统指标。它采用**混合架构**：Windows 上使用原生 Go + gopsutil 后端实现最高性能，其他平台回退到内置的 Node.js (`systeminformation`) 数据源。

## 架构与性能

| 平台          | 后端          | 数据源                        |
| ------------- | ------------- | ----------------------------- |
| Windows       | Go + gopsutil | 通过原生二进制直接调用 OS API |
| Linux / macOS | Node.js       | `systeminformation` 库        |

### Windows 性能

在 Windows 上，扩展会启动一个轻量级的 Go 二进制 `monitor.exe`，通过 [gopsutil](https://github.com/shirou/gopsutil) 直接读取系统数据。这消除了 Node.js `systeminformation` 库所依赖的 PowerShell/WMI 查询开销，实现了 **10 倍以上的数据采集速度提升** —— 典型轮询周期从 ~200ms 降至 20ms 以下。

Go 后端通过 HTTP（localhost）与扩展通信，使用原始 JSON 协议。如果 Go 二进制不可用或启动失败，扩展会自动回退到 `systeminformation` 数据源。

## 功能特点

- [x] **CPU 使用率** — 整体利用率百分比
- [x] **CPU 频率** — 当前、平均、最低和最高频率
- [x] **CPU 温度** — 主温度和每核温度
- [x] **内存使用** — 活跃、已用、空闲、可用、缓冲区/缓存
- [x] **网络使用** — 每个网卡的接收/发送速率
- [x] **磁盘使用** — 每个挂载点的空间和 I/O 速率
- [x] **电池状态** — 百分比、充电状态、剩余时间
- [x] **操作系统发行版** — 操作系统和平台信息
- [x] **运行时间** — 系统运行时间
- [ ] **高占用率警报** _(计划中)_
- [ ] **图表仪表板** _(计划中)_

### 自定义

- [x] **排序** — 自定义状态栏中指标的显示顺序
- [x] **刷新间隔** — 可配置的轮询间隔（默认 2000ms）
- [x] **无布局移位** — 稳定的状态栏宽度
- [x] **远程 SSH** — 通过 VS Code Remote SSH 监控远程服务器
- [x] **多语言** — English, 简体中文, 繁體中文, 日本語

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

| 命令                                | 说明                             |
| ----------------------------------- | -------------------------------- |
| `pnpm run lint`                     | 检查 TypeScript 代码格式         |
| `pnpm run go:test`                  | 运行 Go 后端测试                 |
| `pnpm run go:vet`                   | 运行 Go 静态检查                 |
| `pnpm run go:build:win32-x64`       | 交叉编译 Windows x64 Go 二进制   |
| `pnpm run go:build:win32-arm64`     | 交叉编译 Windows ARM64 Go 二进制 |
| `pnpm run package:vsix:universal`   | 打包通用 VSIX（macOS/Linux）     |
| `pnpm run package:vsix:win32-x64`   | 打包 Windows x64 VSIX            |
| `pnpm run package:vsix:win32-arm64` | 打包 Windows ARM64 VSIX          |
| `pnpm run gen-l10n`                 | 从源码重新生成本地化文件         |

## 灵感来源

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

## 反馈

问题和功能建议：[github.com/nexmoe/vscode-monitor-pro/issues](https://github.com/nexmoe/vscode-monitor-pro/issues)

## 支持我

来 [GitHub](https://github.com/nexmoe/vscode-monitor-pro) 点个 star 或是来 [VS Code 市场](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details) 给个好评吧！
