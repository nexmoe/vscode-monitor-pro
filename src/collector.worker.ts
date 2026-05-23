import { parentPort } from "worker_threads";
import * as SI from "systeminformation";
import { SIGPUDataSource } from "./gpu";

let interval = 2000;
let timer: ReturnType<typeof setTimeout> | null = null;
let prev: Record<string, any> | null = null;

const gpuSource = new SIGPUDataSource();

async function collect() {
  const [cl, mem, os, ns, fs, fsSize, cpuSpeed, cpuTemp, bat, gpu] =
    await Promise.all([
      SI.currentLoad().catch(() => null),
      SI.mem().catch(() => null),
      SI.osInfo().catch(() => null),
      SI.networkStats().catch(() => null),
      SI.fsStats().catch(() => null),
      SI.fsSize().catch(() => null),
      SI.cpuCurrentSpeed().catch(() => null),
      SI.cpuTemperature().catch(() => null),
      SI.battery().catch(() => null),
      gpuSource.collect().catch(() => ({ controllers: [] })),
    ]);
  let tm: SI.Systeminformation.TimeData | null = null;
  try {
    tm = SI.time();
  } catch {
    /* ignore */
  }

  const snapshot = {
    timestamp: Date.now(),
    currentLoad: cl?.currentLoad ?? prev?.currentLoad ?? 0,
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
    fsSize: fsSize ?? prev?.fsSize ?? [],
    cpuCurrentSpeed: cpuSpeed ??
      prev?.cpuCurrentSpeed ?? { min: 0, max: 0, avg: 0, cores: [] },
    cpuTemperature: cpuTemp ??
      prev?.cpuTemperature ?? { main: 0, cores: [], max: 0 },
    gpu: gpu ?? prev?.gpu ?? { controllers: [] },
    battery: bat
      ? {
          hasBattery: bat.hasBattery,
          cycleCount: bat.cycleCount ?? 0,
          isCharging: bat.isCharging ?? false,
          designedCapacity: bat.designedCapacity ?? 0,
          maxCapacity: bat.maxCapacity ?? 0,
          currentCapacity: bat.currentCapacity ?? 0,
          capacityUnit: bat.capacityUnit ?? "mWh",
          voltage: bat.voltage ?? 0,
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
        }
      : (prev?.battery ?? {
          hasBattery: false,
          cycleCount: 0,
          isCharging: false,
          designedCapacity: 0,
          maxCapacity: 0,
          currentCapacity: 0,
          capacityUnit: "mWh",
          voltage: 0,
          percent: 0,
          health: 0,
          powerRate: 0,
          powerState: "none",
          timeRemaining: 0,
          acConnected: false,
          type: "",
          model: "",
          manufacturer: "",
          serial: "",
        }),
    time: tm ??
      prev?.time ?? {
        uptime: 0,
        timezone: "",
        timezoneName: "",
        current: 0,
      },
    unavailableMetrics: [],
  };

  prev = snapshot;
  return snapshot;
}

async function tick() {
  const t0 = Date.now();
  try {
    const data = await collect();
    parentPort?.postMessage({ type: "data", data: JSON.parse(JSON.stringify(data)) });
  } catch (e) {
    parentPort?.postMessage({ type: "error", error: String(e) });
  }
  const elapsed = Date.now() - t0;
  timer = setTimeout(tick, Math.max(interval - elapsed, 0));
}

parentPort?.on("message", (msg: any) => {
  if (msg.type === "start") {
    if (msg.interval) interval = msg.interval;
    tick();
  } else if (msg.type === "stop") {
    if (timer) clearTimeout(timer);
    timer = null;
  } else if (msg.type === "setInterval") {
    interval = msg.interval;
  }
});
