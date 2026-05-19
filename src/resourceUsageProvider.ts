import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ResourceUsageDataCollector, ResourceUsagePayload } from "./resourceUsageData";
import byteFormat from "./byteFormat";
import { getFormatConfig } from "./configuration";

interface FormattedPayload {
  history: ResourceUsagePayload["history"];
  formatted: Record<string, string>;
  formatConfig: ReturnType<typeof getFormatConfig>;
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

    this._collector.setOnData((data) => {
      if (webviewView.visible) {
        webviewView.webview.postMessage({
          type: "update",
          data: this._formatPayload(data),
        });
      }
    });
    this._collector.start();

    webviewView.onDidDispose(() => {
      this._collector.stop();
    });
  }

  private _formatPayload(data: ResourceUsagePayload): FormattedPayload {
    const { current } = data;
    const fmtConfig = getFormatConfig();
    const isBinary = fmtConfig.unitSystem === "binary";
    const showSpace = fmtConfig.showSpace;
    const sigDigits = fmtConfig.significantDigits;

    const fmtMem = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary,
        space: showSpace,
        minimumSignificantDigits: sigDigits.memoryActive ?? 4,
        maximumSignificantDigits: sigDigits.memoryActive ?? 4,
        useGrouping: false,
      });

    const fmtRate = (bytes: number) =>
      byteFormat(bytes, {
        binary: isBinary,
        space: showSpace,
        minimumSignificantDigits: sigDigits.network ?? 4,
        maximumSignificantDigits: sigDigits.network ?? 4,
        useGrouping: false,
      });

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
