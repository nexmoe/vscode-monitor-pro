import type { DataSource } from "./dataSource";
import { SIDataSource } from "./dataSource";

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
  battery:      (s) => !s.battery.hasBattery,
  batteryPower: (s) => !s.battery.hasBattery,
  cpuTemp:      (s) => s.cpuTemperature.main <= 0,
  cpuSpeed:     (s) => s.cpuCurrentSpeed.avg <= 0,
};

class SystemDataProvider {
  private _snapshot: SystemSnapshot | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _interval: number;
  private _listeners: Set<Listener> = new Set();
  private _collectPromise: Promise<SystemSnapshot> | null = null;
  private _source: DataSource;
  private _logger?: { warn: (msg: string) => void };
  private _warnedMetrics = new Set<string>();
  private _t: (msg: string, ...args: (string | number | boolean)[]) => string = (msg) => msg;

  constructor(interval = 2000) {
    this._interval = interval;
    this._source = new SIDataSource();
  }

  setLogger(logger: { warn: (msg: string) => void }, t?: (msg: string, ...args: (string | number | boolean)[]) => string) {
    this._logger = logger;
    if (t) this._t = t;
  }

  setSource(source: DataSource) {
    this._source = source;
    this._snapshot = null;
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
    if (this._timer) {
      return;
    }
    const tick = async () => {
      try {
        const data = await this.collect();
        data.unavailableMetrics = this.computeUnavailableMetrics(data);
        this._snapshot = data;

        for (const metric of data.unavailableMetrics) {
          if (!this._warnedMetrics.has(metric)) {
            this._warnedMetrics.add(metric);
            this._logger?.warn(this._t('Metric "{0}" is not available on this system', metric));
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
        this._logger?.warn(this._t('Collection failed: {0}', e instanceof Error ? e.message : String(e)));
      }
      this._timer = setTimeout(tick, this._interval);
    };
    tick();
  }

  stop() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  get interval() {
    return this._interval;
  }

  setInterval(ms: number) {
    if (ms === this._interval) {
      return;
    }
    this._interval = ms;
    if (this._timer) {
      this.stop();
      this.start();
    }
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
    this._collectPromise = this._source.collect(this._snapshot).finally(() => {
      this._collectPromise = null;
    });
    return this._collectPromise;
  }
}

export const systemData = new SystemDataProvider();
