import os from "os";
import * as vscode from "vscode";
import byteFormat from "./byteFormat";
import { MetricCtrProps } from "./constants";
import { getDiskSpaceConfig, getUptimeFormat } from "./configuration";
import { systemData } from "./systemData";
import { dedupeFsSize } from "./diskSpace";
import { getLogger } from "./logger";
import { formatEstimatedBatteryTime } from "./battery";

let _binary = true;
let _space = false;
let _singleUnit = false;
let _sigDigits: Record<string, number> = {};

export function updateGlobalConfig(
  binary: boolean,
  space: boolean,
  singleUnit: boolean,
  sigDigits: Record<string, number>,
) {
  _binary = binary;
  _space = space;
  _singleUnit = singleUnit;
  _sigDigits = sigDigits;
}

function getSigDigits(section: string): number {
  return _sigDigits[section] ?? 3;
}

function fmtSigNum(n: number, sigfigs: number): string {
  if (n !== 0 && Math.abs(n) < 0.001) {
    return "0";
  }
  return n.toLocaleString(undefined, {
    minimumSignificantDigits: sigfigs,
    maximumSignificantDigits: sigfigs,
    useGrouping: false,
  });
}

const prettySig = (bytes: number, sigfigs: number): string => {
  return byteFormat(bytes, {
    binary: _binary,
    space: _space,
    single: _singleUnit,
    minimumSignificantDigits: sigfigs,
    maximumSignificantDigits: sigfigs,
    useGrouping: false,
  });
};

const cpuText = async () => {
  const sig = getSigDigits("cpu");
  const data = await systemData.getSnapshot();
  const sp = _space ? " " : "";
  const val = fmtSigNum(data.currentLoad, sig) + sp + "%";
  getLogger().debug(vscode.l10n.t("CPU load: {0}%", data.currentLoad.toFixed(2)));
  return `$(chip) ${val}`;
};

const memActiveText = async () => {
  const sig = getSigDigits("memoryActive");
  const m = (await systemData.getSnapshot()).mem;
  getLogger().debug(
    vscode.l10n.t(
      "Memory - Total: {0}, Active: {1}, Used: {2}",
      m.total,
      m.active,
      m.used,
    ),
  );
  const active = prettySig(m.active, sig);
  const total = prettySig(m.total, sig);
  return `$(pie-chart) ${active}/${total}`;
};

const memUsedText = async () => {
  const sig = getSigDigits("memoryUsed");
  const m = (await systemData.getSnapshot()).mem;
  const used = prettySig(m.used, sig);
  const total = prettySig(m.total, sig);
  return `$(pie-chart) ${used}/${total}`;
};

const netText = async () => {
  const sig = getSigDigits("network");
  const ns = (await systemData.getSnapshot()).networkStats;
  const rawRx = ns?.[0]?.rx_sec;
  const rawTx = ns?.[0]?.tx_sec;
  const rx = rawRx || 0;
  const tx = rawTx || 0;
  getLogger().debug(
    vscode.l10n.t(
      "Network - RX: {0}/s, TX: {1}/s, Interface: {2}",
      rawRx,
      rawTx,
      ns?.[0]?.iface,
    ),
  );
  return `$(cloud-download) ${prettySig(rx, sig)}/s $(cloud-upload) ${prettySig(tx, sig)}/s`;
};

const fsText = async () => {
  const sig = getSigDigits("fileSystem");
  const fs = (await systemData.getSnapshot()).fsStats;
  getLogger().debug(
    vscode.l10n.t(
      "Filesystem - RX: {0}/s, WX: {1}/s, Total RX: {2}, Total WX: {3}, Interval: {4}ms",
      fs.rx_sec?.toString() ?? "null",
      fs.wx_sec?.toString() ?? "null",
      fs.rx,
      fs.wx,
      fs.ms,
    ),
  );
  return `$(log-in) ${prettySig(fs.rx_sec || 0, sig)}/s $(log-out) ${prettySig(fs.wx_sec || 0, sig)}/s`;
};

const batteryText = async () => {
  const sig = getSigDigits("battery");
  const b = (await systemData.getSnapshot()).battery;
  getLogger().debug(
    vscode.l10n.t(
      "Battery - Has battery: {0}, Percent: {1}, Charging: {2}",
      b.hasBattery,
      b.percent,
      b.isCharging,
    ),
  );
  if (!b.hasBattery) {
    return "";
  }

  const sp = _space ? " " : "";
  const pct = fmtSigNum(b.percent, sig) + sp + "%";
  const icon = b.isCharging || b.acConnected ? "$(plug)" : "$(symbol-event)";

  // For the mactop data source, powerRate is total SoC power, not battery
  // charge/discharge rate, so it cannot be used with formatEstimatedBatteryTime.
  // Use the system-provided timeRemaining instead, and only show it while
  // charging or discharging.
  if (systemData.sourceName === "mactop") {
    if (
      (b.powerState === "charging" || b.powerState === "discharging") &&
      b.timeRemaining > 0 &&
      b.timeRemaining < 2880
    ) {
      const h = Math.floor(b.timeRemaining / 60);
      const m = Math.round(b.timeRemaining % 60);
      const timeStr =
        b.powerState === "charging"
          ? vscode.l10n.t("{0}h {1}m until full", h, m)
          : vscode.l10n.t("{0}h {1}m until empty", h, m);
      return `${icon} ${pct} · ${timeStr}`;
    }
    return `${icon} ${pct}`;
  }

  const estTime = formatEstimatedBatteryTime(
    b.powerRate,
    b.maxCapacity,
    b.currentCapacity,
    b.isCharging,
  );
  if (estTime) {
    return `${icon} ${pct} · ${estTime}`;
  }
  return `${icon} ${pct}`;
};

const cpuSpeedText = async () => {
  const sig = getSigDigits("cpuSpeed");
  const cpuCurrentSpeed = (await systemData.getSnapshot()).cpuCurrentSpeed;
  getLogger().debug(
    vscode.l10n.t(
      "CPU Speed - Avg: {0}GHz, Min: {1}GHz, Max: {2}GHz",
      cpuCurrentSpeed.avg,
      cpuCurrentSpeed.min,
      cpuCurrentSpeed.max,
    ),
  );
  if (!cpuCurrentSpeed.avg || cpuCurrentSpeed.avg === 0) {
    return "";
  }
  const sp = _space ? " " : "";
  return `$(dashboard) ${fmtSigNum(cpuCurrentSpeed.avg, sig) + sp + "GHz"}`;
};

// ── GPU status bar metrics ──
//
// All three read the shared snapshot GPU card list. Multi-card aggregation:
// utilization = mean, temperature = max, memory = sum (consistent with the
// webview charts). An empty card list (no NVIDIA hardware / driver, or a data
// source without GPU support) yields an empty string so the status entry hides.

const gpuText = async () => {
  const sig = getSigDigits("gpu");
  const cards = (await systemData.getSnapshot()).gpu.cards;
  if (cards.length === 0) {
    return "";
  }
  const avg = cards.reduce((s, c) => s + c.utilization, 0) / cards.length;
  getLogger().debug(
    vscode.l10n.t("GPU - Utilization: {0}% across {1} card(s)", avg.toFixed(2), cards.length),
  );
  const sp = _space ? " " : "";
  return `$(circuit-board) ${fmtSigNum(avg, sig) + sp + "%"}`;
};

const gpuTempText = async () => {
  const sig = getSigDigits("gpuTemp");
  const cards = (await systemData.getSnapshot()).gpu.cards;
  if (cards.length === 0) {
    return "";
  }
  const maxTemp = Math.max(...cards.map((c) => c.temperature));
  if (maxTemp <= 0) {
    return "";
  }
  getLogger().debug(
    vscode.l10n.t("GPU - Max temperature: {0}°C", maxTemp.toFixed(2)),
  );
  const sp = _space ? " " : "";
  return `$(lightbulb-sparkle) ${fmtSigNum(maxTemp, sig) + sp + "°C"}`;
};

const gpuMemText = async () => {
  const sig = getSigDigits("gpuMem");
  const cards = (await systemData.getSnapshot()).gpu.cards;
  if (cards.length === 0) {
    return "";
  }
  const used = cards.reduce((s, c) => s + c.memUsed, 0);
  const total = cards.reduce((s, c) => s + c.memTotal, 0);
  getLogger().debug(
    vscode.l10n.t(
      "GPU - Memory used: {0} bytes, total: {1} bytes",
      used,
      total,
    ),
  );
  // Same used/total presentation as the memory status entries.
  return `$(layers) ${prettySig(used, sig)}/${prettySig(total, sig)}`;
};

const cpuTempText = async () => {
  const sig = getSigDigits("cpuTemp");
  const cl = (await systemData.getSnapshot()).cpuTemperature;
  getLogger().debug(
    vscode.l10n.t(
      "CPU Temperature: {0}°C",
      cl.main?.toString() ?? vscode.l10n.t("N/A"),
    ),
  );
  if (!cl.main) {
    return "";
  }
  const sp = _space ? " " : "";
  return `$(flame) ${fmtSigNum(cl.main, sig) + sp + "°C"}`;
};

const osDistroText = async () => {
  const osInfo = (await systemData.getSnapshot()).osInfo;
  return `${osInfo.distro}`;
};

const diskSpaceText = async () => {
  const sig = getSigDigits("diskSpace");
  const fsSize = dedupeFsSize((await systemData.getSnapshot()).fsSize);
  const disksToShow = getDiskSpaceConfig();
  getLogger().debug(
    vscode.l10n.t(
      "Disk config: {0}, Found disks: {1}",
      JSON.stringify(disksToShow),
      fsSize.length,
    ),
  );

  const formatDisk = (disk: { mount: string; size: number; used: number }) => {
    const total = disk.size;
    const used = disk.used;
    if (total === 0) {
      getLogger().warn(vscode.l10n.t("Disk {0} has size=0, skipping", disk.mount));
      return null;
    }
    const sp = _space ? " " : "";
    const pctVal = fmtSigNum((used / total) * 100, sig) + sp + "%";
    return `$(database)${disk.mount} ${pctVal} ${prettySig(used, sig)}/${prettySig(total, sig)}`;
  };

  if (disksToShow.includes("all") && fsSize.length > 0) {
    return fsSize.map(formatDisk).filter(Boolean).join(" | ");
  }
  return fsSize
    .filter((disk) => disksToShow.includes(disk.mount))
    .map(formatDisk)
    .filter(Boolean)
    .join(" | ");
};

const uptimeText = async () => {
  const uptime = os.uptime();
  const fmt = getUptimeFormat();
  if (fmt && fmt !== "auto") {
    const days = Math.floor(uptime / (24 * 3600));
    const hours = Math.floor((uptime % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `$(clock) ${fmt.replace("{d}", String(days)).replace("{h}", String(hours)).replace("{m}", String(minutes)).replace("{s}", String(seconds))}`;
  }
  const days = Math.floor(uptime / (24 * 3600));
  const hours = Math.floor((uptime % (24 * 3600)) / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  return `$(clock) ${days}d ${hours}h ${minutes}m`;
};

const metrics: MetricCtrProps[] = [
  {
    func: cpuText,
    section: "cpu",
  },
  {
    func: memActiveText,
    section: "memoryActive",
  },
  {
    func: memUsedText,
    section: "memoryUsed",
  },
  {
    func: netText,
    section: "network",
  },
  {
    func: fsText,
    section: "fileSystem",
  },
  {
    func: batteryText,
    section: "battery",
  },
  {
    func: cpuTempText,
    section: "cpuTemp",
  },
  {
    func: cpuSpeedText,
    section: "cpuSpeed",
  },
  {
    func: gpuText,
    section: "gpu",
  },
  {
    func: gpuTempText,
    section: "gpuTemp",
  },
  {
    func: gpuMemText,
    section: "gpuMem",
  },
  {
    func: osDistroText,
    section: "osDistro",
  },
  {
    func: diskSpaceText,
    section: "diskSpace",
  },
  {
    func: uptimeText,
    section: "uptime",
  },
];

export default metrics;
