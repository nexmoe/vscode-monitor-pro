import type { MetricsExist } from "./constants";

/**
 * systeminformation collection dimensions.
 *
 * A dimension maps to a group of SI.* calls (or local computation). Multiple UI
 * metrics may share one dimension. For example, both memoryActive and
 * memoryUsed only depend on the `mem` dimension, so enabling either requires
 * collecting SI.mem().
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
  | "battery" // SI.battery()           -> battery
  | "gpu"; // SI.graphics()          -> gpu, gpuTemp, gpuMem

/**
 * UI metric section -> collection dimension (SI.* call name).
 *
 * Dimension names must match the `need("<dimension>")` checks in SIDataSource
 * and collector.worker:
 * - osDistro maps to SI.osInfo() (dimension name osInfo)
 * - cpuTemp  maps to SI.cpuTemperature() (dimension name cpuTemperature)
 * - uptime   is computed locally with os.uptime() and needs no SI query, but
 *   still borrows the currentLoad placeholder so it is included in the
 *   collection set
 *
 * The Go backend does not use this table: it decides Host group collection
 * directly from metric names (osDistro / cpuTemp).
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
  uptime: "currentLoad", // computed locally; placeholder only, SI is not queried
  // All three GPU charts (utilization / temperature / memory) come from the
  // single SI.graphics() call, so they share the gpu dimension.
  gpu: "gpu",
  gpuTemp: "gpu",
  gpuMem: "gpu",
};

/**
 * Normalize an enabled metric set into the set of dimensions that need to be
 * collected.
 *
 * Returns a deduplicated dimension set. Callers use it to decide whether to
 * issue the corresponding SI.* / Go collection group calls.
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
