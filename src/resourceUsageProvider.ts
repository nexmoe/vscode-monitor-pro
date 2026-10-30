import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import {
  ResourceUsageDataCollector,
  ResourceUsagePayload,
  TextMetrics,
} from "./resourceUsageData";
import {
  getFormatConfig,
  getResourceUsageConfig,
  ResourceUsageConfig,
} from "./configuration";
import { getUptimeFormat } from "./configuration";
import byteFormat from "./byteFormat";
import { formatEstimatedBatteryTime } from "./battery";
import { systemData } from "./systemData";
import { formatUptime } from "./uptime";
import {
  getResourceUsageCardsInOrder,
  type ResourceUsageCardArray,
  type ResourceUsageCardKind,
  type ResourceUsageCardView,
} from "./resourceUsageCards";

/**
 * One entry of the `cards` array in the config message: everything the webview
 * needs to render and order a card without owning any vocabulary of its own.
 */
interface ResourceUsageCardMessage {
  id: string;
  kind: ResourceUsageCardKind;
  label: string;
  enabled: boolean;
  view?: ResourceUsageCardView;
  color?: string;
  /** Present only for cards with a per-item view; absent means no toggle. */
  array?: ResourceUsageCardArray;
}

interface FormattedPayload {
  history: ResourceUsagePayload["history"];
  formatted: Record<string, string>;
  formatConfig: ReturnType<typeof getFormatConfig>;
  textMetrics: TextMetrics;
  formattedText: Record<string, string>;
}

/**
 * Build the secondary battery line for the webview.
 *
 * Split out of _formatPayload to keep the (deeply nested) SoC vs. battery
 * power branching in a single place; it is reused for the batteryPower
 * subtitle. `isSocPower` is the already-resolved data-source capability so the
 * caller does not re-derive it here.
 */
function formatBatterySubtitle(
  battery: TextMetrics["battery"],
  isSocPower: boolean,
): string {
  if (!battery.hasBattery) {
    return isSocPower && battery.powerRate !== 0
      ? vscode.l10n.t("SoC Power")
      : "";
  }

  const stateText =
    battery.powerState === "charging"
      ? vscode.l10n.t("Charging")
      : battery.powerState === "discharging"
        ? vscode.l10n.t("Discharging")
        : vscode.l10n.t("Idle");

  if (isSocPower) {
    // timeRemaining comes from SI.battery(), which on macOS is provided by
    // IOPMPowerSources. When the device is plugged in but not charging (e.g. a
    // charge limit is set), this value may return stale cached data, so it
    // should not be shown in idle or full states.
    if (
      (battery.powerState === "charging" ||
        battery.powerState === "discharging") &&
      battery.timeRemaining > 0 &&
      battery.timeRemaining < 2880
    ) {
      const h = Math.floor(battery.timeRemaining / 60);
      const m = Math.round(battery.timeRemaining % 60);
      const timeStr =
        battery.powerState === "charging"
          ? vscode.l10n.t("{0}h {1}m until full", h, m)
          : vscode.l10n.t("{0}h {1}m until empty", h, m);
      return `${stateText} · ${timeStr}`;
    }
    return stateText;
  }

  const estTime =
    battery.powerState === "charging" || battery.powerState === "discharging"
      ? formatEstimatedBatteryTime(
          battery.powerRate,
          battery.maxCapacity,
          battery.currentCapacity,
          battery.powerState === "charging",
        )
      : "";
  return estTime ? `${stateText} · ${estTime}` : stateText;
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
    const cards = getResourceUsageCardsInOrder(config.chartsOrder).map(
      (card) => {
        const settings = config.charts[card.id];
        const message: ResourceUsageCardMessage = {
          id: card.id,
          kind: card.kind,
          label: card.label,
          enabled: settings.enabled,
        };
        if (card.kind === "chart") {
          // Only real charts have a view mode and a series color; text and disk
          // cards ignore both.
          message.view = settings.view ?? card.defaultView;
          message.color = settings.color ?? card.defaultColor;
          if (card.array) {
            message.array = card.array;
          }
        }
        return message;
      },
    );
    webviewView.webview.postMessage({
      type: "config",
      data: {
        // Disabled cards are sent too: the array is the view's whole render
        // order, so dropping entries would shift every card below them and
        // a re-enabled card would have no place to return to.
        cards,
        labels: {
          // Capacity words for the disk card's per-mount hover text. They
          // describe one row's numbers rather than a card, so they stay out of
          // the card registry and its titles.
          used: vscode.l10n.t("Used"),
          total: vscode.l10n.t("Total"),
          free: vscode.l10n.t("Free"),
        },
        diskSpaceMounts: config.diskSpaceMounts,
        samplingPoints: config.samplingPoints,
        // The webview's chart vocabulary matches the data-source capability:
        // "soc" draws a zero-based scale, "battery" a signed one.
        powerMode: systemData.powerRateKind,
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
        // Fall back to 3 like the sibling formatters (fmtPct) and metrics.ts
        // so a missing significantDigits key (e.g. the user's partial object,
        // or the GPU keys before first-run config hydration) never degrades to
        // full float precision.
        minimumSignificantDigits: sig ?? 3,
        maximumSignificantDigits: sig ?? 3,
        useGrouping: false,
      });

    const fmtPct = (n: number, sig?: number) => fmtNum(n, sig ?? 3) + sp + "%";

    const fmtMem = (bytes: number, section?: string) =>
      byteFormat(bytes, {
        binary: isBinary,
        space: fmtConfig.showSpace,
        single,
        minimumSignificantDigits: sigDigits[section ?? "memoryActive"] ?? 4,
        maximumSignificantDigits: sigDigits[section ?? "memoryActive"] ?? 4,
        useGrouping: false,
      });

    const fmtRate = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary,
        space: fmtConfig.showSpace,
        single,
        minimumSignificantDigits: sigDigits.network ?? 4,
        maximumSignificantDigits: sigDigits.network ?? 4,
        useGrouping: false,
      });

    const t = textMetrics;
    const isSocPower = systemData.powerRateKind === "soc";

    return {
      history: data.history,
      formatConfig: fmtConfig,
      formatted: {
        cpu: fmtPct(current.cpu, sigDigits.cpu),
        memActive:
          fmtMem(current.memoryActive) +
          sp +
          "/" +
          sp +
          fmtMem(current.memoryTotal),
        memActivePercent: fmtPct(
          (current.memoryActive / current.memoryTotal) * 100,
        ),
        memUsed:
          fmtMem(current.memoryUsed) +
          sp +
          "/" +
          sp +
          fmtMem(current.memoryTotal),
        memUsedPercent: fmtPct(
          (current.memoryUsed / current.memoryTotal) * 100,
        ),
        netRx: fmtRate(current.networkRx) + "/s",
        netTx: fmtRate(current.networkTx) + "/s",
        diskRx: fmtRate(current.diskRx) + "/s",
        diskWx: fmtRate(current.diskWx) + "/s",
        diskSpace: fmtPct(current.diskSpaceUse, sigDigits.diskSpace),
        battery: t.battery.hasBattery
          ? fmtNum(t.battery.percent, sigDigits.battery) + sp + "%"
          : vscode.l10n.t("N/A"),
        batteryPower: (() => {
          if (isSocPower) {
            // SoC power is always a positive draw, so show it even without a battery
            return t.battery.powerRate !== 0
              ? fmtNum(t.battery.powerRate, sigDigits.battery) + sp + "W"
              : vscode.l10n.t("N/A");
          }
          // Battery net power, shown with +/- prefix when a battery exists
          return t.battery.hasBattery
            ? (t.battery.powerRate >= 0 ? "+" : "-") +
                fmtNum(Math.abs(t.battery.powerRate), sigDigits.battery) +
                sp +
                "W"
            : vscode.l10n.t("N/A");
        })(),
        cpuTemp:
          t.cpuTemp > 0
            ? fmtNum(t.cpuTemp, sigDigits.cpuTemp) + sp + "°C"
            : vscode.l10n.t("N/A"),
        cpuSpeed:
          t.cpuSpeed.avg > 0
            ? fmtNum(t.cpuSpeed.avg, sigDigits.cpuSpeed) + sp + "GHz"
            : vscode.l10n.t("N/A"),
        // A 0% reading is valid (idle GPU), so gate on card presence rather
        // than the value (UNAVAILABLE_CHECKERS already hides GPU when no cards).
        gpu:
          current.gpuCards.length > 0
            ? fmtPct(current.gpuUtilization, sigDigits.gpu)
            : vscode.l10n.t("N/A"),
        gpuTemp:
          current.gpuTemperature > 0
            ? fmtNum(current.gpuTemperature, sigDigits.gpuTemp) + sp + "°C"
            : vscode.l10n.t("N/A"),
        // Same used/total presentation as the memory active entry.
        gpuMem:
          current.gpuMemTotal > 0
            ? fmtMem(current.gpuMemUsed, "gpuMem") +
              sp +
              "/" +
              sp +
              fmtMem(current.gpuMemTotal, "gpuMem")
            : vscode.l10n.t("N/A"),
      },
      textMetrics: t,
      formattedText: {
        batterySub: t.battery.hasBattery
          ? `${vscode.l10n.t("Health")}: ${fmtNum(t.battery.health, sigDigits.battery)}${sp}%`
          : isSocPower && t.battery.powerRate !== 0
            ? vscode.l10n.t("SoC Power")
            : "",
        batteryPowerSub: formatBatterySubtitle(t.battery, isSocPower),
        cpuTempSub: "",
        cpuSpeedSub:
          t.cpuSpeed.avg > 0
            ? t.cpuSpeed.min < t.cpuSpeed.max
              ? `${vscode.l10n.t("Min")}: ${fmtNum(t.cpuSpeed.min, sigDigits.cpuSpeed)} / ${vscode.l10n.t("Max")}: ${fmtNum(t.cpuSpeed.max, sigDigits.cpuSpeed)} ${sp}GHz`
              : `${fmtNum(t.cpuSpeed.avg, sigDigits.cpuSpeed)}${sp}GHz`
            : "",
        osDistro: t.osDistro || vscode.l10n.t("N/A"),
        uptime: formatUptime(t.uptime, getUptimeFormat()),
        diskSpaceMounts: JSON.stringify(t.diskSpace),
        // Per-card metadata for the GPU array view: model name plus a
        // byte-formatted used/total memory string. Formatted here because the
        // webview has no byteFormat equivalent honoring per-metric sig digits.
        gpuCards: JSON.stringify(
          current.gpuCards.map((c) => ({
            model: c.model,
            memText:
              c.memTotal > 0
                ? fmtMem(c.memUsed, "gpuMem") +
                  sp +
                  "/" +
                  sp +
                  fmtMem(c.memTotal, "gpuMem")
                : "",
          })),
        ),
      },
    };
  }

  private _getHtml(): string {
    const nonce = getNonce();
    const htmlPath = path.join(
      this._extensionPath,
      "assets",
      "resourceUsageView.html",
    );
    let html = fs.readFileSync(htmlPath, "utf-8");
    return html
      .replace(/__NONCE__/g, nonce)
      .replace(/__LINE_CHART_TITLE__/g, vscode.l10n.t("Line chart"))
      .replace(/__BAR_CHART_TITLE__/g, vscode.l10n.t("Bar chart"))
      .replace(/__ARRAY_CHART_TITLE__/g, vscode.l10n.t("Array view"));
  }
}

let _nonceId = 0;
function getNonce(): string {
  return "n" + ++_nonceId + Math.random().toString(36).slice(2, 10);
}
