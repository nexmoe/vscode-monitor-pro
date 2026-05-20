import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ResourceUsageDataCollector, ResourceUsagePayload, TextMetrics } from "./resourceUsageData";
import { getFormatConfig, getResourceUsageConfig, ResourceUsageConfig } from "./configuration";
import { getMetricsEnabled, getUptimeFormat } from "./configuration";
import byteFormat from "./byteFormat";

interface FormattedPayload {
  history: ResourceUsagePayload["history"];
  formatted: Record<string, string>;
  formatConfig: ReturnType<typeof getFormatConfig>;
  textMetrics: TextMetrics;
  formattedText: Record<string, string>;
}

function formatUptime(seconds: number, format: string): string {
  if (format !== "auto") {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return format
      .replace("{d}", String(d))
      .replace("{h}", String(h))
      .replace("{m}", String(m))
      .replace("{s}", String(s));
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) { parts.push(`${d}d`); }
  if (h > 0) { parts.push(`${h}h`); }
  if (m > 0 || parts.length === 0) { parts.push(`${m}m`); }
  return parts.join(" ");
}

export class ResourceUsageProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "monitor-pro.resourceUsage";
  private _view?: vscode.WebviewView;
  private _collector: ResourceUsageDataCollector;

  constructor(extensionPath: string) {
    this._collector = new ResourceUsageDataCollector();
    this._extensionPath = extensionPath;
  }

  private _extensionPath: string;

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = this._getHtml();

    this._pushConfig(webviewView);

    this._collector.setOnData((data) => {
      if (webviewView.visible) {
        const payload = this._formatPayload(data);
        webviewView.webview.postMessage({
          type: "update",
          data: payload,
          formattedText: payload.formattedText,
          unavailableMetrics: data.unavailableMetrics,
        });
      }
    });
    this._collector.start();

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg.type === "ready") {
        this._pushConfig(webviewView);
      }
    });

    webviewView.onDidDispose(() => {
      this._collector.stop();
    });
  }

  pushConfigUpdate() {
    if (this._view) {
      this._pushConfig(this._view);
    }
  }

  private _pushConfig(webviewView: vscode.WebviewView) {
    const config = getResourceUsageConfig();
    const metricsEnabled = getMetricsEnabled();
    const labels: Record<string, string> = {
      cpu: vscode.l10n.t("resourceUsage.label.cpu"),
      memActive: vscode.l10n.t("resourceUsage.label.memActive"),
      memUsed: vscode.l10n.t("resourceUsage.label.memUsed"),
      netRx: vscode.l10n.t("resourceUsage.label.netRx"),
      netTx: vscode.l10n.t("resourceUsage.label.netTx"),
      diskRx: vscode.l10n.t("resourceUsage.label.diskRx"),
      diskWx: vscode.l10n.t("resourceUsage.label.diskWx"),
      battery: vscode.l10n.t("resourceUsage.label.battery"),
      cpuTemp: vscode.l10n.t("resourceUsage.label.cpuTemp"),
      cpuSpeed: vscode.l10n.t("resourceUsage.label.cpuSpeed"),
      diskSpace: vscode.l10n.t("resourceUsage.label.diskSpace"),
      uptime: vscode.l10n.t("resourceUsage.label.uptime"),
      osDistro: vscode.l10n.t("resourceUsage.label.osDistro"),
    };
    webviewView.webview.postMessage({
      type: "config",
      data: {
        charts: config.charts,
        diskSpaceMounts: config.diskSpaceMounts,
        showUptime: metricsEnabled.uptime,
        showOsDistro: metricsEnabled.osDistro,
        labels,
      },
    });
  }

  private _formatPayload(data: ResourceUsagePayload): FormattedPayload {
    const { current, textMetrics } = data;
    const fmtConfig = getFormatConfig();
    const isBinary = fmtConfig.unitSystem === "binary";
    const showSpace = fmtConfig.showSpace;
    const sigDigits = fmtConfig.significantDigits;

    const fmtMem = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary, space: showSpace,
        minimumSignificantDigits: sigDigits.memoryActive ?? 4,
        maximumSignificantDigits: sigDigits.memoryActive ?? 4,
        useGrouping: false,
      });

    const fmtRate = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary, space: showSpace,
        minimumSignificantDigits: sigDigits.network ?? 4,
        maximumSignificantDigits: sigDigits.network ?? 4,
        useGrouping: false,
      });

    const fmtSize = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary, space: showSpace,
        minimumSignificantDigits: 3,
        maximumSignificantDigits: 3,
        useGrouping: false,
      });

    const t = textMetrics;

    return {
      history: data.history,
      formatConfig: fmtConfig,
      formatted: {
        cpu: current.cpu.toFixed(1) + "%",
        memActive: fmtMem(current.memoryActive) + " / " + fmtMem(current.memoryTotal),
        memActivePercent: ((current.memoryActive / current.memoryTotal) * 100).toFixed(1) + "%",
        memUsed: fmtMem(current.memoryUsed) + " / " + fmtMem(current.memoryTotal),
        memUsedPercent: ((current.memoryUsed / current.memoryTotal) * 100).toFixed(1) + "%",
        netRx: fmtRate(current.networkRx) + "/s",
        netTx: fmtRate(current.networkTx) + "/s",
        diskRx: fmtRate(current.diskRx) + "/s",
        diskWx: fmtRate(current.diskWx) + "/s",
        diskSpace: current.diskSpaceUse.toFixed(1) + "%",
        battery: t.battery.hasBattery ? `${t.battery.percent}%` : vscode.l10n.t("N/A"),
        cpuTemp: t.cpuTemp > 0 ? `${t.cpuTemp.toFixed(1)}°C` : vscode.l10n.t("N/A"),
        cpuSpeed: t.cpuSpeed.avg > 0 ? `${t.cpuSpeed.avg.toFixed(2)} GHz` : vscode.l10n.t("N/A"),
      },
      textMetrics: t,
      formattedText: {
        batterySub: t.battery.hasBattery && t.battery.charging ? "\u26A1" : "",
        cpuTempSub: t.cpuTemp > 0 ? `Min: ${t.cpuTemperature.toFixed(1)}\u00B0C` : "",
        cpuSpeedSub: t.cpuSpeed.avg > 0
          ? `Min: ${t.cpuSpeed.min.toFixed(2)} / Max: ${t.cpuSpeed.max.toFixed(2)} GHz`
          : "",
        osDistro: t.osDistro || vscode.l10n.t("N/A"),
        uptime: formatUptime(t.uptime, getUptimeFormat()),
        diskSpaceMounts: JSON.stringify(t.diskSpace),
      },
    };
  }

  private _getHtml(): string {
    const nonce = getNonce();
    const htmlPath = path.join(this._extensionPath, "assets", "resourceUsageView.html");
    let html = fs.readFileSync(htmlPath, "utf-8");
    return html.replace(/__NONCE__/g, nonce);
  }
}

let _nonceId = 0;
function getNonce(): string {
  return "n" + (++_nonceId) + Math.random().toString(36).slice(2, 10);
}
