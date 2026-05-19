import * as SI from "systeminformation";

export interface SystemSnapshot {
  timestamp: number;
  currentLoad: number;
  mem: SI.Systeminformation.MemData;
  osInfo: SI.Systeminformation.OsData;
  networkStats: SI.Systeminformation.NetworkStatsData[];
  fsStats: SI.Systeminformation.FsStatsData;
  fsSize: SI.Systeminformation.FsSizeData[];
  cpuCurrentSpeed: SI.Systeminformation.CpuCurrentSpeedData;
  cpuTemperature: SI.Systeminformation.CpuTemperatureData;
  battery: SI.Systeminformation.BatteryData;
  time: SI.Systeminformation.TimeData;
}

type Listener = (data: SystemSnapshot) => void;

class SystemDataProvider {
  private _snapshot: SystemSnapshot | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _interval: number;
  private _listeners: Set<Listener> = new Set();
  private _collectPromise: Promise<SystemSnapshot> | null = null;

  constructor(interval = 2000) {
    this._interval = interval;
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
      const t0 = Date.now();
      try {
        const data = await this.collect();
        this._snapshot = data;
        for (const cb of [...this._listeners]) {
          try {
            cb(data);
          } catch {
            // individual listener errors never break the polling loop
          }
        }
      } catch {
        // keep the timer alive even on unexpected errors
      }
      const elapsed = Date.now() - t0;
      const delay = Math.max(this._interval - elapsed, 0);
      this._timer = setTimeout(tick, delay);
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

  private async collect(): Promise<SystemSnapshot> {
    if (this._collectPromise) {
      return this._collectPromise;
    }
    this._collectPromise = this.doCollect();
    return this._collectPromise;
  }

  private async doCollect(): Promise<SystemSnapshot> {
    const prev = this._snapshot;

    const [cl, mem, os, ns, fs, fsSize, cpuSpeed, cpuTemp, bat] = await Promise.all([
      SI.currentLoad().catch(() => null),
      SI.mem().catch(() => null),
      SI.osInfo().catch(() => null),
      SI.networkStats().catch(() => null),
      SI.fsStats().catch(() => null),
      SI.fsSize().catch(() => null),
      SI.cpuCurrentSpeed().catch(() => null),
      SI.cpuTemperature().catch(() => null),
      SI.battery().catch(() => null),
    ]);
    let tm: SI.Systeminformation.TimeData | null = null;
    try { tm = SI.time(); } catch { /* ignore */ }

    this._collectPromise = null;

    return {
      timestamp: Date.now(),
      currentLoad: cl?.currentLoad ?? prev?.currentLoad ?? 0,
      mem: mem ?? prev?.mem ?? { total: 0, free: 0, used: 0, active: 0, available: 0, buffcache: 0, buffers: 0, cached: 0, slab: 0, reclaimable: 0, swaptotal: 0, swapused: 0, swapfree: 0, writeback: null, dirty: null },
      osInfo: os ?? prev?.osInfo ?? { platform: "", distro: "", release: "", codename: "", kernel: "", arch: "", hostname: "", fqdn: "", codepage: "", logofile: "", serial: "", build: "", servicepack: "", uefi: false },
      networkStats: ns ?? prev?.networkStats ?? [],
      // eslint-disable-next-line @typescript-eslint/naming-convention
      fsStats: fs ?? prev?.fsStats ?? { rx: 0, wx: 0, tx: 0, rx_sec: null, wx_sec: null, tx_sec: null, ms: 0 },
      fsSize: fsSize ?? prev?.fsSize ?? [],
      cpuCurrentSpeed: cpuSpeed ?? prev?.cpuCurrentSpeed ?? { min: 0, max: 0, avg: 0, cores: [] },
      cpuTemperature: cpuTemp ?? prev?.cpuTemperature ?? { main: 0, cores: [], max: 0 },
      battery: bat ?? prev?.battery ?? { hasBattery: false, cycleCount: 0, isCharging: false, designedCapacity: 0, maxCapacity: 0, currentCapacity: 0, capacityUnit: "mWh", voltage: 0, percent: 0, timeRemaining: 0, acConnected: false, type: "", model: "", manufacturer: "", serial: "" },
      time: tm ?? prev?.time ?? { uptime: 0, timezone: "", timezoneName: "", current: 0 },
    };
  }
}

export const systemData = new SystemDataProvider();
