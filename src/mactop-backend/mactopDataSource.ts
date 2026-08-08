/**
 * mactop DataSource implementation.
 *
 * Maps mactop Prometheus metrics into the unified SystemSnapshot format.
 * mactop's /metrics returns all metrics and cannot be queried on demand, so the
 * enabled set is ignored.
 *
 * Key mappings:
 * - mactop_cpu_usage_percent              -> currentLoad
 * - mactop_memory_gb{type="total|used"}   -> mem (GB -> bytes, 1024^3)
 * - mactop_network_kbytes_per_sec         -> networkStats (KB/s -> B/s, 1024)
 * - mactop_disk_kbytes_per_sec            -> fsStats (KB/s -> B/s, 1024)
 * - mactop_soc_temp_celsius               -> cpuTemperature
 * - mactop_battery_percent / _charging    -> battery (supplemented by SI battery
 *                                              for health/cycleCount)
 * - mactop_power_watts{component="total"} -> battery.powerRate (total SoC power,
 *                                              always non-negative)
 *
 * Supplemental data not provided by mactop Prometheus:
 * - SI.battery() -> cycleCount, maxCapacity, designedCapacity, health, acConnected
 *   mactop's BatteryInfo only has Present/Percent/Charging/OnACPower and no
 *   health data. Also, mactop_battery_charging only reflects IOPSIsChargingKey
 *   (whether the battery is actively charging), not AC connection status. When
 *   the battery is full but plugged in, charging=0, so SI is used to distinguish
 *   acConnected.
 * - SI.fsSize() -> disk space usage
 *   mactop Prometheus only provides disk IO rates, not capacity or used space.
 *
 * Note: battery.powerRate is reused as total SoC power, not battery net power.
 * macOS SoC power is always non-negative, so the webview chart drops the
 * negative range accordingly.
 */

import * as os from "os";
import * as SI from "systeminformation";
import { exec } from "child_process";
import { promisify } from "util";
import type { DataSource } from "../dataSource";
import type { SystemSnapshot } from "../systemData";
import type { MetricsExist } from "../constants";
import { dedupeFsSize } from "../diskSpace";
import type { MactopBackendManager } from "./mactopBackendManager";
import { findMetricValue, type PrometheusMetric } from "./prometheusParser";

const execAsync = promisify(exec);

const GB_TO_BYTES = 1024 * 1024 * 1024;
const KB_TO_BYTES = 1024;

/**
 * On macOS, SI.battery().timeRemaining comes from IOPMPowerSources which
 * returns -1 during charging (Apple removed the estimate from the UI in
 * macOS Sierra 10.12.2). pmset -g batt still provides a valid estimate in
 * both charging and discharging states, so we use it as the primary source.
 *
 * Output example (charging):
 *   Now drawing from 'AC Power' -InternalBattery-0 (id=12345678) 93%; charging; 0:11 remaining present: true
 * Output example (discharging):
 *   Now drawing from 'Battery Power' -InternalBattery-0 68%; discharging; 12:39 remaining present: true
 * When no estimate is available: "(no estimate)" instead of "H:MM remaining".
 */
async function getPmsetTimeRemaining(): Promise<number> {
  try {
    const { stdout } = await execAsync("pmset -g batt");
    const match = stdout.match(/(\d+):(\d+)\s+remaining/);
    if (match) {
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    }
    return 0;
  } catch {
    return 0;
  }
}

export class MactopDataSource implements DataSource {
  readonly name = "mactop";

  constructor(private backend: MactopBackendManager) {}

  async collect(
    prev: SystemSnapshot | null,
    _enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot> {
    const [metrics, siBat, siFsSize, siOs, pmsetTime] = await Promise.all([
      this.backend.fetchMetrics(),
      SI.battery().catch(() => null),
      SI.fsSize().catch(() => null),
      SI.osInfo().catch(() => null),
      getPmsetTimeRemaining(),
    ]);
    return this._toSnapshot(metrics, prev, siBat, siFsSize, siOs, pmsetTime);
  }

  private _toSnapshot(
    metrics: PrometheusMetric[],
    prev: SystemSnapshot | null,
    siBat: SI.Systeminformation.BatteryData | null,
    siFsSize: SI.Systeminformation.FsSizeData[] | null,
    siOs: SI.Systeminformation.OsData | null,
    pmsetTime: number,
  ): SystemSnapshot {
    const find = (name: string, labels?: Record<string, string>) =>
      findMetricValue(metrics, name, labels);

    // CPU
    const cpuUsage = find("mactop_cpu_usage_percent") ?? 0;

    // Per-core CPU usage, ordered by core index. The Go backend has no such
    // metric; mactop exposes one series per core labeled by its index.
    const cpuCoreUsage = metrics
      .filter((m) => m.name === "mactop_cpu_core_usage_percent")
      .sort(
        (a, b) =>
          (parseInt(a.labels.core ?? "0", 10) || 0) -
          (parseInt(b.labels.core ?? "0", 10) || 0),
      )
      .map((m) => m.value);

    // Memory (mactop reports GB; convert to bytes)
    const memTotalGB = find("mactop_memory_gb", { type: "total" }) ?? 0;
    const memUsedGB = find("mactop_memory_gb", { type: "used" }) ?? 0;
    const swapTotalGB = find("mactop_memory_gb", { type: "swap_total" }) ?? 0;
    const swapUsedGB = find("mactop_memory_gb", { type: "swap_used" }) ?? 0;

    const memTotal = memTotalGB * GB_TO_BYTES;
    const memUsed = memUsedGB * GB_TO_BYTES;
    const swapTotal = swapTotalGB * GB_TO_BYTES;
    const swapUsed = swapUsedGB * GB_TO_BYTES;

    // Network (mactop reports KB/s; convert to B/s)
    const netRx = (find("mactop_network_kbytes_per_sec", {
      direction: "download",
    }) ?? 0) * KB_TO_BYTES;
    const netTx = (find("mactop_network_kbytes_per_sec", {
      direction: "upload",
    }) ?? 0) * KB_TO_BYTES;

    // Disk (mactop reports KB/s; convert to B/s)
    const diskRead = (find("mactop_disk_kbytes_per_sec", {
      operation: "read",
    }) ?? 0) * KB_TO_BYTES;
    const diskWrite = (find("mactop_disk_kbytes_per_sec", {
      operation: "write",
    }) ?? 0) * KB_TO_BYTES;

    // Temperature
    const socTemp = find("mactop_soc_temp_celsius") ?? 0;

    // Battery
    const batteryPercent = find("mactop_battery_percent") ?? -1;
    const batteryCharging = find("mactop_battery_charging") ?? 0;
    const hasBattery = batteryPercent >= 0;

    // Total SoC power (always non-negative, reuses the battery.powerRate field)
    const powerTotal = find("mactop_power_watts", { component: "total" }) ?? 0;

    return {
      timestamp: Date.now(),
      currentLoad: cpuUsage,
      currentLoadCores: cpuCoreUsage,
      mem: {
        total: memTotal,
        free: memTotal - memUsed,
        used: memUsed,
        // mactop does not distinguish active vs used; treat active as used
        active: memUsed,
        available: memTotal - memUsed,
        buffcache: 0,
        buffers: 0,
        cached: 0,
        slab: 0,
        reclaimable: 0,
        swaptotal: swapTotal,
        swapused: swapUsed,
        swapfree: swapTotal - swapUsed,
        writeback: null,
        dirty: null,
      },
      osInfo: prev?.osInfo ?? {
        platform: siOs?.platform ?? "darwin",
        distro: siOs?.distro ?? "macOS",
        release: siOs?.release ?? os.release(),
        codename: siOs?.codename ?? "",
        kernel: siOs?.kernel ?? os.release(),
        arch: siOs?.arch ?? process.arch,
        hostname: siOs?.hostname ?? os.hostname(),
        fqdn: siOs?.fqdn ?? "",
        codepage: siOs?.codepage ?? "",
        logofile: siOs?.logofile ?? "",
        serial: siOs?.serial ?? "",
        build: siOs?.build ?? "",
        servicepack: siOs?.servicepack ?? "",
        uefi: siOs?.uefi ?? null,
      },
      // mactop already provides rates (KB/s), so no delta over time is needed
      networkStats: [
        {
          iface: "mactop",
          operstate: "unknown",
          rx_bytes: 0,
          rx_dropped: 0,
          rx_errors: 0,
          tx_bytes: 0,
          tx_dropped: 0,
          tx_errors: 0,
          rx_sec: netRx,
          tx_sec: netTx,
          ms: 0,
        },
      ],
      fsStats: {
        rx: 0,
        wx: 0,
        tx: 0,
        rx_sec: diskRead,
        wx_sec: diskWrite,
        tx_sec: null,
        ms: 0,
      },
      // Disk space usage: mactop Prometheus does not provide it, supplement with SI.fsSize()
      fsSize: siFsSize
        ? dedupeFsSize(siFsSize)
        : (prev?.fsSize ?? []),
      // mactop does not provide CPU frequency
      cpuCurrentSpeed: prev?.cpuCurrentSpeed ?? {
        min: 0,
        max: 0,
        avg: 0,
        cores: [],
      },
      cpuTemperature: {
        main: socTemp,
        cores: [],
        max: socTemp,
      },
      // mactop upstream exposes GPU metrics, but this iteration keeps the GPU
      // cards empty so the unified data-presence signal hides all GPU entries.
      gpu: { cards: [] },
      battery: {
        hasBattery,
        cycleCount: siBat?.cycleCount ?? 0,
        isCharging: batteryCharging === 1,
        voltage: siBat?.voltage ?? 0,
        designedCapacity: siBat?.designedCapacity ?? 0,
        maxCapacity: siBat?.maxCapacity ?? 0,
        currentCapacity: siBat?.currentCapacity ?? 0,
        capacityUnit: siBat?.capacityUnit ?? "mWh",
        percent: hasBattery ? batteryPercent : 0,
        health:
          siBat?.maxCapacity && siBat?.designedCapacity
            ? (siBat.maxCapacity / siBat.designedCapacity) * 100
            : 0,
        // Total SoC power reuses this field; always non-negative
        powerRate: powerTotal,
        powerState: hasBattery
          ? batteryCharging === 1
            ? "charging"
            : siBat?.acConnected
              ? "idle"
              : "discharging"
          : "none",
        // Use pmset -g batt time estimate (works for both charging and
        // discharging). SI.battery().timeRemaining returns -1 during charging
        // on macOS, so pmset is the primary source. Fall back to SI value
        // only if pmset returned 0 (e.g. command failed on non-macOS).
        timeRemaining: pmsetTime > 0 ? pmsetTime : (siBat?.timeRemaining ?? 0),
        acConnected: siBat?.acConnected ?? batteryCharging === 1,
        type: siBat?.type ?? "",
        model: siBat?.model ?? "",
        manufacturer: siBat?.manufacturer ?? "",
        serial: siBat?.serial ?? "",
      },
      time: {
        uptime: os.uptime(),
        timezone: "",
        timezoneName: "",
        current: Date.now(),
      },
      unavailableMetrics: [],
    };
  }
}