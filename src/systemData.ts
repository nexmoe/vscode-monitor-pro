import { Worker } from "worker_threads";
import * as path from "path";
import { l10n } from "vscode";
import type { DataSource } from "./dataSource";
import { SIDataSource } from "./dataSource";
import { getLogger } from "./logger";
import type { MetricsExist } from "./constants";
import type { GpuCard } from "./gpuUtil";

export interface SystemSnapshot {
  timestamp: number;
  currentLoad: number;
  // Per-CPU usage (%), ordered by core index. Empty when the active data
  // source cannot provide per-core data (e.g. the Go backend).
  currentLoadCores: number[];
  mem: {
    total: number;
    free: number;
    used: number;
    active: number;
    available: number;
    buffcache: number;
    buffers: number;
    cached: number;
    slab: number;
    reclaimable: number;
    swaptotal: number;
    swapused: number;
    swapfree: number;
    writeback: number | null;
    dirty: number | null;
  };
  osInfo: {
    platform: string;
    distro: string;
    release: string;
    codename: string;
    kernel: string;
    arch: string;
    hostname: string;
    fqdn: string;
    codepage: string;
    logofile: string;
    serial: string;
    build: string;
    servicepack: string;
    uefi: boolean | null;
  };
  networkStats: {
    iface: string;
    operstate: string;
    rx_bytes: number;
    rx_dropped: number;
    rx_errors: number;
    tx_bytes: number;
    tx_dropped: number;
    tx_errors: number;
    rx_sec: number;
    tx_sec: number;
    ms: number;
  }[];
  fsStats: {
    rx: number;
    wx: number;
    tx: number;
    rx_sec: number | null;
    wx_sec: number | null;
    tx_sec: number | null;
    ms: number;
  };
  fsSize: {
    fs: string;
    type: string;
    size: number;
    used: number;
    available: number;
    use: number;
    mount: string;
    rw: boolean | null;
  }[];
  cpuCurrentSpeed: {
    min: number;
    max: number;
    avg: number;
    cores: number[];
  };
  cpuTemperature: {
    main: number;
    cores: number[];
    max: number;
  };
  /**
   * GPU metrics exposed by the active data source.
   *
   * cards is the list of GPUs with live (NVIDIA nvidia-smi based) readings.
   * When a data source cannot provide GPU data (Go backend, mactop, or a
   * machine without NVIDIA hardware/driver), cards stays empty; the UI hides
   * all GPU charts/status entries based on this data-presence signal.
   */
  gpu: {
    cards: GpuCard[];
  };
  battery: {
    hasBattery: boolean;
    cycleCount: number;
    isCharging: boolean;
    voltage: number;
    designedCapacity: number;
    maxCapacity: number;
    currentCapacity: number;
    capacityUnit: string;
    percent: number;
    health: number;
    powerRate: number;
    powerState: "charging" | "discharging" | "full" | "idle" | "none";
    timeRemaining: number;
    acConnected: boolean;
    type: string;
    model: string;
    manufacturer: string;
    serial: string;
  };
  time: {
    uptime: number;
    timezone: string;
    timezoneName: string;
    current: number;
  };
  unavailableMetrics: string[];
}

type Listener = (data: SystemSnapshot) => void;

const UNAVAILABLE_CHECKERS: Record<string, (s: SystemSnapshot) => boolean> = {
  battery: (s) => !s.battery.hasBattery,
  batteryPower: (s) => !s.battery.hasBattery && s.battery.powerRate === 0,
  cpuTemp: (s) => s.cpuTemperature.main <= 0,
  cpuSpeed: (s) => s.cpuCurrentSpeed.avg <= 0,
  // GPU availability is expressed by data presence: no cards (no NVIDIA
  // hardware / driver / unsupported data source) hides any GPU metric.
  // gpuMem additionally needs at least one card exposing VRAM (memTotal > 0):
  // mactop's single Apple Silicon GPU has no VRAM metric and must not show a
  // bogus 0/0.
  gpu: (s) => s.gpu.cards.length === 0,
  gpuTemp: (s) => s.gpu.cards.length === 0,
  gpuMem: (s) => !s.gpu.cards.some((c) => c.memTotal > 0),
};

class SystemDataProvider {
  private _snapshot: SystemSnapshot | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _interval: number;
  private _listeners: Set<Listener> = new Set();
  private _collectPromise: Promise<SystemSnapshot> | null = null;
  private _source: DataSource;
  private _warnedMetrics = new Set<string>();
  private _useWorker = false;
  private _worker: Worker | null = null;
  // Enabled UI metric set, injected by extension. collect() forwards it to the
  // data source layer for on-demand collection.
  private _enabledMetrics: Set<MetricsExist> = new Set();
  private _workerFailed = false;
  private _consecutiveFailures = 0;

  /**
   * Generation counter that prevents stale async ticks from escaping after a
   * VS Code "Reload Window".
   *
   * When VS Code reloads a window, the extension host does not restart and the
   * module-level singleton survives. deactivate() -> stop() clears the timer
   * handle, but an async tick currently awaiting collection is not aborted; it
   * will eventually reschedule via setTimeout, making _timer non-null again.
   * When the new activate() -> start() runs, the `if (this._timer) return`
   * guard blocks the new polling loop forever.
   *
   * The generation counter is incremented on stop() and start(). Each tick
   * closure captures the generation at startup and checks it before rescheduling:
   * - Match   -> tick belongs to the current generation, allow reschedule
   * - Mismatch -> stale tick, silently exit without scheduling
   */
  private _gen = 0;
  private readonly _MAX_RETRIES = 3;

  constructor(interval = 2000) {
    this._interval = interval;
    this._source = new SIDataSource();
  }

  private _getEffectiveInterval(): number {
    if (this._consecutiveFailures <= 0) {
      return this._interval;
    }
    const backoff = Math.min(
      this._interval * Math.pow(2, this._consecutiveFailures - 1),
      30000,
    );
    return backoff;
  }

  setSource(source: DataSource) {
    this._source = source;
    this._snapshot = null;
  }

  /**
   * Inject the currently enabled metric set (status bar + webview charts union).
   *
   * This set determines which dimensions the data source layer actually queries:
   * disabled metrics do not trigger any SI.* calls or Go collection groups,
   * enabling true on-demand querying. Called by extension on hot-reload so the
   * new set takes effect on the next tick.
   */
  setEnabledMetrics(enabled: Set<MetricsExist>) {
    this._enabledMetrics = enabled;
    if (this._worker) {
      this._worker.postMessage({ type: "setEnabled", enabled: [...enabled] });
    }
  }

  useWorker() {
    this._useWorker = true;
  }

  get sourceName(): string {
    return this._source.name;
  }

  get snapshot(): SystemSnapshot | null {
    return this._snapshot;
  }

  async getSnapshot(): Promise<SystemSnapshot> {
    if (this._snapshot) {
      return this._snapshot;
    }
    return this.collect();
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    if (this._snapshot) {
      listener(this._snapshot);
    }
    return () => this._listeners.delete(listener);
  }

  start() {
    if (this._timer || this._worker) {
      return;
    }
    if (this._useWorker && !this._workerFailed) {
      this._startWorker();
      return;
    }

    // Bump the generation counter so any leftover stale tick detects it is
    // outdated and exits before rescheduling. This prevents stale ticks from
    // blocking the new polling loop after a VS Code "Reload Window".
    this._gen++;
    const gen = this._gen;

    const tick = async () => {
      try {
        const data = await this.collect();
        this._consecutiveFailures = 0;
        data.unavailableMetrics = this.computeUnavailableMetrics(data);
        this._snapshot = data;

        for (const metric of data.unavailableMetrics) {
          if (!this._warnedMetrics.has(metric)) {
            this._warnedMetrics.add(metric);
            getLogger().warn(
              l10n.t('Metric "{0}" is not available on this system', metric),
            );
          }
        }

        for (const cb of [...this._listeners]) {
          try {
            cb(data);
          } catch {
            // individual listener errors never break the polling loop
          }
        }
      } catch (e) {
        this._consecutiveFailures++;
        const logMsg =
          this._consecutiveFailures >= this._MAX_RETRIES
            ? l10n.t(
                "Collection failed ({0}x), backing off to {1}ms",
                this._consecutiveFailures,
                this._getEffectiveInterval(),
              )
            : l10n.t(
                "Collection failed: {0}",
                e instanceof Error ? e.message : String(e),
              );
        getLogger().warn(logMsg);
      }

      // Generation check: confirm this tick is still the active generation
      // before rescheduling. If it is a stale tick (gen < this._gen), stop/start
      // has already switched, so skip rescheduling and let the new tick take
      // over to avoid a lingering _timer blocking the new loop.
      if (gen !== this._gen) {
        return;
      }

      const nextInterval = this._getEffectiveInterval();
      this._timer = setTimeout(tick, nextInterval);
    };
    tick();
  }

  stop() {
    // Bump the generation counter to mark the end of the current tick
    // generation. Any stale tick still awaiting will detect the mismatch before
    // rescheduling and exit silently.
    this._gen++;

    if (this._worker) {
      this._worker.postMessage({ type: "stop" });
      this._worker.terminate();
      this._worker = null;
    }
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._consecutiveFailures = 0;
  }

  get interval() {
    return this._interval;
  }

  setInterval(ms: number) {
    if (ms === this._interval) {
      return;
    }
    this._interval = ms;
    this._consecutiveFailures = 0;
    if (this._worker) {
      this._worker.postMessage({ type: "setInterval", interval: ms });
      return;
    }
    if (this._timer) {
      this.stop();
      this.start();
    }
  }

  private _startWorker() {
    const workerPath = path.join(__dirname, "collector.worker.js");
    try {
      this._worker = new Worker(workerPath);
      this._worker.on("message", (msg: any) => {
        if (msg.type === "data") {
          const data = msg.data as SystemSnapshot;
          data.unavailableMetrics = this.computeUnavailableMetrics(data);
          this._snapshot = data;

          for (const metric of data.unavailableMetrics) {
            if (!this._warnedMetrics.has(metric)) {
              this._warnedMetrics.add(metric);
              getLogger().warn(
                l10n.t('Metric "{0}" is not available on this system', metric),
              );
            }
          }

          for (const cb of [...this._listeners]) {
            try {
              cb(data);
            } catch {
              /* individual listener errors never break the polling loop */
            }
          }
        } else if (msg.type === "error") {
          getLogger().warn(
            l10n.t("Worker collection failed: {0}", msg.error),
          );
        }
      });
      this._worker.on("error", (err) => {
        getLogger().warn(
          l10n.t(
            "Worker error: {0}, falling back to inline polling",
            err.message,
          ),
        );
        this._fallbackFromWorker();
      });
      this._worker.on("exit", (code) => {
        if (code !== 0) {
          getLogger().warn(
            l10n.t(
              "Worker exited with code {0}, falling back to inline polling",
              code,
            ),
          );
          this._fallbackFromWorker();
        }
        this._worker = null;
      });
      this._worker.postMessage({
        type: "start",
        interval: this._interval,
        enabled: [...this._enabledMetrics],
      });
    } catch (e) {
      getLogger().warn(
        l10n.t(
          "Failed to create worker: {0}, falling back to inline polling",
          String(e),
        ),
      );
      this._fallbackFromWorker();
    }
  }

  private _fallbackFromWorker() {
    this._worker?.terminate();
    this._worker = null;
    this._workerFailed = true;
    this.start();
  }

  private computeUnavailableMetrics(snap: SystemSnapshot): string[] {
    const result: string[] = [];
    for (const [key, check] of Object.entries(UNAVAILABLE_CHECKERS)) {
      if (check(snap)) result.push(key);
    }
    return result;
  }

  private collect(): Promise<SystemSnapshot> {
    if (this._collectPromise) {
      return this._collectPromise;
    }

    const sourcePromise = this._source.collect(
      this._snapshot,
      this._enabledMetrics,
    );
    const failSafe = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("collect() timed out; promise cache cleared for retry"));
      }, 2000);
    });

    this._collectPromise = Promise.race([sourcePromise, failSafe]).finally(() => {
      this._collectPromise = null;
    });
    return this._collectPromise;
  }
}

export const systemData = new SystemDataProvider();
