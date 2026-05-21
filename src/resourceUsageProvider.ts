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
    this._collector.maxHistory = getResourceUsageConfig().samplingPoints;
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
      this._collector.maxHistory = getResourceUsageConfig().samplingPoints;
      this._pushConfig(this._view);
    }
  }

  private _pushConfig(webviewView: vscode.WebviewView) {
    const config = getResourceUsageConfig();
    const metricsEnabled = getMetricsEnabled();
    const labels: Record<string, string> = {
      cpu: vscode.l10n.t("CPU"),
      memActive: vscode.l10n.t("Mem Active"),
      memUsed: vscode.l10n.t("Mem Used"),
      netRx: vscode.l10n.t("Network Down"),
      netTx: vscode.l10n.t("Network Up"),
      diskRx: vscode.l10n.t("Disk Read"),
      diskWx: vscode.l10n.t("Disk Write"),
      battery: vscode.l10n.t("Battery"),
      batteryPower: vscode.l10n.t("Power (W)"),
      cpuTemp: vscode.l10n.t("CPU Temp"),
      cpuSpeed: vscode.l10n.t("CPU Speed"),
      diskSpace: vscode.l10n.t("Disk Space"),
      uptime: vscode.l10n.t("Uptime"),
      osDistro: vscode.l10n.t("OS Distro"),
    };
    webviewView.webview.postMessage({
      type: "config",
      data: {
        charts: config.charts,
        diskSpaceMounts: config.diskSpaceMounts,
        samplingPoints: config.samplingPoints,
        showUptime: config.showUptime,
        showOsDistro: config.showOsDistro,
        labels,
      },
    });
  }

  private _formatPayload(data: ResourceUsagePayload): FormattedPayload {
    const { current, textMetrics } = data;
    const fmtConfig = getFormatConfig();
    const isBinary = fmtConfig.unitSystem === "binary";
    const sp = fmtConfig.showSpace ? " " : "";
    const single = fmtConfig.singleUnit;
    const sigDigits = fmtConfig.significantDigits;

    const fmtNum = (n: number, sig?: number) =>
      n.toLocaleString(undefined, {
        minimumSignificantDigits: sig,
        maximumSignificantDigits: sig,
        useGrouping: false,
      });

    const fmtPct = (n: number, sig?: number) => fmtNum(n, sig ?? 3) + sp + "%";

    const fmtMem = (bytes: number, section?: string) =>
      byteFormat(bytes, {
        binary: isBinary, space: fmtConfig.showSpace, single,
        minimumSignificantDigits: sigDigits[section ?? "memoryActive"] ?? 4,
        maximumSignificantDigits: sigDigits[section ?? "memoryActive"] ?? 4,
        useGrouping: false,
      });

    const fmtRate = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary, space: fmtConfig.showSpace, single,
        minimumSignificantDigits: sigDigits.network ?? 4,
        maximumSignificantDigits: sigDigits.network ?? 4,
        useGrouping: false,
      });

    const fmtSize = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary, space: fmtConfig.showSpace, single,
        minimumSignificantDigits: sigDigits.diskSpace ?? 3,
        maximumSignificantDigits: sigDigits.diskSpace ?? 3,
        useGrouping: false,
      });

    const t = textMetrics;

    return {
      history: data.history,
      formatConfig: fmtConfig,
      formatted: {
        cpu: fmtPct(current.cpu, sigDigits.cpu),
        memActive: fmtMem(current.memoryActive) + sp + "/" + sp + fmtMem(current.memoryTotal),
        memActivePercent: fmtPct((current.memoryActive / current.memoryTotal) * 100),
        memUsed: fmtMem(current.memoryUsed) + sp + "/" + sp + fmtMem(current.memoryTotal),
        memUsedPercent: fmtPct((current.memoryUsed / current.memoryTotal) * 100),
        netRx: fmtRate(current.networkRx) + "/s",
        netTx: fmtRate(current.networkTx) + "/s",
        diskRx: fmtRate(current.diskRx) + "/s",
        diskWx: fmtRate(current.diskWx) + "/s",
        diskSpace: fmtPct(current.diskSpaceUse, sigDigits.diskSpace),
        battery: t.battery.hasBattery
          ? fmtNum(t.battery.percent, sigDigits.battery) + sp + "%"
          : vscode.l10n.t("N/A"),
        batteryPower: t.battery.hasBattery
          ? (t.battery.powerRate >= 0 ? "+" : "") + fmtNum(Math.abs(t.battery.powerRate), sigDigits.battery) + sp + "W"
          : vscode.l10n.t("N/A"),
        cpuTemp: t.cpuTemp > 0
          ? fmtNum(t.cpuTemp, sigDigits.cpuTemp) + sp + "°C"
          : vscode.l10n.t("N/A"),
        cpuSpeed: t.cpuSpeed.avg > 0
          ? fmtNum(t.cpuSpeed.avg, sigDigits.cpuSpeed) + sp + "GHz"
          : vscode.l10n.t("N/A"),
      },
      textMetrics: t,
      formattedText: {
        batterySub: t.battery.hasBattery
          ? `${vscode.l10n.t("Health")}: ${fmtNum(t.battery.health, sigDigits.battery)}${sp}%`
          : "",
        batteryPowerSub: t.battery.hasBattery
          ? t.battery.powerState === "charging" ? vscode.l10n.t("Charging")
          : t.battery.powerState === "discharging" ? vscode.l10n.t("Discharging")
          : vscode.l10n.t("Idle")
          : "",
        cpuTempSub: "",
        cpuSpeedSub: t.cpuSpeed.avg > 0
          ? t.cpuSpeed.min < t.cpuSpeed.max
            ? `${vscode.l10n.t("Min")}: ${fmtNum(t.cpuSpeed.min, sigDigits.cpuSpeed)} / ${vscode.l10n.t("Max")}: ${fmtNum(t.cpuSpeed.max, sigDigits.cpuSpeed)} ${sp}GHz`
            : `${fmtNum(t.cpuSpeed.avg, sigDigits.cpuSpeed)}${sp}GHz`
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
