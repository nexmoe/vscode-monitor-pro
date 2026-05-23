import type { SystemSnapshot } from "./systemData";
import type {
  GoAllResponse,
  GoDiskIOCountersStat,
  GoNetIOCountersStat,
} from "./rawDataTypes";

interface PrevRaw {
  net: Map<string, { bytesSent: number; bytesRecv: number }>;
  disk: Map<string, { readBytes: number; writeBytes: number }>;
  ts: number;
}

function pickNonLoopback(
  interfaces: GoNetIOCountersStat[],
): GoNetIOCountersStat | undefined {
  return interfaces.find((n) => n.name !== "lo");
}

function pickPhysicalDisk(
  counters: Record<string, GoDiskIOCountersStat>,
): GoDiskIOCountersStat | undefined {
  return Object.values(counters).find((d) => !d.name.startsWith("loop"));
}

export class RawDataAdapter {
  private prev: PrevRaw | null = null;

  toSnapshot(raw: GoAllResponse): SystemSnapshot {
    const now = Date.now();
    const prev = this.prev;

    const netIfaces = raw.network.ioCounters || [];
    const diskCounters = raw.disk.ioCounters || {};

    const net = pickNonLoopback(netIfaces);
    const firstDisk = pickPhysicalDisk(diskCounters);

    const netRates = this.computeNetRates(netIfaces, prev, now);
    const diskRates = this.computeDiskRates(diskCounters, prev, now);

    this.prev = {
      net: new Map(
        netIfaces.map((n) => [
          n.name,
          { bytesSent: n.bytesSent, bytesRecv: n.bytesRecv },
        ]),
      ),
      disk: new Map(
        Object.entries(diskCounters).map(([k, v]) => [
          k,
          { readBytes: v.readBytes, writeBytes: v.writeBytes },
        ]),
      ),
      ts: now,
    };

    const cpuSpeed = this.getCpuSpeed(raw);
    const cpuTemp = this.getCpuTemp(raw);

    const virt = raw.memory.virtual || {
      total: 0,
      free: 0,
      used: 0,
      active: 0,
      available: 0,
      buffers: 0,
      cached: 0,
      slab: 0,
      sreclaimable: 0,
      writeBack: null,
      dirty: null,
    };

    return {
      timestamp: now,
      currentLoad:
        (raw.cpu.percent || []).length > 0 ? (raw.cpu.percent || [])[0] : 0,
      mem: {
        total: virt.total,
        free: virt.free,
        used: virt.used,
        active: virt.active || virt.used,
        available: virt.available,
        buffcache: virt.buffers + virt.cached,
        buffers: virt.buffers,
        cached: virt.cached,
        slab: virt.slab,
        reclaimable: virt.sreclaimable,
        swaptotal: (raw.memory.swap || {}).total || 0,
        swapused: (raw.memory.swap || {}).used || 0,
        swapfree: (raw.memory.swap || {}).free || 0,
        writeback: virt.writeBack,
        dirty: virt.dirty,
      },
      osInfo: {
        platform: (raw.host.info || {}).os || "",
        distro: (raw.host.info || {}).platform || "",
        release: (raw.host.info || {}).platformVersion || "",
        codename: (raw.host.info || {}).platformFamily || "",
        kernel: (raw.host.info || {}).kernelVersion || "",
        arch: (raw.host.info || {}).kernelArch || "",
        hostname: (raw.host.info || {}).hostname || "",
        fqdn: "",
        codepage: "",
        logofile: "",
        serial: "",
        build: "",
        servicepack: "",
        uefi: false,
      },
      networkStats: net
        ? [
            {
              iface: net.name,
              operstate: "unknown",
              rx_bytes: net.bytesRecv,
              rx_dropped: net.dropin,
              rx_errors: net.errin,
              tx_bytes: net.bytesSent,
              tx_dropped: net.dropout,
              tx_errors: net.errout,
              rx_sec: netRates.rxSec,
              tx_sec: netRates.txSec,
              ms: 0,
            },
          ]
        : [],
      fsStats: {
        rx: firstDisk?.readBytes || 0,
        wx: firstDisk?.writeBytes || 0,
        tx: (firstDisk?.readBytes || 0) + (firstDisk?.writeBytes || 0),
        rx_sec: diskRates.readSec,
        wx_sec: diskRates.writeSec,
        tx_sec:
          diskRates.readSec > 0 || diskRates.writeSec > 0
            ? diskRates.readSec + diskRates.writeSec
            : null,
        ms: 0,
      },
      fsSize: (raw.disk.usage || [])
        .filter((u) => u.total > 0)
        .map((u) => ({
          fs: u.path,
          type: u.fstype,
          size: u.total,
          used: u.used,
          available: u.free,
          use: u.total > 0 ? Math.round(u.usedPercent * 100) / 100 : 0,
          mount: u.path,
          rw: null,
        })),
      cpuCurrentSpeed: cpuSpeed,
      cpuTemperature: cpuTemp,
      gpu: { controllers: [] },
      battery: raw.battery?.hasBattery
        ? {
            hasBattery: true,
            cycleCount: 0,
            isCharging: raw.battery.state === "Charging",
            voltage: raw.battery.voltage,
            designedCapacity: raw.battery.design,
            maxCapacity: raw.battery.full,
            currentCapacity: raw.battery.current,
            capacityUnit: "mWh",
            percent: raw.battery.percent,
            health: raw.battery.health,
            powerRate: raw.battery.powerRate,
            powerState:
              raw.battery.state === "Charging" ||
              raw.battery.state === "Discharging"
                ? (raw.battery.state.toLowerCase() as
                    | "charging"
                    | "discharging")
                : "idle",
            timeRemaining: 0,
            acConnected: raw.battery.state === "Charging",
            type: "",
            model: "",
            manufacturer: "",
            serial: "",
          }
        : {
            hasBattery: false,
            cycleCount: 0,
            isCharging: false,
            voltage: 0,
            designedCapacity: 0,
            maxCapacity: 0,
            currentCapacity: 0,
            capacityUnit: "mWh",
            percent: 0,
            health: 0,
            powerRate: 0,
            powerState: "none" as const,
            timeRemaining: 0,
            acConnected: false,
            type: "",
            model: "",
            manufacturer: "",
            serial: "",
          },
      time: {
        uptime: (raw.host.info || {}).uptime || 0,
        timezone: "",
        timezoneName: "",
        current:
          Math.floor(
            ((raw.host.info || {}).bootTime || 0) +
              ((raw.host.info || {}).uptime || 0),
          ) * 1000,
      },
      unavailableMetrics: [],
    };
  }

  private computeNetRates(
    current: GoNetIOCountersStat[],
    prev: PrevRaw | null,
    now: number,
  ): { rxSec: number; txSec: number } {
    const net = pickNonLoopback(current);
    if (!net || !prev) return { rxSec: 0, txSec: 0 };
    const elapsed = (now - prev.ts) / 1000;
    if (elapsed <= 0) return { rxSec: 0, txSec: 0 };

    const p = prev.net.get(net.name);
    if (!p) return { rxSec: 0, txSec: 0 };

    return {
      rxSec: Math.max(0, (net.bytesRecv - p.bytesRecv) / elapsed),
      txSec: Math.max(0, (net.bytesSent - p.bytesSent) / elapsed),
    };
  }

  private computeDiskRates(
    current: Record<string, GoDiskIOCountersStat>,
    prev: PrevRaw | null,
    now: number,
  ): { readSec: number; writeSec: number } {
    const physical = pickPhysicalDisk(current);
    if (!physical || !prev) return { readSec: 0, writeSec: 0 };
    const elapsed = (now - prev.ts) / 1000;
    if (elapsed <= 0) return { readSec: 0, writeSec: 0 };

    const p = prev.disk.get(physical.name);
    if (!p) return { readSec: 0, writeSec: 0 };

    return {
      readSec: Math.max(0, (physical.readBytes - p.readBytes) / elapsed),
      writeSec: Math.max(0, (physical.writeBytes - p.writeBytes) / elapsed),
    };
  }

  private getCpuSpeed(raw: GoAllResponse): {
    avg: number;
    min: number;
    max: number;
    cores: number[];
  } {
    const cores = (raw.cpu.info || []).map((c) => c.mhz).filter((m) => m > 0);
    if (cores.length === 0) {
      return { avg: 0, min: 0, max: 0, cores: [] };
    }
    const min = Math.min(...cores);
    const max = Math.max(...cores);
    const avg = cores.reduce((a, b) => a + b, 0) / cores.length;
    return {
      avg: avg / 1000,
      min: min / 1000,
      max: max / 1000,
      cores: cores.map((c) => Math.round(c / 1000)),
    };
  }

  private getCpuTemp(raw: GoAllResponse): {
    main: number;
    cores: number[];
    max: number;
  } {
    const cpuSensors = (raw.host.sensors || []).filter((s) => {
      const key = s.sensorKey.toLowerCase();
      return (
        key.includes("core") ||
        key.includes("cpu") ||
        key.includes("k8") ||
        key.includes("package")
      );
    });
    if (!cpuSensors.length) {
      return { main: 0, cores: [], max: 0 };
    }
    const temps = cpuSensors.map((s) => s.temperature).filter((t) => t > 0);
    if (!temps.length) {
      return { main: 0, cores: [], max: 0 };
    }
    const main = temps[0];
    const max = Math.max(...temps);
    return { main, cores: temps, max };
  }
}
