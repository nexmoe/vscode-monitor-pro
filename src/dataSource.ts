import * as SI from "systeminformation";
import type { GoBackendManager } from "./goBackend";
import { RawDataAdapter } from "./rawDataAdapter";
import type { SystemSnapshot } from "./systemData";
import type { MetricsExist } from "./constants";
import { dimensionsForEnabled, type CollectDimension } from "./metricMap";
import { dedupeFsSize } from "./diskSpace";

export interface DataSource {
  readonly name: string;
  collect(
    prev: SystemSnapshot | null,
    enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot>;
}

export class GoDataSource implements DataSource {
  readonly name = "go";
  private adapter = new RawDataAdapter();

  constructor(private backend: GoBackendManager) {}

  async collect(
    _prev: SystemSnapshot | null,
    enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot> {
    const raw = await this.backend.fetchAll(enabled);
    return this.adapter.toSnapshot(raw);
  }
}

export class SIDataSource implements DataSource {
  readonly name = "systeminformation";

  async collect(
    prev: SystemSnapshot | null,
    enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot> {
    // Normalize enabled metrics to the SI dimensions that need collection.
    // Disabled dimensions are not queried at all.
    const dims = dimensionsForEnabled(enabled);

    const need = (d: CollectDimension) => dims.has(d);

    const [cl, mem, os, ns, fs, fsSize, cpuSpeed, cpuTemp, bat] =
      await Promise.all([
        need("currentLoad")
          ? SI.currentLoad().catch(() => null)
          : Promise.resolve(null),
        need("mem") ? SI.mem().catch(() => null) : Promise.resolve(null),
        need("osInfo") ? SI.osInfo().catch(() => null) : Promise.resolve(null),
        need("networkStats")
          ? SI.networkStats().catch(() => null)
          : Promise.resolve(null),
        need("fsStats")
          ? SI.fsStats().catch(() => null)
          : Promise.resolve(null),
        need("fsSize")
          ? SI.fsSize().catch(() => null)
          : Promise.resolve(null),
        need("cpuCurrentSpeed")
          ? SI.cpuCurrentSpeed().catch(() => null)
          : Promise.resolve(null),
        need("cpuTemperature")
          ? SI.cpuTemperature().catch(() => null)
          : Promise.resolve(null),
        need("battery")
          ? SI.battery().catch(() => null)
          : Promise.resolve(null),
      ]);

    // Always collect time: fsStats/networkStats rate calculations depend on the
    // delta between consecutive timestamps. Keep the timestamp even when
    // fileSystem/network are disabled to maintain prev continuity.
    let tm: SI.Systeminformation.TimeData | null = null;
    try {
      tm = SI.time();
    } catch {
      /* ignore */
    }

    return {
      timestamp: Date.now(),
      currentLoad: cl?.currentLoad ?? prev?.currentLoad ?? 0,
      mem: mem ??
        prev?.mem ?? {
          total: 0,
          free: 0,
          used: 0,
          active: 0,
          available: 0,
          buffcache: 0,
          buffers: 0,
          cached: 0,
          slab: 0,
          reclaimable: 0,
          swaptotal: 0,
          swapused: 0,
          swapfree: 0,
          writeback: null,
          dirty: null,
        },
      osInfo: os ??
        prev?.osInfo ?? {
          platform: "",
          distro: "",
          release: "",
          codename: "",
          kernel: "",
          arch: "",
          hostname: "",
          fqdn: "",
          codepage: "",
          logofile: "",
          serial: "",
          build: "",
          servicepack: "",
          uefi: false,
        },
      networkStats: ns ?? prev?.networkStats ?? [],
      fsStats: fs ??
        prev?.fsStats ?? {
          rx: 0,
          wx: 0,
          tx: 0,
          rx_sec: null,
          wx_sec: null,
          tx_sec: null,
          ms: 0,
        },
      fsSize: fsSize
        ? dedupeFsSize(fsSize)
        : (prev?.fsSize ?? []),
      cpuCurrentSpeed: cpuSpeed ??
        prev?.cpuCurrentSpeed ?? { min: 0, max: 0, avg: 0, cores: [] },
      cpuTemperature: cpuTemp ??
        prev?.cpuTemperature ?? { main: 0, cores: [], max: 0 },
      battery: bat
        ? {
            hasBattery: bat.hasBattery,
            cycleCount: bat.cycleCount ?? 0,
            isCharging: bat.isCharging ?? false,
            designedCapacity: bat.designedCapacity ?? 0,
            maxCapacity: bat.maxCapacity ?? 0,
            currentCapacity: bat.currentCapacity ?? 0,
            capacityUnit: bat.capacityUnit ?? "mWh",
            voltage: bat.voltage ?? 0,
            percent: bat.percent ?? 0,
            health:
              bat.maxCapacity && bat.designedCapacity
                ? (bat.maxCapacity / bat.designedCapacity) * 100
                : 0,
            powerRate: 0,
            powerState: bat.isCharging
              ? ("charging" as const)
              : bat.hasBattery
                ? ("discharging" as const)
                : ("none" as const),
            timeRemaining: bat.timeRemaining ?? 0,
            acConnected: bat.acConnected ?? false,
            type: bat.type ?? "",
            model: bat.model ?? "",
            manufacturer: bat.manufacturer ?? "",
            serial: bat.serial ?? "",
          }
        : (prev?.battery ?? {
            hasBattery: false,
            cycleCount: 0,
            isCharging: false,
            designedCapacity: 0,
            maxCapacity: 0,
            currentCapacity: 0,
            capacityUnit: "mWh",
            voltage: 0,
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
          }),
      time: tm ??
        prev?.time ?? { uptime: 0, timezone: "", timezoneName: "", current: 0 },
      unavailableMetrics: [],
    };
  }
}
