/**
 * mactop DataSource 实现。
 *
 * 将 mactop Prometheus 指标映射到 SystemSnapshot 统一格式。
 * mactop 的 /metrics 返回所有指标（无法按需查询），因此 enabled 集合被忽略。
 *
 * 关键映射：
 * - mactop_cpu_usage_percent              → currentLoad
 * - mactop_memory_gb{type="total|used"}   → mem (GB → bytes, 1024^3)
 * - mactop_network_kbytes_per_sec         → networkStats (KB/s → B/s, 1024)
 * - mactop_disk_kbytes_per_sec            → fsStats (KB/s → B/s, 1024)
 * - mactop_soc_temp_celsius               → cpuTemperature
 * - mactop_battery_percent / _charging    → battery (补充 SI battery 获取 health/cycleCount)
 * - mactop_power_watts{component="total"} → battery.powerRate (SoC 总功耗，始终非负)
 *
 * 补充数据（mactop Prometheus 不提供）：
 * - SI.battery() → cycleCount, maxCapacity, designedCapacity, health, acConnected
 *   mactop 的 BatteryInfo 只有 Present/Percent/Charging/OnACPower，无健康度数据。
 *   且 mactop_battery_charging 仅反映 IOPSIsChargingKey（是否正在充电），
 *   不反映 AC 连接状态——电池满电接电源时 charging=0，需 SI 区分 acConnected。
 * - SI.fsSize() → 磁盘空间使用情况
 *   mactop Prometheus 只提供磁盘 IO 速率，不提供磁盘容量/使用量。
 *
 * 注意：battery.powerRate 被复用为 SoC 总功耗，而非电池净功率。
 * macOS SoC 功率始终非负，webview 图表据此去掉负值范围。
 */

import * as os from "os";
import * as SI from "systeminformation";
import type { DataSource } from "../dataSource";
import type { SystemSnapshot } from "../systemData";
import type { MetricsExist } from "../constants";
import { dedupeFsSize } from "../diskSpace";
import type { MactopBackendManager } from "./mactopBackendManager";
import { findMetricValue, type PrometheusMetric } from "./prometheusParser";

const GB_TO_BYTES = 1024 * 1024 * 1024;
const KB_TO_BYTES = 1024;

export class MactopDataSource implements DataSource {
  readonly name = "mactop";

  constructor(private backend: MactopBackendManager) {}

  async collect(
    prev: SystemSnapshot | null,
    _enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot> {
    const [metrics, siBat, siFsSize, siOs] = await Promise.all([
      this.backend.fetchMetrics(),
      SI.battery().catch(() => null),
      SI.fsSize().catch(() => null),
      SI.osInfo().catch(() => null),
    ]);
    return this._toSnapshot(metrics, prev, siBat, siFsSize, siOs);
  }

  private _toSnapshot(
    metrics: PrometheusMetric[],
    prev: SystemSnapshot | null,
    siBat: SI.Systeminformation.BatteryData | null,
    siFsSize: SI.Systeminformation.FsSizeData[] | null,
    siOs: SI.Systeminformation.OsData | null,
  ): SystemSnapshot {
    const find = (name: string, labels?: Record<string, string>) =>
      findMetricValue(metrics, name, labels);

    // CPU
    const cpuUsage = find("mactop_cpu_usage_percent") ?? 0;

    // Memory (mactop 报告 GB，转换为 bytes)
    const memTotalGB = find("mactop_memory_gb", { type: "total" }) ?? 0;
    const memUsedGB = find("mactop_memory_gb", { type: "used" }) ?? 0;
    const swapTotalGB = find("mactop_memory_gb", { type: "swap_total" }) ?? 0;
    const swapUsedGB = find("mactop_memory_gb", { type: "swap_used" }) ?? 0;

    const memTotal = memTotalGB * GB_TO_BYTES;
    const memUsed = memUsedGB * GB_TO_BYTES;
    const swapTotal = swapTotalGB * GB_TO_BYTES;
    const swapUsed = swapUsedGB * GB_TO_BYTES;

    // Network (mactop 报告 KB/s，转换为 B/s)
    const netRx = (find("mactop_network_kbytes_per_sec", {
      direction: "download",
    }) ?? 0) * KB_TO_BYTES;
    const netTx = (find("mactop_network_kbytes_per_sec", {
      direction: "upload",
    }) ?? 0) * KB_TO_BYTES;

    // Disk (mactop 报告 KB/s，转换为 B/s)
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

    // SoC 总功耗（始终非负，复用 battery.powerRate 字段）
    const powerTotal = find("mactop_power_watts", { component: "total" }) ?? 0;

    return {
      timestamp: Date.now(),
      currentLoad: cpuUsage,
      mem: {
        total: memTotal,
        free: memTotal - memUsed,
        used: memUsed,
        // mactop 不区分 active/used，将 active 设为 used
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
      // mactop 直接提供速率（KB/s），无需前后时间戳差值计算
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
      // 磁盘空间使用情况：mactop Prometheus 不提供，用 SI.fsSize() 补充
      fsSize: siFsSize
        ? dedupeFsSize(siFsSize)
        : (prev?.fsSize ?? []),
      // mactop 不提供 CPU 频率
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
        // SoC 总功耗复用此字段，始终非负
        powerRate: powerTotal,
        powerState: hasBattery
          ? batteryCharging === 1
            ? "charging"
            : siBat?.acConnected
              ? "idle"
              : "discharging"
          : "none",
        timeRemaining: siBat?.timeRemaining ?? 0,
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
