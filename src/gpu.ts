import { execFile } from "child_process";
import { promisify } from "util";
import * as SI from "systeminformation";

const execFileAsync = promisify(execFile);

export interface GPUControllerInfo {
  vendor: string;
  model: string;
  vramTotal: number;
  vramUsed: number;
  vramFree: number;
  utilization: number;
  temperature: number;
  coreClock: number;
  memoryClock: number;
}

export interface SystemGPUData {
  controllers: GPUControllerInfo[];
}

export interface GPUDataSource {
  readonly name: string;
  collect(): Promise<SystemGPUData>;
}

const NVIDIA_SMI_QUERY =
  "index,name,temperature.gpu,utilization.gpu,memory.total,memory.used,memory.free,clocks.current.graphics,clocks.current.memory";

function parseNvidiaSmi(stdout: string): GPUControllerInfo[] {
  return stdout
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const parts = line.split(",").map((s) => s.trim());
      return {
        vendor: "NVIDIA",
        model: parts[1] || "",
        vramTotal: parseInt(parts[4], 10) || 0,
        vramUsed: parseInt(parts[5], 10) || 0,
        vramFree: parseInt(parts[6], 10) || 0,
        utilization: parseInt(parts[3], 10) ?? 0,
        temperature: parseInt(parts[2], 10) ?? 0,
        coreClock: parseInt(parts[7], 10) || 0,
        memoryClock: parseInt(parts[8], 10) || 0,
      };
    });
}

export class SIGPUDataSource implements GPUDataSource {
  readonly name = "systeminformation";

  async collect(): Promise<SystemGPUData> {
    const fromSi = await this.collectFromSi();
    if (fromSi.controllers.length > 0) return fromSi;

    const fromNvidiaSmi = await this.collectFromNvidiaSmi();
    if (fromNvidiaSmi.controllers.length > 0) return fromNvidiaSmi;

    return { controllers: [] };
  }

  private async collectFromSi(): Promise<SystemGPUData> {
    const graphics = await SI.graphics().catch(() => null);
    if (!graphics?.controllers?.length) return { controllers: [] };

    return {
      controllers: graphics.controllers.map((c) => {
        const vramTotal = c.memoryTotal || c.vram || 0;
        const vramFree = c.memoryFree ?? 0;
        return {
          vendor: c.vendor || "",
          model: c.model || "",
          vramTotal,
          vramUsed: vramTotal > 0 ? vramTotal - vramFree : 0,
          vramFree,
          utilization: c.utilizationGpu ?? -1,
          temperature: c.temperatureGpu ?? -1,
          coreClock: c.clockCore ?? 0,
          memoryClock: c.clockMemory ?? 0,
        };
      }),
    };
  }

  private async collectFromNvidiaSmi(): Promise<SystemGPUData> {
    try {
      const { stdout } = await execFileAsync("nvidia-smi", [
        "--query-gpu=" + NVIDIA_SMI_QUERY,
        "--format=csv,noheader,nounits",
      ]);
      const controllers = parseNvidiaSmi(stdout);
      return controllers.length > 0 ? { controllers } : { controllers: [] };
    } catch {
      return { controllers: [] };
    }
  }
}
