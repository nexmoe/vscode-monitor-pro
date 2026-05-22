import { systemData, SystemSnapshot } from "./systemData";

class RingBuffer<T> {
  private buffer: T[];
  private head = 0;
  private size = 0;
  private cap: number;

  constructor(capacity: number) {
    this.cap = Math.max(10, capacity);
    this.buffer = new Array<T>(this.cap);
  }

  get capacity(): number {
    return this.cap;
  }

  set capacity(n: number) {
    const newCap = Math.max(10, n);
    if (newCap === this.cap) return;
    const current = this.toArray();
    this.cap = newCap;
    this.buffer = new Array<T>(this.cap);
    this.head = 0;
    this.size = Math.min(current.length, this.cap);
    for (let i = 0; i < this.size; i++) {
      this.buffer[i] = current[current.length - this.size + i];
    }
  }

  get length(): number {
    return this.size;
  }

  push(item: T): void {
    this.buffer[(this.head + this.size) % this.cap] = item;
    if (this.size < this.cap) {
      this.size++;
    } else {
      this.head = (this.head + 1) % this.cap;
    }
  }

  toArray(): T[] {
    const result = new Array<T>(this.size);
    for (let i = 0; i < this.size; i++) {
      result[i] = this.buffer[(this.head + i) % this.cap];
    }
    return result;
  }

  clear(): void {
    this.head = 0;
    this.size = 0;
  }
}

export interface DataPoint {
  cpu: number;
  memoryActive: number;
  memoryUsed: number;
  memoryTotal: number;
  networkRx: number;
  networkTx: number;
  diskRx: number;
  diskWx: number;
  diskSpaceUse: number;
  batteryPercent: number;
  batteryPower: number;
  cpuTemperature: number;
  cpuSpeedAvg: number;
}

export interface DiskSpaceMount {
  fs: string;
  mount: string;
  size: number;
  used: number;
  use: number;
}

export interface TextMetrics {
  battery: { hasBattery: boolean; percent: number; charging: boolean; health: number; powerRate: number; powerState: string };
  cpuTemp: number;
  cpuSpeed: { avg: number; min: number; max: number };
  osDistro: string;
  uptime: number;
  diskSpace: DiskSpaceMount[];
}

export interface ResourceUsagePayload {
  history: DataPoint[];
  current: DataPoint;
  textMetrics: TextMetrics;
  unavailableMetrics: string[];
}

export class ResourceUsageDataCollector {
  private history = new RingBuffer<DataPoint>(60);
  private unsubscribe: (() => void) | null = null;
  private onData: ((data: ResourceUsagePayload) => void) | null = null;

  set maxHistory(n: number) {
    this.history.capacity = n;
  }

  setOnData(cb: (data: ResourceUsagePayload) => void) {
    this.onData = cb;
  }

  start() {
    if (this.unsubscribe) {
      return;
    }
    this.unsubscribe = systemData.subscribe((snap) => {
      this.pushPoint(snap);
    });
  }

  stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  private pushPoint(snap: SystemSnapshot) {
    const disks = snap.fsSize
      .filter((d) => d.size > 0)
      .sort((a, b) => a.mount.localeCompare(b.mount));
    const avgUse = disks.length > 0
      ? disks.reduce((s, d) => s + d.use, 0) / disks.length
      : 0;

    const point: DataPoint = {
      cpu: snap.currentLoad,
      memoryActive: snap.mem.active,
      memoryUsed: snap.mem.used,
      memoryTotal: snap.mem.total,
      networkRx: snap.networkStats?.[0]?.rx_sec || 0,
      networkTx: snap.networkStats?.[0]?.tx_sec || 0,
      diskRx: snap.fsStats.rx_sec || 0,
      diskWx: snap.fsStats.wx_sec || 0,
      diskSpaceUse: avgUse,
      batteryPercent: snap.battery.hasBattery ? snap.battery.percent : -1,
      batteryPower: snap.battery.hasBattery ? snap.battery.powerRate : 0,
      cpuTemperature: snap.cpuTemperature.main ?? 0,
      cpuSpeedAvg: snap.cpuCurrentSpeed.avg,
    };

    this.history.push(point);

    this.onData?.({
      history: this.history.toArray(),
      current: point,
      unavailableMetrics: snap.unavailableMetrics,
      textMetrics: {
        battery: {
          hasBattery: snap.battery.hasBattery,
          percent: snap.battery.percent,
          charging: snap.battery.isCharging || snap.battery.acConnected,
          health: snap.battery.health,
          powerRate: snap.battery.powerRate,
          powerState: snap.battery.powerState,
        },
        cpuTemp: snap.cpuTemperature.main ?? 0,
        cpuSpeed: {
          avg: snap.cpuCurrentSpeed.avg,
          min: snap.cpuCurrentSpeed.min,
          max: snap.cpuCurrentSpeed.max,
        },
        osDistro: snap.osInfo.distro
          ? `${snap.osInfo.distro} ${snap.osInfo.release}`
          : "",
        uptime: snap.time?.uptime ?? 0,
        diskSpace: disks.map((d) => ({
          fs: d.fs,
          mount: d.mount,
          size: d.size,
          used: d.used,
          use: d.use,
        })),
      },
    });
  }
}
