import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { TaskManagerDataCollector, TaskManagerPayload } from "./taskManagerData";
import byteFormat from "./byteFormat";

interface FormattedPayload {
  history: TaskManagerPayload["history"];
  formatted: Record<string, string>;
}

export class TaskManagerProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "monitor-pro.taskManager";
  private _view?: vscode.WebviewView;
  private _collector: TaskManagerDataCollector;

  constructor(extensionPath: string) {
    this._collector = new TaskManagerDataCollector();
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

  private _formatPayload(data: TaskManagerPayload): FormattedPayload {
    const { current } = data;

    const fmtMem = (bytes: number) =>
      byteFormat(bytes, {
        binary: true,
        space: true,
        option2: { minimumSignificantDigits: 3, maximumSignificantDigits: 3 },
      });

    const fmtRate = (bytes: number) =>
      byteFormat(bytes, {
        binary: true,
        space: true,
        option2: { minimumSignificantDigits: 2, maximumSignificantDigits: 2 },
      });

    return {
      history: data.history,
      formatted: {
        cpu: current.cpu.toFixed(1) + "%",
        memActive: fmtMem(current.memoryActive) + " / " + fmtMem(current.memoryTotal),
        memActivePercent: ((current.memoryActive / current.memoryTotal) * 100).toFixed(1) + "%",
        memUsed: fmtMem(current.memoryUsed) + " / " + fmtMem(current.memoryTotal),
        memUsedPercent: ((current.memoryUsed / current.memoryTotal) * 100).toFixed(1) + "%",
        netRx: "\u2193 " + fmtRate(current.networkRx) + "/s",
        netTx: "\u2191 " + fmtRate(current.networkTx) + "/s",
        diskRx: "\u2193 " + fmtRate(current.diskRx) + "/s",
        diskWx: "\u2191 " + fmtRate(current.diskWx) + "/s",
      },
    };
  }

  private _getHtml(): string {
    const nonce = getNonce();
    const htmlPath = path.join(this._extensionPath, "assets", "taskManagerView.html");
    let html = fs.readFileSync(htmlPath, "utf-8");
    return html.replace(/__NONCE__/g, nonce);
  }
}

let _nonceId = 0;
function getNonce(): string {
  return "n" + (++_nonceId) + Math.random().toString(36).slice(2, 10);
}
