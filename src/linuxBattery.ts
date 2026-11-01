import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
// Type-only: the import is erased at compile time, so this module never pulls
// in systemData.ts and the `vscode` module it loads at runtime.
import type { SystemSnapshot } from "./systemData";

/**
 * Battery state read straight from the Linux power_supply class.
 *
 * systeminformation is not usable for this: its Linux battery() reports no
 * power field, it derives designedCapacity with a bitwise OR of two capacities
 * (lib/battery.js), and it converts the full capacity with voltage_now while
 * converting the design capacity with voltage_min_design - two different bases
 * in one ratio. One conversion basis per pack keeps health meaningful, and
 * reading the raw watts gives the sampler a signed figure.
 *
 * Only node:fs and node:path are used: this module also runs inside the
 * collector worker thread, which cannot load `vscode`.
 */

const DEFAULT_POWER_SUPPLY_DIR = "/sys/class/power_supply";

/** Voltage, current and power are reported in micro units. */
const MICRO = 1e6;
/** Stored energy (uWh) and charge (uAh) are reported in micro units too. */
const MICRO_TO_MILLI = 1e3;

/**
 * A near-zero discharge reading makes the quotient unbounded, and the GUI has
 * no use for a multi-day estimate, so the value is clamped to two days.
 */
const MAX_TIME_REMAINING_MINUTES = 48 * 60;

/**
 * Percentage from which a plugged-in, idle pack counts as full.
 *
 * Not exactly 100: charge limits and drivers stop a fraction short of the
 * nominal maximum, and a pack held at 99.6% is full for every practical
 * purpose.
 */
const FULL_PERCENT_THRESHOLD = 99.5;

/**
 * Attribute names follow the kernel uevent format documented in
 * drivers/power/supply/power_supply_sysfs.c: every property is exported as
 * POWER_SUPPLY_<PROPERTY>.
 */
const KEY_TYPE = "POWER_SUPPLY_TYPE";
const KEY_STATUS = "POWER_SUPPLY_STATUS";
const KEY_PRESENT = "POWER_SUPPLY_PRESENT";
const KEY_CAPACITY = "POWER_SUPPLY_CAPACITY";
const KEY_ONLINE = "POWER_SUPPLY_ONLINE";
const KEY_VOLTAGE_NOW = "POWER_SUPPLY_VOLTAGE_NOW";
const KEY_VOLTAGE_MAX_DESIGN = "POWER_SUPPLY_VOLTAGE_MAX_DESIGN";
const KEY_VOLTAGE_MIN_DESIGN = "POWER_SUPPLY_VOLTAGE_MIN_DESIGN";
const KEY_CURRENT_NOW = "POWER_SUPPLY_CURRENT_NOW";
const KEY_POWER_NOW = "POWER_SUPPLY_POWER_NOW";
const KEY_ENERGY_NOW = "POWER_SUPPLY_ENERGY_NOW";
const KEY_ENERGY_FULL = "POWER_SUPPLY_ENERGY_FULL";
const KEY_ENERGY_FULL_DESIGN = "POWER_SUPPLY_ENERGY_FULL_DESIGN";
const KEY_CHARGE_NOW = "POWER_SUPPLY_CHARGE_NOW";
const KEY_CHARGE_FULL = "POWER_SUPPLY_CHARGE_FULL";
const KEY_CHARGE_FULL_DESIGN = "POWER_SUPPLY_CHARGE_FULL_DESIGN";
const KEY_CYCLE_COUNT = "POWER_SUPPLY_CYCLE_COUNT";
const KEY_TECHNOLOGY = "POWER_SUPPLY_TECHNOLOGY";
const KEY_MODEL_NAME = "POWER_SUPPLY_MODEL_NAME";
const KEY_MANUFACTURER = "POWER_SUPPLY_MANUFACTURER";
const KEY_SERIAL_NUMBER = "POWER_SUPPLY_SERIAL_NUMBER";

/** A Mains/USB node also exposes `online` as a plain attribute file. */
const ONLINE_FILE_KEY = "online";

export type LinuxBatteryStatus =
  "charging" | "discharging" | "full" | "not-charging" | "unknown";

/** One node under /sys/class/power_supply, with its attribute values. */
export interface SysfsSupply {
  /** Node name, for example "BAT0" or "AC". */
  name: string;
  /** uevent keys (POWER_SUPPLY_*) plus the plain "online" value if read. */
  attributes: Record<string, string>;
}

export interface LinuxBatteryReading {
  status: LinuxBatteryStatus;
  acConnected: boolean;
  /** Kernel percentage; -1 when the kernel does not report one. */
  percent: number;
  /** Signed: charging positive, discharging negative, otherwise 0. */
  powerW: number;
  /** 0 when it cannot be computed. Not clamped; the caller clamps. */
  health: number;
  maxCapacity: number;
  designedCapacity: number;
  currentCapacity: number;
  voltage: number;
  cycleCount: number;
  /** Minutes, 0 when it cannot be computed. */
  timeRemaining: number;
  /** Identity of the dominant pack, empty when the kernel does not export it. */
  technology: string;
  model: string;
  manufacturer: string;
  serial: string;
}

/** Capacity of a single pack, converted to mWh. */
interface PackCapacity {
  full: number;
  design: number;
  /** null when the pack reports no stored energy/charge. */
  current: number | null;
  /**
   * Measured pack voltage in volts, 0 when the pack reports none.
   *
   * Deliberately not the conversion basis used for charge packs: that basis may
   * be a design voltage, and the same field has to mean the same thing for both
   * bases.
   */
  voltage: number;
  /** The node this pack was read from; the identity fields live on it. */
  supply: SysfsSupply;
}

/**
 * Aggregate the sysfs nodes into one reading.
 *
 * Returns null when no node is a battery, or when the battery set yields
 * neither a convertible capacity nor a kernel percentage: such a reading would
 * carry only placeholder numbers.
 */
export function parseSysfsBattery(
  supplies: SysfsSupply[],
): LinuxBatteryReading | null {
  // An empty bay still exports TYPE=Battery, so a second slot would otherwise
  // pull the totals down and hand its "Unknown" status to the aggregate.
  const batteries = supplies.filter(
    (supply) => isBatterySupply(supply) && isPresent(supply),
  );
  if (batteries.length === 0) {
    return null;
  }

  const packs = batteries
    .map(packCapacity)
    .filter((pack): pack is PackCapacity => pack !== null);

  // A hole in the stored-energy sum matters twice: the ratio fallback and the
  // time estimate both refuse a partial total instead of guessing from it.
  const storageComplete =
    packs.length > 0 && packs.every((pack) => pack.current !== null);

  const percent = resolvePercent(batteries, packs, storageComplete);
  if (packs.length === 0 && percent < 0) {
    return null;
  }

  const status = aggregateStatus(
    batteries.map((supply) => mapStatus(supply.attributes[KEY_STATUS])),
  );

  const maxCapacity = packs.reduce((total, pack) => total + pack.full, 0);
  const designedCapacity = packs.reduce(
    (total, pack) => total + pack.design,
    0,
  );
  // Packs that do not report their stored energy add nothing; the ratio and the
  // estimate are skipped above and below rather than built on that hole.
  const currentCapacity = packs.reduce(
    (total, pack) => total + (pack.current ?? 0),
    0,
  );
  // Both sums are taken on the same per-pack basis, so the ratio is the health
  // of the whole battery set rather than an average of per-pack ratios.
  const health =
    designedCapacity > 0 ? (100 * maxCapacity) / designedCapacity : 0;

  const powerW = signedPowerW(
    status,
    batteries.reduce((total, supply) => total + supplyPowerW(supply), 0),
  );

  const dominant = dominantPack(packs);

  return {
    status,
    acConnected: isAcConnected(supplies, status),
    percent,
    powerW,
    health,
    maxCapacity,
    designedCapacity,
    currentCapacity,
    voltage: dominant === null ? 0 : dominant.voltage,
    cycleCount: maxCycleCount(batteries),
    timeRemaining: estimateTimeRemaining(
      status,
      powerW,
      currentCapacity,
      storageComplete,
    ),
    technology: identityOf(dominant, KEY_TECHNOLOGY),
    model: identityOf(dominant, KEY_MODEL_NAME),
    manufacturer: identityOf(dominant, KEY_MANUFACTURER),
    serial: identityOf(dominant, KEY_SERIAL_NUMBER),
  };
}

/**
 * Read every node under the power_supply class and aggregate them.
 *
 * @param rootDir Directory holding the power_supply nodes; overridable so tests
 * can point at fixtures instead of the live sysfs.
 */
export function readSysfsBatteries(
  rootDir: string = DEFAULT_POWER_SUPPLY_DIR,
): LinuxBatteryReading | null {
  let names: string[];
  try {
    // The nodes are symlinks into /sys/devices, so the entries are followed by
    // reading through them instead of filtering on the entry type.
    names = readdirSync(rootDir);
  } catch {
    // No power_supply directory means no battery information: a desktop
    // machine, a VM, or a non-Linux host. That is a result, not an error.
    return null;
  }

  const supplies: SysfsSupply[] = [];
  for (const name of names) {
    const nodeDir = join(rootDir, name);
    const uevent = readFileText(join(nodeDir, "uevent"));
    if (uevent === null) {
      continue;
    }

    const attributes = parseUevent(uevent);
    const supply: SysfsSupply = { name, attributes };
    if (!isBatterySupply(supply)) {
      // Kernels repeat online as POWER_SUPPLY_ONLINE in uevent, so this file is
      // a fallback for nodes that lack it; a missing file stays unknown.
      const online = readFileText(join(nodeDir, ONLINE_FILE_KEY));
      if (online !== null) {
        attributes[ONLINE_FILE_KEY] = online;
      }
    }
    supplies.push(supply);
  }

  return parseSysfsBattery(supplies);
}

/**
 * Adapt a sysfs reading to the battery block of a snapshot.
 *
 * Lives next to the reading instead of in the collector so the two shapes stay
 * in one file, and so the mapping is testable without systeminformation.
 *
 * No value is clamped here: percentages are normalized once for every backend
 * in systemData.ts, and a second clamp would only hide which layer did it.
 */
export function toSnapshotBattery(
  reading: LinuxBatteryReading | null,
): SystemSnapshot["battery"] {
  if (reading === null) {
    // One shared "no battery" block instead of a literal at every call site:
    // the shape has to match SystemSnapshot["battery"] exactly.
    return {
      hasBattery: false,
      cycleCount: 0,
      isCharging: false,
      voltage: 0,
      designedCapacity: 0,
      maxCapacity: 0,
      currentCapacity: 0,
      capacityUnit: "mWh",
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
    };
  }

  const percent = displayPercent(reading);
  return {
    hasBattery: true,
    cycleCount: reading.cycleCount,
    isCharging: reading.status === "charging",
    voltage: reading.voltage,
    designedCapacity: reading.designedCapacity,
    maxCapacity: reading.maxCapacity,
    currentCapacity: reading.currentCapacity,
    capacityUnit: "mWh",
    percent,
    health: reading.health,
    powerRate: reading.powerW,
    powerState: displayPowerState(reading, percent),
    timeRemaining: reading.timeRemaining,
    acConnected: reading.acConnected,
    type: reading.technology,
    model: reading.model,
    manufacturer: reading.manufacturer,
    serial: reading.serial,
  };
}

/** Percentage to show, falling back to the capacity ratio. */
function displayPercent(reading: LinuxBatteryReading): number {
  if (reading.percent >= 0) {
    return reading.percent;
  }
  return reading.maxCapacity > 0
    ? (100 * reading.currentCapacity) / reading.maxCapacity
    : 0;
}

/**
 * Charging state for the display.
 *
 * A plugged-in pack that is neither charging nor discharging reports no flow at
 * all, so whether it is full can only be read from the percentage. This is the
 * only place "full" is produced; the collector never sees it from a driver.
 */
function displayPowerState(
  reading: LinuxBatteryReading,
  percent: number,
): SystemSnapshot["battery"]["powerState"] {
  if (reading.status === "charging") {
    return "charging";
  }
  if (reading.status === "discharging") {
    return "discharging";
  }
  return reading.acConnected && percent >= FULL_PERCENT_THRESHOLD
    ? "full"
    : "idle";
}

function isBatterySupply(supply: SysfsSupply): boolean {
  const type: string | undefined = supply.attributes[KEY_TYPE];
  // The kernel spells the type "Battery"; the comparison is case-insensitive
  // because drivers have shipped other capitalisations of the enum label.
  return type !== undefined && type.trim().toLowerCase() === "battery";
}

/**
 * Whether a battery bay actually holds a pack.
 *
 * PRESENT is optional in the kernel ABI, so only an explicit 0 marks an empty
 * bay; a node that never exports the attribute is taken as populated.
 */
function isPresent(supply: SysfsSupply): boolean {
  const present = readNumber(supply, KEY_PRESENT);
  return present === null || present !== 0;
}

/**
 * Convert one pack to mWh, or null when neither basis is complete.
 *
 * Energy wins when available: a pack that reports energy does not need a
 * voltage, so no conversion assumption is involved.
 */
function packCapacity(supply: SysfsSupply): PackCapacity | null {
  const energyFull = readNumber(supply, KEY_ENERGY_FULL);
  const energyDesign = readNumber(supply, KEY_ENERGY_FULL_DESIGN);
  if (
    energyFull !== null &&
    energyFull > 0 &&
    energyDesign !== null &&
    energyDesign > 0
  ) {
    // Unlike the charge basis below, no voltage is applied here: the pack
    // already reports energy, so the only other input is its stored amount.
    const energyNow = nonNegativeOrNull(readNumber(supply, KEY_ENERGY_NOW));
    return {
      full: energyFull / MICRO_TO_MILLI,
      design: energyDesign / MICRO_TO_MILLI,
      current: energyNow === null ? null : energyNow / MICRO_TO_MILLI,
      voltage: voltageVolts(supply, [KEY_VOLTAGE_NOW]),
      supply,
    };
  }

  const chargeFull = readNumber(supply, KEY_CHARGE_FULL);
  const chargeDesign = readNumber(supply, KEY_CHARGE_FULL_DESIGN);
  if (
    chargeFull === null ||
    chargeFull <= 0 ||
    chargeDesign === null ||
    chargeDesign <= 0
  ) {
    return null;
  }

  // One voltage for all three charge values. Using full's voltage for full and
  // design's voltage for design - what systeminformation does - makes the ratio
  // depend on the gap between the two voltages instead of on wear. Health needs
  // only a common basis, so the choice of voltage cannot bias it; the absolute
  // mWh numbers do depend on it, which is why the design voltage is preferred
  // over the momentary one.
  const volts = voltageVolts(supply, [
    KEY_VOLTAGE_MAX_DESIGN,
    KEY_VOLTAGE_MIN_DESIGN,
    KEY_VOLTAGE_NOW,
  ]);
  if (volts <= 0) {
    // Without a voltage the charge cannot become energy; inventing one would
    // put made-up mWh into the totals, so the pack stays out of the statistics.
    return null;
  }

  const chargeNow = nonNegativeOrNull(readNumber(supply, KEY_CHARGE_NOW));
  return {
    full: (chargeFull / MICRO_TO_MILLI) * volts,
    design: (chargeDesign / MICRO_TO_MILLI) * volts,
    current: chargeNow === null ? null : (chargeNow / MICRO_TO_MILLI) * volts,
    // The basis above stays inside the conversion; what the pack measures right
    // now is voltage_now, and a missing one is reported as unknown.
    voltage: voltageVolts(supply, [KEY_VOLTAGE_NOW]),
    supply,
  };
}

/**
 * Percentage of the whole battery set.
 *
 * CAPACITY is the driver's own figure for one pack, and it stays right where
 * the energy ratio does not: a freshly calibrated pack can report more stored
 * energy than its full capacity, so the ratio overshoots 100 while the driver
 * still says 100. It is also what userspace battery tools display, so taking it
 * keeps the extension from disagreeing with the desktop.
 *
 * Per-pack percentages cannot be combined for several packs without weighting
 * each by its size, so that source is limited to a single battery node; the
 * summed ratio is the fallback for the rest.
 */
function resolvePercent(
  batteries: SysfsSupply[],
  packs: PackCapacity[],
  storageComplete: boolean,
): number {
  if (batteries.length === 1) {
    const capacity = nonNegativeOrNull(readNumber(batteries[0], KEY_CAPACITY));
    if (capacity !== null) {
      return capacity;
    }
  }

  if (storageComplete) {
    const full = packs.reduce((total, pack) => total + pack.full, 0);
    const current = packs.reduce(
      (total, pack) => total + (pack.current ?? 0),
      0,
    );
    return (100 * current) / full;
  }

  return -1;
}

/**
 * Priority for several packs: flow of current beats a static report, and
 * "unknown" carries no information at all.
 */
function aggregateStatus(statuses: LinuxBatteryStatus[]): LinuxBatteryStatus {
  if (statuses.includes("charging")) {
    return "charging";
  }
  if (statuses.includes("discharging")) {
    return "discharging";
  }
  if (statuses.includes("full")) {
    return "full";
  }
  if (statuses.includes("not-charging")) {
    return "not-charging";
  }
  return "unknown";
}

function mapStatus(raw: string | undefined): LinuxBatteryStatus {
  switch ((raw ?? "").trim().toLowerCase()) {
    case "charging":
      return "charging";
    case "discharging":
      return "discharging";
    case "full":
      return "full";
    case "not charging":
      return "not-charging";
    default:
      return "unknown";
  }
}

/**
 * Sign convention shared with go-backend/sampler.go: charging is positive,
 * discharging negative, everything else zero. The magnitude is dropped for the
 * other states on purpose: a "full" pack that trickles a few hundred
 * milliwatts would otherwise show up as drain.
 */
function signedPowerW(status: LinuxBatteryStatus, magnitudeW: number): number {
  switch (status) {
    case "charging":
      return magnitudeW;
    case "discharging":
      // Negating zero would yield -0, which is not a power value and compares
      // unequal to 0 under Object.is.
      return magnitudeW === 0 ? 0 : -magnitudeW;
    default:
      return 0;
  }
}

/**
 * Instantaneous power of one pack, as a magnitude in watts.
 *
 * Drivers may report power_now as 0 when they only measure current, and
 * current_now is signed by definition (negative while discharging), so both the
 * fallback and the sign are taken from the absolute value.
 */
function supplyPowerW(supply: SysfsSupply): number {
  const powerNow = readNumber(supply, KEY_POWER_NOW);
  if (powerNow !== null && powerNow !== 0) {
    return Math.abs(powerNow) / MICRO;
  }

  const currentNow = readNumber(supply, KEY_CURRENT_NOW);
  const microvolts = readNumber(supply, KEY_VOLTAGE_NOW);
  if (currentNow === null || microvolts === null || microvolts <= 0) {
    return 0;
  }
  return (Math.abs(currentNow) / MICRO) * (microvolts / MICRO);
}

/**
 * AC presence: a live Mains/USB node, or a charging pack.
 *
 * The charging half mirrors systeminformation's acConnected, which ORs the
 * charging state in because some machines expose no adapter node.
 */
function isAcConnected(
  supplies: SysfsSupply[],
  status: LinuxBatteryStatus,
): boolean {
  const adapterOnline = supplies.some(
    (supply) => !isBatterySupply(supply) && isOnline(supply),
  );
  return adapterOnline || status === "charging";
}

/**
 * Whether an adapter node reports power flowing in.
 *
 * ONLINE is numeric: 0 is offline, 1 is an ordinary source and 2 is a
 * programmable one such as USB-PD, which powers the machine just as well. Any
 * explicit value of 1 or more therefore counts; a missing, empty or unparsable
 * value counts as offline instead of guessing.
 */
function isOnline(supply: SysfsSupply): boolean {
  const raw: string | undefined =
    supply.attributes[KEY_ONLINE] ?? supply.attributes[ONLINE_FILE_KEY];
  if (raw === undefined) {
    return false;
  }
  const value = Number(raw.trim());
  return Number.isFinite(value) && value >= 1;
}

/**
 * The pack that carries most of the capacity.
 *
 * Voltage and identity fields are per-pack values, so one pack has to represent
 * the set; the largest one is the only one whose numbers are worth showing.
 */
function dominantPack(packs: PackCapacity[]): PackCapacity | null {
  let dominant: PackCapacity | null = null;
  for (const pack of packs) {
    if (dominant === null || pack.full > dominant.full) {
      dominant = pack;
    }
  }
  return dominant;
}

/** Identity attribute of the dominant pack, empty when the node lacks it. */
function identityOf(pack: PackCapacity | null, key: string): string {
  if (pack === null) {
    return "";
  }
  const raw: string | undefined = pack.supply.attributes[key];
  return raw === undefined ? "" : raw.trim();
}

/** cycle_count is a per-pack lifetime counter, so the pack with the most wins. */
function maxCycleCount(batteries: SysfsSupply[]): number {
  return batteries.reduce((max, supply) => {
    const value = readNumber(supply, KEY_CYCLE_COUNT);
    return value !== null && value > max ? value : max;
  }, 0);
}

/**
 * Minutes until empty from the aggregated stored energy and the discharge rate.
 *
 * The stored side is the same total the display percentage comes from, so a
 * hole in it is refused rather than estimated: a missing pack would make the
 * total too small and the estimate too short, and the result would still look
 * plausible enough to be trusted.
 *
 * Stored energy is in mWh and the draw in W, so the draw is scaled to
 * milliwatts to make the quotient hours.
 */
function estimateTimeRemaining(
  status: LinuxBatteryStatus,
  powerW: number,
  currentCapacity: number,
  storageComplete: boolean,
): number {
  if (
    status !== "discharging" ||
    powerW >= 0 ||
    !storageComplete ||
    currentCapacity <= 0
  ) {
    return 0;
  }
  const minutes = (currentCapacity / (Math.abs(powerW) * 1000)) * 60;
  return Math.min(Math.round(minutes), MAX_TIME_REMAINING_MINUTES);
}

/**
 * Parse one sysfs numeric attribute.
 *
 * sysfs values are text: a driver may write an empty string, a stale value or
 * something non-numeric. Those become null so no NaN can reach the reading.
 * Range checks stay with the caller, because "negative" means absent for a
 * capacity but "discharging" for a current.
 */
function readNumber(supply: SysfsSupply, key: string): number | null {
  const raw: string | undefined = supply.attributes[key];
  if (raw === undefined) {
    return null;
  }
  const text = raw.trim();
  if (text === "") {
    return null;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function nonNegativeOrNull(value: number | null): number | null {
  return value !== null && value >= 0 ? value : null;
}

function voltageVolts(supply: SysfsSupply, keys: string[]): number {
  for (const key of keys) {
    const microvolts = readNumber(supply, key);
    if (microvolts !== null && microvolts > 0) {
      return microvolts / MICRO;
    }
  }
  return 0;
}

function parseUevent(text: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }
    // The kernel prints one KEY=VALUE per line, terminated by a newline that is
    // not part of the value.
    attributes[line.slice(0, separator)] = line.slice(separator + 1).trim();
  }
  return attributes;
}

function readFileText(path: string): string | null {
  try {
    return readFileSync(path, "utf8");
  } catch {
    // A node exposes only the properties its driver implements, so absent files
    // are normal; anything unreadable is treated the same way.
    return null;
  }
}
