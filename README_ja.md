# Monitor Pro

[github-shield]: https://img.shields.io/github/stars/nexmoe/vscode-monitor-pro?style=social
[github-url]: https://github.com/nexmoe/vscode-monitor-pro

[![Github Repo][github-shield]][github-url]

[vscode-url]: https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro

[![VSCode Installs](https://img.shields.io/badge/install-10k+-green?logo=visual-studio-code)][vscode-url]

[English](./README.md) | [简体中文](./README_zh-cn.md) | [繁體中文](./README_zh-tw.md) | 日本語

Monitor Pro は、VS Code のステータスバーと専用の Webview パネルで動作するリアルタイムシステムリソース監視ツールです。設計当初からクロスプラットフォームとリモート開発環境のパフォーマンス監視を考慮しており、ローカル環境、Remote SSH、WSL で完全に動作します。

**ハイブリッドアーキテクチャ**を採用：Windows ではネイティブ Go バイナリが PowerShell/WMI のオーバーヘッドを回避し、`systeminformation` と比較して **10 倍以上のデータ収集速度**を実現。macOS と Linux は Node.js（`systeminformation`）データソースに自動フォールバックし、全プラットフォームでの互換性を確保します。

> [!WARNING]
>
> **破壊的変更 0.7.0**
>
> ステータスバーのデフォルト表示は CPU、アクティブメモリ、バッテリーのみになりました。その他のメトリクス（ネットワーク、CPU 温度、CPU 速度、稼働時間、ディスク I/O、ディスク容量、OS ディストリビューション）は、VSCode 設定の `monitor-pro.metrics.*` で手動で有効にする必要があります。
>
> 背景：リソース使用状況ビューの導入により、ほとんどのメトリクスは専用パネルでより適切に可視化されます。ステータスバーをコンパクトに保つことで、新しいユーザーにとってのわかりやすさが向上します。

## 0.7.0 メジャーアップデート概要

サイドパネル監視ビュー：

![サイドパネル監視ビュー](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image.png)

CPU 速度、ディスクなどの情報：

![CPU 速度、ディスクなどの情報](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-1.png)

補助パネル全画面表示：

![補助パネル全画面表示](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-2.png)

メインパネル表示：

![メインパネル表示](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-3.png)

ボトムパネルサイドバー表示：

![ボトムパネルサイドバー表示](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-4.png)

テーマ適応 — ダーク：

![テーマ適応 — ダーク](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-5.png)

棒グラフ表示デモ：

![棒グラフ表示デモ](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-6.png)

l10n — 日本語ソース：

![l10n — 日本語ソース](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-7.png)

l10n — 中国語、バッテリー残量、健全度、電力：

![l10n — 中国語、バッテリー残量、健全度、電力](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-8.png)

放電と充電のグラフ切り替え：

![放電と充電のグラフ切り替え](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/image-9.png)

## 機能

### ステータスバー

Codicon アイコンとフォーマットされた数値で表示される、11 の個別に切り替え可能なメトリクス：

| メトリック           | デフォルト | アイコン                              | 例                       |
| -------------------- | ---------- | ------------------------------------- | ------------------------ |
| CPU                  | オン       | `$(pulse)`                            | `73.2%`                  |
| アクティブメモリ     | オン       | `$(server)`                           | `4.21 / 15.6 GiB`        |
| バッテリー           | オン       | `$(plug)`                             | `85.2% (充電中)`         |
| 使用済みメモリ       | オフ       | `$(server)`                           | `8.15 / 15.6 GiB`        |
| ネットワーク         | オフ       | `$(cloud-download) $(cloud-upload)`   | `125 KiB/s 2.34 MiB/s`   |
| CPU 温度             | オフ       | `$(flame)`                            | `52.3°C`                 |
| CPU 速度             | オフ       | `$(dashboard)`                        | `3.81 GHz`               |
| 稼働時間             | オフ       | `$(clock)`                            | `2d 14h 32m`             |
| ディスク I/O         | オフ       | `$(log-in) $(log-out)`                | `50.2 MiB/s 12.1 MiB/s`  |
| ディスク容量         | オフ       | `$(database)`                         | `/ 45.2% 120/256 GiB`    |
| OS ディストリビューション | オフ    | —                                     | `Ubuntu 22.04`           |

### リソース使用状況ビュー

サイドバーの専用パネル。11 のリアルタイム折れ線/棒グラフを提供：CPU、メモリ（アクティブ/使用済み）、ネットワーク（ダウンロード/アップロード）、ディスク（読み取り/書き込み）、バッテリー、バッテリー電力、CPU 温度、CPU 速度。

各グラフの特徴：

- Canvas 2D リアルタイムレンダリング、グラデーション塗りつぶしとベジェ曲線
- 自動スケーリング Y 軸、最小値/最大値を表示
- 折れ線グラフ/棒グラフをワンクリックで切り替え
- サブタイトル：バッテリー健全度、充放電状態、温度最小値、速度範囲
- 調整可能な履歴ポイント数（10〜500）

下部の**情報セクション**には、稼働時間、OS ディストリビューション、カラー付きディスク容量プログレスバーが表示されます。稼働時間と OS ディストリビューションは `resourceUsage.showUptime` / `showOsDistro` で個別にオン/オフできます。

### バッテリー電力監視（現在は Windows でのみ完全実装）

この拡張機能独自のリアルタイムバッテリー電力監視：

- **符号付き表示**：正の値は充電中、負の値は放電中
- **ゼロ線参照**：点線のガイドラインで常に 0W の位置を表示
- **5 サンプル移動平均**で安定した測定値を確保
- **健全度パーセンテージ**：現在の満充電容量と設計容量の比率
- **状態検出**：充電中 / 放電中 / アイドル

### フォーマットの一貫性

すべてのフォーマットされた値（%、W、°C、GHz、バイトレート）は、3 つの設定オプションに統一的に従います：

- `showSpace`：数値と単位の間にスペースを入れるかどうか
- `singleUnit`：単位を最初の文字に省略（K、M、G）
- `significantDigits`：メトリックごとの有効桁数

これらの設定はステータスバーと Webview の両方に適用されます。

### CPU パフォーマンス

- **Windows**：タスクマネージャーと同じ PDH カウンター（`% Processor Utility`）を使用して正確な CPU 使用率を取得。CPU 周波数は `% Processor Performance` を介して動的に読み取られ、ターボブーストや省電力状態の変化をリアルタイムで反映。
- **Linux**：`/proc/stat` に基づく非ブロッキング差分計算とキャッシュされた初期値 — 従来のブロッキング方式と比較して約 30 倍高速。

### クロスプラットフォーム

- ローカル、Remote SSH、WSL 環境で動作
- Go バイナリは Windows のみ；他のプラットフォームでは Node.js に透過的にフォールバック
- 多言語：English, 简体中文, 繁體中文, 日本語

## 設定

すべての設定は `monitor-pro.*` の下にグループ化され、ホットリロードで即座に適用されます。

| 設定                                        | デフォルト     | 説明                                       |
| ------------------------------------------- | -------------- | ------------------------------------------ |
| `monitor-pro.metrics.*`                     | 上表参照       | 各ステータスバーメトリックのオン/オフ       |
| `monitor-pro.metricsOrder`                  | —              | ステータスバー項目の順序                   |
| `monitor-pro.refresh-interval`              | `2000` ms      | ポーリング間隔（500〜30000ms）             |
| `monitor-pro.unitSystem`                    | `binary`       | `binary`（KiB/MiB）または `decimal`（kB/MB） |
| `monitor-pro.showSpace`                     | `false`        | 数値と単位の間にスペースを入れる           |
| `monitor-pro.singleUnit`                    | `false`        | 単位を最初の文字に省略（K、M、G）          |
| `monitor-pro.significantDigits`             | メトリック毎   | 有効桁数（1〜6）                           |
| `monitor-pro.uptimeFormat`                  | `auto`         | カスタムフォーマット、`{d}` `{h}` `{m}` `{s}` をサポート |
| `monitor-pro.resourceUsage.charts`          | —              | グラフの有効化/表示/色設定                 |
| `monitor-pro.resourceUsage.samplingPoints`  | `60`           | グラフ履歴ポイント数（10〜500）            |
| `monitor-pro.resourceUsage.showUptime`      | `true`         | リソースビューに稼働時間カードを表示       |
| `monitor-pro.resourceUsage.showOsDistro`    | `true`         | リソースビューに OS 情報カードを表示       |
| `monitor-pro.resourceUsage.diskSpaceMounts` | `["all"]`      | ディスク容量グラフのマウントフィルター     |
| `monitor-pro.diskSpace`                     | `["/", "C:"]`  | ステータスバーのディスク容量マウントフィルター |

## スクリーンショット（0.6.0 以前、現在のバージョンでも互換性あり）

![Screenshot 0](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot0.png)
![Screenshot 1](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot1.png)
![Screenshot 2](https://raw.githubusercontent.com/nexmoe/vscode-monitor-pro/refs/heads/main/assets/screenshot2.png)

## システム要件

- VS Code 1.104+
- Windows 10/11（ネイティブ Go バックエンド用；Linux/macOS はビルトインフォールバックを使用）

## 開発

[CONTRIBUTING.md](./CONTRIBUTING.md) を参照

### クイックスタート

```bash
pnpm install
pnpm run compile
```

### コマンド

| コマンド                            | 説明                                   |
| ----------------------------------- | -------------------------------------- |
| `pnpm run lint`                     | TypeScript コードのリント              |
| `pnpm run go:test`                  | Go バックエンドのテストを実行          |
| `pnpm run go:vet`                   | Go 静的解析を実行                      |
| `pnpm run go:build:win32-x64`       | Windows x64 Go バイナリをクロスコンパイル |
| `pnpm run go:build:win32-arm64`     | Windows ARM64 Go バイナリをクロスコンパイル |
| `pnpm run package:vsix:universal`   | ユニバーサル VSIX をパッケージ化（macOS/Linux） |
| `pnpm run package:vsix:win32-x64`   | Windows x64 VSIX をパッケージ化        |
| `pnpm run package:vsix:win32-arm64` | Windows ARM64 VSIX をパッケージ化      |
| `pnpm run gen-l10n`                 | ソースからローカライゼーションファイルを再生成 |

## インスピレーションと謝辞

### インスピレーション

- [vscode-resource-monitor](https://github.com/chneau/vscode-resource-monitor)
- [resmon](https://github.com/Njanderson/resmon)

### 謝辞

- [TrafficMonitor](https://github.com/zhongyang219/TrafficMonitor)：その PDH クエリライフサイクル（常駐ハンドル + 初期ベースライン収集 + 毎回の単一収集）を採用し、Windows Go バックエンドの CPU 使用率監視を再構築。読み取り値がタスクマネージャーと完全に一致するようになりました。

## フィードバック

問題や機能リクエスト：[issue を報告](https://github.com/nexmoe/vscode-monitor-pro/issues)

## サポート

[GitHub](https://github.com/nexmoe/vscode-monitor-pro) でスターを付けていただくか、[VS Code マーケットプレイス](https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro&ssr=false#review-details) でレビューをお願いします！
