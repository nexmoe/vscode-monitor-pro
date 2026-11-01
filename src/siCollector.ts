import * as SI from "systeminformation";
import type { SystemSnapshot } from "./systemData";
import type { MetricsExist } from "./constants";
import { dimensionsForEnabled, type CollectDimension } from "./metricMap";
import { dedupeFsSize } from "./diskSpace";
import { resolveGpuCards } from "./gpuUtil";
import { readSysfsBatteries, toSnapshotBattery } from "./linuxBattery";

/**
 * Linux takes its battery data from the kernel's power_supply class instead of
 * systeminformation: SI reports no power there, derives designedCapacity with a
 * bitwise OR of two capacities, and converts the full and the design capacity
 * on different voltage bases, so its health figure is wrong on real hardware.
 * One source per platform keeps a snapshot from mixing the two.
 */
const IS_LINUX = process.platform === "linux";

/**
 * Collect a systeminformation snapshot for the enabled metric set.
 *
 * Single implementation shared by the main-thread SIDataSource and the
 * dedicated collector worker (collector.worker.ts), so the SI.* fan-out and
 * snapshot assembly exist in exactly one place. Disabled dimensions are never
 * queried; the previous snapshot is reused to keep rate continuity.
 *
 * Only pure collection logic lives here: no `vscode` import, so the worker
 * thread can bundle it safely.
 */
export async function collectSISnapshot(
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
      need("fsStats") ? SI.fsStats().catch(() => null) : Promise.resolve(null),
      need("fsSize") ? SI.fsSize().catch(() => null) : Promise.resolve(null),
      need("cpuCurrentSpeed")
        ? SI.cpuCurrentSpeed().catch(() => null)
        : Promise.resolve(null),
      need("cpuTemperature")
        ? SI.cpuTemperature().catch(() => null)
        : Promise.resolve(null),
      // Linux never asks systeminformation for the battery; see IS_LINUX.
      need("battery") && !IS_LINUX
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
    currentLoadCores:
      cl?.cpus?.map((c) => c.load) ?? prev?.currentLoadCores ?? [],
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
    fsSize: fsSize ? dedupeFsSize(fsSize) : (prev?.fsSize ?? []),
    cpuCurrentSpeed: cpuSpeed ??
      prev?.cpuCurrentSpeed ?? { min: 0, max: 0, avg: 0, cores: [] },
    cpuTemperature: cpuTemp ??
      prev?.cpuTemperature ?? { main: 0, cores: [], max: 0 },
    gpu: {
      cards: need("gpu") ? await resolveGpuCards() : (prev?.gpu?.cards ?? []),
    },
    battery: collectBattery(bat, prev, need("battery")),
    time: tm ??
      prev?.time ?? { uptime: 0, timezone: "", timezoneName: "", current: 0 },
    unavailableMetrics: [],
  };
}

/**
 * Battery block of the snapshot.
 *
 * Kept in one place so the platform switch does not sit inside the snapshot
 * assembly. The sysfs read lives behind the dimension check: a disabled battery
 * dimension must not touch /sys, and the previous block is reused so the view
 * keeps showing the last known state.
 */
function collectBattery(
  siBattery: SI.Systeminformation.BatteryData | null,
  prev: SystemSnapshot | null,
  enabled: boolean,
): SystemSnapshot["battery"] {
  if (!enabled) {
    return prev?.battery ?? toSnapshotBattery(null);
  }
  if (IS_LINUX) {
    // null covers a machine without a battery (desktop, VM) and one whose nodes
    // report nothing usable; both map to the shared "no battery" block.
    return toSnapshotBattery(readSysfsBatteries());
  }
  if (siBattery !== null) {
    return fromSIBattery(siBattery);
  }
  return prev?.battery ?? toSnapshotBattery(null);
}

/**
 * Map systeminformation's battery data for the platforms that still use it.
 *
 * SI reports no power on these platforms, so powerRate stays 0; powerState is
 * derived from isCharging because SI never reports the state itself; health is
 * derived from the two capacities here so every platform carries the same
 * definition of it.
 */
function fromSIBattery(
  bat: SI.Systeminformation.BatteryData,
): SystemSnapshot["battery"] {
  return {
    hasBattery: bat.hasBattery,
    cycleCount: bat.cycleCount ?? 0,
    isCharging: bat.isCharging ?? false,
    voltage: bat.voltage ?? 0,
    designedCapacity: bat.designedCapacity ?? 0,
    maxCapacity: bat.maxCapacity ?? 0,
    currentCapacity: bat.currentCapacity ?? 0,
    capacityUnit: bat.capacityUnit ?? "mWh",
    percent: bat.percent ?? 0,
    health:
      bat.maxCapacity && bat.designedCapacity
        ? (bat.maxCapacity / bat.designedCapacity) * 100
        : 0,
    powerRate: 0,
    powerState: bat.isCharging
      ? "charging"
      : bat.hasBattery
        ? "discharging"
        : "none",
    timeRemaining: bat.timeRemaining ?? 0,
    acConnected: bat.acConnected ?? false,
    type: bat.type ?? "",
    model: bat.model ?? "",
    manufacturer: bat.manufacturer ?? "",
    serial: bat.serial ?? "",
  };
}
