import type { MetricsExist } from "./constants";

/**
 * systeminformation 采集维度。
 *
 * 一个维度对应一组 SI.* 调用（或本地调用），多个 UI 指标可能共享同一维度。
 * 例如 memoryActive 与 memoryUsed 都只依赖 `mem` 维度，启用任一即需采集 `SI.mem()`。
 */
export type CollectDimension =
  | "currentLoad" // SI.currentLoad()      -> cpu
  | "mem" // SI.mem()              -> memoryActive, memoryUsed
  | "osInfo" // SI.osInfo()            -> osDistro
  | "networkStats" // SI.networkStats()       -> network
  | "fsStats" // SI.fsStats()           -> fileSystem
  | "fsSize" // SI.fsSize()            -> diskSpace
  | "cpuCurrentSpeed" // SI.cpuCurrentSpeed()    -> cpuSpeed
  | "cpuTemperature" // SI.cpuTemperature()     -> cpuTemp
  | "battery"; // SI.battery()           -> battery

/**
 * UI 指标 section -> 采集维度（SI.* 调用名）。
 *
 * 维度命名必须与 SIDataSource / collector.worker 中实际的 `need("<维度>")` 检查一致：
 * - `osDistro` 对应 `SI.osInfo()`（维度名 `osInfo`）
 * - `cpuTemp`  对应 `SI.cpuTemperature()`（维度名 `cpuTemperature`）
 * - `uptime`   本地 `os.uptime()` 计算，无需 SI 查询，但仍借用 `currentLoad` 占位以便归入采集集合
 *
 * Go 后端不使用此维度表：它直接按指标名（osDistro / cpuTemp）判断是否采集 Host 组。
 */
export const METRIC_TO_DIMENSION: Record<MetricsExist, CollectDimension> = {
  cpu: "currentLoad",
  memoryActive: "mem",
  memoryUsed: "mem",
  network: "networkStats",
  fileSystem: "fsStats",
  diskSpace: "fsSize",
  battery: "battery",
  cpuTemp: "cpuTemperature",
  cpuSpeed: "cpuCurrentSpeed",
  osDistro: "osInfo",
  uptime: "currentLoad", // uptime 本地计算，但借用此占位避免遗漏；实际不查 SI
};

/**
 * 将已启用指标集合归一化为需要采集的维度集合。
 *
 * 返回去重后的维度集合。调用方据此决定是否发起对应的 SI.* / Go 采集组调用。
 */
export function dimensionsForEnabled(
  enabled: Iterable<MetricsExist>,
): Set<CollectDimension> {
  const dims = new Set<CollectDimension>();
  for (const m of enabled) {
    const dim = METRIC_TO_DIMENSION[m];
    if (dim) {
      dims.add(dim);
    }
  }
  return dims;
}
