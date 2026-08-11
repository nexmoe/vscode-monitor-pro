import { execFile } from "child_process";
import { promisify } from "util";

const execFileP = promisify(execFile);

export interface GpuCard {
  model: string;
  utilization: number;
  temperature: number;
  memTotal: number;
  memUsed: number;
}

const MIB = 1024 * 1024;

const NVIDIA_SMI_QUERY = [
  "--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total",
  "--format=csv,noheader,nounits",
];

/**
 * Parse `nvidia-smi --query-gpu=... --format=csv` output into GpuCard[].
 *
 * Memory is reported in MiB, so it is converted to bytes (same as before) to
 * keep callers consistent.
 */
async function parseNvidiaSmi(): Promise<GpuCard[]> {
  let stdout: string;
  try {
    const { stdout: out } = await execFileP("nvidia-smi", NVIDIA_SMI_QUERY, {
      timeout: 10000,
    });
    stdout = out;
  } catch {
    return [];
  }
  const cards: GpuCard[] = [];
  for (const line of stdout.split("\n")) {
    const parts = line.split(",").map((p) => p.trim());
    if (parts.length < 5) {
      continue;
    }
    const utilization = Number(parts[1]);
    const temperature = Number(parts[2]);
    const memUsed = Number(parts[3]);
    const memTotal = Number(parts[4]);
    if (
      ![utilization, temperature, memUsed, memTotal].every((v) =>
        Number.isFinite(v),
      )
    ) {
      continue;
    }
    cards.push({
      model: parts[0],
      utilization,
      temperature,
      memUsed: memUsed * MIB,
      memTotal: memTotal * MIB,
    });
  }
  return cards;
}

/**
 * Resolve the GPU card list for one sampling cycle.
 *
 * Queries nvidia-smi directly via async execFile (a single child process,
 * no synchronous blocking). Returns an empty array when nvidia-smi is
 * unavailable, making all GPU metrics auto-hide via the existing
 * data-presence availability checkers.
 */
export async function resolveGpuCards(): Promise<GpuCard[]> {
  return parseNvidiaSmi();
}
