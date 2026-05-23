import { Worker } from "worker_threads";
import * as path from "path";
import { l10n } from "vscode";
import type { DataSource } from "./dataSource";
import { SIDataSource } from "./dataSource";
import { getLogger } from "./logger";

export interface SystemSnapshot {
  timestamp: number;
  currentLoad: number;
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
  batteryPower: (s) => !s.battery.hasBattery,
  cpuTemp: (s) => s.cpuTemperature.main <= 0,
  cpuSpeed: (s) => s.cpuCurrentSpeed.avg <= 0,
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
  private _workerFailed = false;
  private _consecutiveFailures = 0;

  /**
   * 世代计数器，解决 "重新加载窗口" 后 async tick 逃逸问题。
   *
   * VS Code "重新加载窗口" 时 extension host 不重启，module 级单例存活。
   * `deactivate() → stop()` 虽然清掉了定时器句柄，但正在 await 中的 async tick()
   * 不会因此中止——它完成后续代码时会重新 `setTimeout`，导致 _timer 再次非 null。
   * 等到新 `activate() → start()` 执行时，`if (this._timer) return` 守卫拦截，新轮询永不启动。
   *
   * 每隔 _gen 递增：stop() +1，start() +1。
   * 每个 tick 闭包捕获启动时的 gen 值，重调度前检查 gen 是否匹配：
   * - 匹配  → 当前 tick 属于最新 generation，允许重调度
   * - 不匹配 → 当前 tick 已过时，静默退出（不设定时器）
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

    // 抬升世代计数器，使任何残留的旧 tick 在下一次重调度前检测到过时并退出。
    // 这防止了 VS Code "重新加载窗口" 场景下 async tick 逃逸堵塞新轮询。
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

      // 世代检查：重调度前确认当前 tick 仍是活跃一代。
      // 如果是旧 tick（gen < this._gen），说明 stop/start 已发生了切换，
      // 跳过重调度让新 tick 接替，避免 _timer 残留堵塞新轮询。
      if (gen !== this._gen) {
        return;
      }

      const nextInterval = this._getEffectiveInterval();
      this._timer = setTimeout(tick, nextInterval);
    };
    tick();
  }

  stop() {
    // 抬升世代计数器，标记当前 tick 世代已结束。
    // 正在 await 中尚未完成的旧 tick 在重调度前会检测到 gen 不匹配并静默退出。
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

    const sourcePromise = this._source.collect(this._snapshot);
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
