import { systemData, SystemSnapshot } from "./systemData";

export interface DataPoint {
  cpu: number;
  memoryActive: number;
  memoryUsed: number;
  memoryTotal: number;
  networkRx: number;
  networkTx: number;
  diskRx: number;
  diskWx: number;
}

export interface ResourceUsagePayload {
  history: DataPoint[];
  current: DataPoint;
}

export class ResourceUsageDataCollector {
  private history: DataPoint[] = [];
  private maxHistory = 60;
  private unsubscribe: (() => void) | null = null;
  private onData: ((data: ResourceUsagePayload) => void) | null = null;

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
    const point: DataPoint = {
      cpu: snap.currentLoad,
      memoryActive: snap.mem.active,
      memoryUsed: snap.mem.used,
      memoryTotal: snap.mem.total,
      networkRx: snap.networkStats?.[0]?.rx_sec || 0,
      networkTx: snap.networkStats?.[0]?.tx_sec || 0,
      diskRx: snap.fsStats.rx_sec || 0,
      diskWx: snap.fsStats.wx_sec || 0,
    };

    this.history.push(point);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    this.onData?.({
      history: [...this.history],
      current: point,
    });
  }
}
