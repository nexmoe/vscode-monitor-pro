import { execFile } from "child_process";
import { promisify } from "util";
import * as SI from "systeminformation";

const execFileP = promisify(execFile);

export interface GpuCard {
  model: string;
  utilization: number;
  temperature: number;
  memTotal: number;
  memUsed: number;
}

const MIB = 1024 * 1024;

function safeNum(v: number | undefined | null): number {
  return Number.isFinite(v) ? (v as number) : 0;
}

/**
 * Normalize systeminformation graphics controllers into the unified GPU card
 * list (NVIDIA only).
 *
 * Only NVIDIA controllers merged with nvidia-smi output carry live metrics
 * (utilization / temperature / memory). AMD/Intel entries from lspci/clinfo
 * only expose vendor/model/vram, so they are excluded. Availability is
 * therefore expressed by data presence, never by a platform check.
 *
 * NOTE: nvidia-smi reports memory in MiB (not bytes), so both memory fields
 * are converted here so callers always deal with bytes.
 */
export function extractGpuCards(
  g: SI.Systeminformation.GraphicsData | null | undefined,
): GpuCard[] {
  if (!g?.controllers?.length) {
    return [];
  }
  const cards: GpuCard[] = [];
  for (const c of g.controllers) {
    if (
      c.utilizationGpu === undefined &&
      c.temperatureGpu === undefined &&
      c.memoryUsed === undefined
    ) {
      continue;
    }
    cards.push({
      model: c.model || c.name || "",
      utilization: safeNum(c.utilizationGpu),
      temperature: safeNum(c.temperatureGpu),
      memTotal: safeNum(c.memoryTotal) * MIB,
      memUsed: safeNum(c.memoryUsed) * MIB,
    });
  }
  return cards;
}

const NVIDIA_SMI_QUERY = [
  "--query-gpu=name,utilization.gpu,temperature.gpu,memory.used,memory.total",
  "--format=csv,noheader,nounits",
];

/**
 * Parse `nvidia-smi --query-gpu=... --format=csv` output into GpuCard[].
 *
 * Memory is reported in MiB, so it is converted to bytes (same as the
 * systeminformation path) to keep callers consistent.
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
 * Prefers the systeminformation snapshot; when it yields no controllers (e.g.
 * container environments lacking `lspci`, where SI.graphics() returns an empty
 * list even though nvidia-smi works), falls back to parsing nvidia-smi
 * directly. The nvidia-smi fallback only runs when the gpu dimension is
 * explicitly requested, so disabled metrics stay free of extra child
 * processes.
 */
export async function resolveGpuCards(
  g: SI.Systeminformation.GraphicsData | null | undefined,
): Promise<GpuCard[]> {
  const cards = extractGpuCards(g);
  if (cards.length > 0) {
    return cards;
  }
  return parseNvidiaSmi();
}
