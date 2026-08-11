import * as vscode from "vscode";
import { RingBuffer } from "./resourceUsageData";
import { getLogger } from "./logger";

const BATCHING_LOOP = 2;

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
      getLogger().debug("LatencyMeasurer: not in remote mode, skipping start");
      return;
    }
    if (this._running) {
      return;
    }
    this._running = true;
    getLogger().info(`LatencyMeasurer: starting with interval ${this._interval}ms`);
    this._tick();
  }

  stop(): void {
    this._running = false;
    if (this._timer !== null) {
      clearTimeout(this._timer);
      this._timer = null;
      getLogger().info("LatencyMeasurer: stopped");
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
    for (let i = 0; i < BATCHING_LOOP; i++) {
      try {
        await vscode.workspace.fs.stat(uri);
      } catch {
        // skip individual stat failures
      }
    }
    const endTime = performance.now();
    const avgLatency = (endTime - startTime) / BATCHING_LOOP;

    this._lastValue = avgLatency;
    this._history.push(avgLatency);

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
