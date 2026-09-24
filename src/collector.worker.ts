import { parentPort } from "worker_threads";
import type { SystemSnapshot } from "./systemData";
import type { MetricsExist } from "./constants";
import { collectSISnapshot } from "./siCollector";

let interval = 2000;
let timer: ReturnType<typeof setTimeout> | null = null;
let prev: SystemSnapshot | null = null;

/**
 * Enabled UI metric set, pushed from the main thread via the setEnabled message.
 * Collection is delegated to collectSISnapshot (shared with SIDataSource), which
 * skips disabled dimensions and reuses the previous snapshot for rate
 * continuity, so no collection logic is duplicated here.
 */
let enabledMetrics: Set<MetricsExist> = new Set();

async function tick() {
  const t0 = Date.now();
  try {
    const data = await collectSISnapshot(prev, enabledMetrics);
    prev = data;
    parentPort?.postMessage({
      type: "data",
      data: JSON.parse(JSON.stringify(data)),
    });
  } catch (e) {
    parentPort?.postMessage({ type: "error", error: String(e) });
  }
  const elapsed = Date.now() - t0;
  timer = setTimeout(tick, Math.max(interval - elapsed, 0));
}

parentPort?.on("message", (msg: any) => {
  if (msg.type === "start") {
    if (msg.interval) interval = msg.interval;
    if (Array.isArray(msg.enabled)) {
      enabledMetrics = new Set(msg.enabled as MetricsExist[]);
    }
    tick();
  } else if (msg.type === "stop") {
    if (timer) clearTimeout(timer);
    timer = null;
  } else if (msg.type === "setInterval") {
    interval = msg.interval;
  } else if (msg.type === "setEnabled") {
    if (Array.isArray(msg.enabled)) {
      enabledMetrics = new Set(msg.enabled as MetricsExist[]);
    }
  }
});
