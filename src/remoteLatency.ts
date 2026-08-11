import * as vscode from "vscode";
import { RingBuffer } from "./resourceUsageData";
import { getLogger } from "./logger";

type LatencyListener = (history: number[]) => void;

export class LatencyMeasurer {
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _interval: number;
  private _history: RingBuffer<number>;
  private _listeners: Set<LatencyListener> = new Set();
  private _lastValue: number | null = null;
  private _running = false;

  constructor(interval: number, maxHistory: number) {
    this._interval = interval;
    this._history = new RingBuffer<number>(maxHistory);
  }

  get isRemote(): boolean {
    return !!vscode.env.remoteName;
  }

  get lastValue(): number | null {
    return this._lastValue;
  }

  onUpdate(cb: LatencyListener): () => void {
    this._listeners.add(cb);
    return () => {
      this._listeners.delete(cb);
    };
  }

  setInterval(ms: number): void {
    if (ms === this._interval) {
      return;
    }
    this._interval = ms;
    if (this._timer !== null) {
      this.stop();
      this.start();
    }
  }

  setMaxHistory(n: number): void {
    this._history.capacity = n;
  }

  start(): void {
    if (!this.isRemote) {
      getLogger().debug(vscode.l10n.t("LatencyMeasurer: not in remote mode, skipping start"));
      return;
    }
    if (this._running) {
      return;
    }
    this._running = true;
    getLogger().info(vscode.l10n.t("LatencyMeasurer: starting with interval {0}ms", String(this._interval)));
    this._tick();
  }

  stop(): void {
    this._running = false;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
      getLogger().info(vscode.l10n.t("LatencyMeasurer: stopped"));
    }
  }

  private _tick(): void {
    if (!this._running) {
      return;
    }
    this._timer = setTimeout(async () => {
      try {
        await this._measure();
      } catch {
        // measurement failure is handled inside _measure
      }
      this._timer = null;
      if (!this._running) {
        return;
      }
      this._tick();
    }, this._interval);
  }

  private async _measure(): Promise<void> {
    let uri: vscode.Uri;
    if (vscode.workspace.workspaceFolders?.length) {
      uri = vscode.workspace.workspaceFolders[0].uri;
    } else {
      uri = vscode.Uri.file("/").with({
        scheme: "vscode-remote",
        authority: vscode.env.remoteName,
      });
    }

    const startTime = performance.now();
    try {
      await vscode.workspace.fs.stat(uri);
    } catch {
      // Discard the sample when the round trip fails, so a transient error
      // cannot be recorded as a ~0ms latency.
      return;
    }
    const endTime = performance.now();
    const latency = endTime - startTime;

    this._lastValue = latency;
    this._history.push(latency);

    const snapshot = this._history.toArray();
    for (const cb of this._listeners) {
      try {
        cb(snapshot);
      } catch {
        // skip listener errors
      }
    }
  }
}

export const latencyMeasurer = new LatencyMeasurer(2000, 60);
