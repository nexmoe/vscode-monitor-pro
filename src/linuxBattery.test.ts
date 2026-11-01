import { strict as assert } from "assert";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  parseSysfsBattery,
  readSysfsBatteries,
  toSnapshotBattery,
  type LinuxBatteryReading,
  type SysfsSupply,
} from "./linuxBattery";

/**
 * Build a node from uevent-shaped "KEY=VALUE" lines, the same text the reader
 * parses in production. Literal attribute objects would need the all-caps
 * kernel keys as property names, which the project's naming rule rejects.
 */
function supplyFrom(name: string, lines: string[]): SysfsSupply {
  const attributes: Record<string, string> = {};
  for (const line of lines) {
    const separator = line.indexOf("=");
    attributes[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return { name, attributes };
}

function node(name: string, ...lines: string[]): SysfsSupply {
  return supplyFrom(name, lines);
}

function assertClose(actual: number, expected: number, tolerance = 1e-9): void {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );
}

function assertFiniteNumbers(reading: LinuxBatteryReading): void {
  for (const [field, value] of Object.entries(reading)) {
    if (typeof value === "number") {
      assert.ok(Number.isFinite(value), `${field} is not finite: ${value}`);
    }
  }
}

/**
 * The machine that motivated this module, kept verbatim in both states: a
 * Fedora laptop whose pack reports energy, is charged to 78% of its design
 * capacity, and reports a percentage above 100 shortly after being unplugged.
 *
 * The two dumps double as the regression fixture for the upower agreement: the
 * health computed from them has to be 78.066%, which is what upower shows.
 */
const PLUGGED_UEVENT = [
  "POWER_SUPPLY_NAME=BAT0",
  "POWER_SUPPLY_TYPE=Battery",
  "POWER_SUPPLY_STATUS=Not charging",
  "POWER_SUPPLY_PRESENT=1",
  "POWER_SUPPLY_TECHNOLOGY=Li-ion",
  "POWER_SUPPLY_CYCLE_COUNT=0",
  "POWER_SUPPLY_VOLTAGE_MIN_DESIGN=15440000",
  "POWER_SUPPLY_VOLTAGE_NOW=17122000",
  "POWER_SUPPLY_POWER_NOW=0",
  "POWER_SUPPLY_ENERGY_FULL_DESIGN=72012000",
  "POWER_SUPPLY_ENERGY_FULL=56217000",
  "POWER_SUPPLY_ENERGY_NOW=56217000",
  "POWER_SUPPLY_CAPACITY=100",
  "POWER_SUPPLY_CAPACITY_LEVEL=Normal",
  "POWER_SUPPLY_MODEL_NAME=R15B06W",
  "POWER_SUPPLY_MANUFACTURER=SUNWODA",
  "POWER_SUPPLY_SERIAL_NUMBER=MB100000797712460584",
];

const UNPLUGGED_UEVENT = [
  "POWER_SUPPLY_NAME=BAT0",
  "POWER_SUPPLY_TYPE=Battery",
  "POWER_SUPPLY_STATUS=Discharging",
  "POWER_SUPPLY_PRESENT=1",
  "POWER_SUPPLY_TECHNOLOGY=Li-ion",
  "POWER_SUPPLY_CYCLE_COUNT=0",
  "POWER_SUPPLY_VOLTAGE_MIN_DESIGN=15440000",
  "POWER_SUPPLY_VOLTAGE_NOW=17122000",
  "POWER_SUPPLY_POWER_NOW=19177000",
  "POWER_SUPPLY_ENERGY_FULL_DESIGN=72012000",
  "POWER_SUPPLY_ENERGY_FULL=56217000",
  "POWER_SUPPLY_ENERGY_NOW=57143000",
  "POWER_SUPPLY_CAPACITY=102",
  "POWER_SUPPLY_CAPACITY_LEVEL=Normal",
  "POWER_SUPPLY_MODEL_NAME=R15B06W",
  "POWER_SUPPLY_MANUFACTURER=SUNWODA",
  "POWER_SUPPLY_SERIAL_NUMBER=MB100000797712460584",
];

function realMachine(
  batteryUevent: string[],
  adapterOnline: string,
): SysfsSupply[] {
  return [
    supplyFrom("BAT0", batteryUevent),
    node(
      "ACAD",
      "POWER_SUPPLY_NAME=ACAD",
      "POWER_SUPPLY_TYPE=Mains",
      `POWER_SUPPLY_ONLINE=${adapterOnline}`,
    ),
  ];
}

function pluggedReading(): LinuxBatteryReading {
  const reading = parseSysfsBattery(realMachine(PLUGGED_UEVENT, "1"));
  assert.ok(reading);
  return reading;
}

function unpluggedReading(): LinuxBatteryReading {
  const reading = parseSysfsBattery(realMachine(UNPLUGGED_UEVENT, "0"));
  assert.ok(reading);
  return reading;
}

/** Pack that reports stored energy, as USB-C laptops and most tablets do. */
function energyPack(...overrides: string[]): SysfsSupply {
  return node(
    "BAT0",
    "POWER_SUPPLY_TYPE=Battery",
    "POWER_SUPPLY_STATUS=Discharging",
    "POWER_SUPPLY_ENERGY_FULL=50000000",
    "POWER_SUPPLY_ENERGY_FULL_DESIGN=60000000",
    "POWER_SUPPLY_ENERGY_NOW=25000000",
    "POWER_SUPPLY_VOLTAGE_NOW=12000000",
    "POWER_SUPPLY_POWER_NOW=10000000",
    ...overrides,
  );
}

/** Pack that reports charge, as ThinkPads and many ARM boards do. */
function chargePack(voltageMaxDesign: string): SysfsSupply {
  return node(
    "BAT0",
    "POWER_SUPPLY_TYPE=Battery",
    "POWER_SUPPLY_STATUS=Discharging",
    "POWER_SUPPLY_CHARGE_FULL=4000000",
    "POWER_SUPPLY_CHARGE_FULL_DESIGN=5000000",
    "POWER_SUPPLY_CHARGE_NOW=2000000",
    `POWER_SUPPLY_VOLTAGE_MAX_DESIGN=${voltageMaxDesign}`,
    "POWER_SUPPLY_VOLTAGE_NOW=11200000",
  );
}

describe("parseSysfsBattery: capacity basis", () => {
  it("uses the energy triple when the pack reports energy", () => {
    const reading = parseSysfsBattery([energyPack()]);
    assert.ok(reading);

    assert.equal(reading.maxCapacity, 50000);
    assert.equal(reading.designedCapacity, 60000);
    assert.equal(reading.currentCapacity, 25000);
    assertClose(reading.health, 83.333333333);
    assert.equal(reading.percent, 50);
    assert.equal(reading.voltage, 12);
  });

  it("keeps health independent of the design voltage for charge packs", () => {
    const low = parseSysfsBattery([chargePack("11000000")]);
    const high = parseSysfsBattery([chargePack("12000000")]);
    assert.ok(low);
    assert.ok(high);

    assertClose(low.health, 80);
    assertClose(high.health, 80);
    // The mWh totals do follow the voltage; that is what makes the assertion
    // above meaningful rather than a case of both sides moving together.
    assertClose(low.maxCapacity, 44000);
    assertClose(high.maxCapacity, 48000);
    // The reported voltage is the measured one, not the conversion basis: the
    // basis moved from 11 V to 12 V while voltage_now stayed at 11.2 V.
    assertClose(low.voltage, 11.2);
    assertClose(high.voltage, 11.2);
  });

  it("reports health against the design capacity of a charge-limited pack", () => {
    const reading = parseSysfsBattery([
      node(
        "BAT0",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Full",
        "POWER_SUPPLY_ENERGY_FULL=23050000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=50000000",
        "POWER_SUPPLY_CAPACITY=100",
      ),
    ]);
    assert.ok(reading);

    assertClose(reading.health, 46.1);
    assert.ok(reading.health < 100);
    assert.equal(reading.percent, 100);
  });

  it("uses the kernel percentage when only a percentage is known", () => {
    const reading = parseSysfsBattery([
      node("BAT0", "POWER_SUPPLY_TYPE=Battery", "POWER_SUPPLY_CAPACITY=77"),
    ]);
    assert.ok(reading);

    assert.equal(reading.percent, 77);
    assert.equal(reading.health, 0);
    assert.equal(reading.maxCapacity, 0);
    assert.equal(reading.designedCapacity, 0);
    assert.equal(reading.currentCapacity, 0);
    assert.equal(reading.voltage, 0);
    assert.equal(reading.status, "unknown");
    assert.equal(reading.powerW, 0);
    assert.equal(reading.timeRemaining, 0);
    assert.equal(reading.technology, "");
    assert.equal(reading.model, "");
    assert.equal(reading.manufacturer, "");
    assert.equal(reading.serial, "");
  });

  it("prefers the kernel percentage over the capacity ratio of one pack", () => {
    // The ratio would say 50%; the driver's own figure wins for a single pack.
    const reading = parseSysfsBattery([energyPack("POWER_SUPPLY_CAPACITY=64")]);
    assert.ok(reading);

    assert.equal(reading.percent, 64);
  });

  it("returns a kernel percentage above 100 without clamping it", () => {
    // A calibrated pack reports more stored energy than its full capacity right
    // after unplugging; the driver still says 102 and the module leaves it be.
    const reading = unpluggedReading();

    assert.equal(reading.percent, 102);
    assertClose(reading.health, 78.066155641);
  });

  it("does not use a pack whose charge cannot be converted without a voltage", () => {
    const reading = parseSysfsBattery([
      node(
        "BAT0",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_CHARGE_FULL=4000000",
        "POWER_SUPPLY_CHARGE_FULL_DESIGN=5000000",
        "POWER_SUPPLY_CAPACITY=55",
      ),
    ]);
    assert.ok(reading);

    assert.equal(reading.maxCapacity, 0);
    assert.equal(reading.health, 0);
    assert.equal(reading.percent, 55);
  });
});

describe("parseSysfsBattery: identity", () => {
  it("reads the identity attributes of the pack", () => {
    const reading = pluggedReading();

    assert.equal(reading.technology, "Li-ion");
    assert.equal(reading.model, "R15B06W");
    assert.equal(reading.manufacturer, "SUNWODA");
    assert.equal(reading.serial, "MB100000797712460584");
  });

  it("takes the identity from the largest pack's node", () => {
    const reading = parseSysfsBattery([
      node(
        "BAT0",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_ENERGY_FULL=30000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=40000000",
        "POWER_SUPPLY_MANUFACTURER=SMALL",
      ),
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_ENERGY_FULL=60000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=60000000",
        "POWER_SUPPLY_MANUFACTURER=LARGE",
      ),
    ]);
    assert.ok(reading);

    assert.equal(reading.manufacturer, "LARGE");
  });
});

describe("parseSysfsBattery: several packs", () => {
  function dualPack(): SysfsSupply[] {
    return [
      node(
        "BAT0",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Charging",
        "POWER_SUPPLY_ENERGY_FULL=30000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=40000000",
        "POWER_SUPPLY_ENERGY_NOW=15000000",
        "POWER_SUPPLY_VOLTAGE_NOW=12000000",
        "POWER_SUPPLY_POWER_NOW=10000000",
        "POWER_SUPPLY_CYCLE_COUNT=120",
      ),
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Charging",
        "POWER_SUPPLY_ENERGY_FULL=20000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=20000000",
        "POWER_SUPPLY_ENERGY_NOW=10000000",
        "POWER_SUPPLY_VOLTAGE_NOW=11000000",
        "POWER_SUPPLY_POWER_NOW=5000000",
        "POWER_SUPPLY_CYCLE_COUNT=300",
      ),
    ];
  }

  it("sums capacities, keeps the largest cycle count and sums power", () => {
    const reading = parseSysfsBattery(dualPack());
    assert.ok(reading);

    assert.equal(reading.maxCapacity, 50000);
    assert.equal(reading.designedCapacity, 60000);
    assert.equal(reading.currentCapacity, 25000);
    assert.equal(reading.percent, 50);
    assertClose(reading.health, 83.333333333);
    assert.equal(reading.cycleCount, 300);
    assert.equal(reading.powerW, 15);
    // BAT0 holds more energy, so its voltage represents the set.
    assert.equal(reading.voltage, 12);
  });

  it("reports -1 percent when a pack cannot supply its stored energy", () => {
    // Two packs cannot fall back to a percentage: their per-pack CAPACITY
    // values would need a size weighting the attribute does not provide.
    const packs = [
      dualPack()[0],
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Charging",
        "POWER_SUPPLY_ENERGY_FULL=20000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=20000000",
        "POWER_SUPPLY_CAPACITY=60",
      ),
    ];

    const reading = parseSysfsBattery(packs);
    assert.ok(reading);

    assert.equal(reading.percent, -1);
    assert.equal(reading.maxCapacity, 50000);
  });

  it("prefers charging over a full pack and sums both powers", () => {
    const packs = [
      dualPack()[0],
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Full",
        "POWER_SUPPLY_ENERGY_FULL=20000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=20000000",
        "POWER_SUPPLY_ENERGY_NOW=10000000",
        "POWER_SUPPLY_VOLTAGE_NOW=11000000",
        "POWER_SUPPLY_POWER_NOW=0",
      ),
    ];

    const reading = parseSysfsBattery(packs);
    assert.ok(reading);

    assert.equal(reading.status, "charging");
    assert.equal(reading.powerW, 10);
  });

  it("leaves an empty bay out of the totals and the status", () => {
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_PRESENT=1"),
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_PRESENT=0",
        "POWER_SUPPLY_STATUS=Unknown",
        "POWER_SUPPLY_ENERGY_FULL=90000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=90000000",
        "POWER_SUPPLY_ENERGY_NOW=90000000",
      ),
    ]);
    assert.ok(reading);

    // Only the populated pack is counted, so the ratio stays at its 50%.
    assert.equal(reading.maxCapacity, 50000);
    assert.equal(reading.currentCapacity, 25000);
    assert.equal(reading.percent, 50);
    assert.equal(reading.status, "discharging");
  });

  it("does not let an absent bay report AC presence", () => {
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_STATUS=Full"),
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_PRESENT=0",
        "POWER_SUPPLY_STATUS=Charging",
      ),
      node("AC", "POWER_SUPPLY_TYPE=Mains", "POWER_SUPPLY_ONLINE=0"),
    ]);
    assert.ok(reading);

    assert.equal(reading.acConnected, false);
  });
});

describe("parseSysfsBattery: power", () => {
  it("derives watts from current and voltage when POWER_NOW is absent", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_POWER_NOW=",
        "POWER_SUPPLY_CURRENT_NOW=-2000000",
      ),
    ]);
    assert.ok(reading);

    assert.equal(reading.powerW, -24);
  });

  it("drops the wattage unless the pack is charging or discharging", () => {
    // energyPack reports 10000000 uW, so the flow states are +-10 W.
    const cases: Array<[string, string, number]> = [
      ["Charging", "charging", 10],
      ["Discharging", "discharging", -10],
      ["Full", "full", 0],
      ["Not charging", "not-charging", 0],
      ["Unknown", "unknown", 0],
      ["", "unknown", 0],
    ];
    for (const [kernelStatus, expectedStatus, expectedPower] of cases) {
      const reading = parseSysfsBattery([
        energyPack(`POWER_SUPPLY_STATUS=${kernelStatus}`),
      ]);
      assert.ok(reading);
      assert.equal(reading.status, expectedStatus, kernelStatus);
      assert.equal(reading.powerW, expectedPower, kernelStatus);
    }
  });
});

describe("parseSysfsBattery: AC state", () => {
  const mainsOnline = node(
    "AC",
    "POWER_SUPPLY_TYPE=Mains",
    "POWER_SUPPLY_ONLINE=1",
  );
  const mainsOffline = node(
    "AC",
    "POWER_SUPPLY_TYPE=Mains",
    "POWER_SUPPLY_ONLINE=0",
  );

  it("ignores adapter nodes for capacity but reads their online flag", () => {
    const reading = parseSysfsBattery([energyPack(), mainsOnline]);
    assert.ok(reading);

    assert.equal(reading.acConnected, true);
    assert.equal(reading.maxCapacity, 50000);
  });

  it("counts a programmable source (ONLINE=2) as plugged in", () => {
    // USB-PD chargers report 2, which still powers the machine.
    const usbPd = node(
      "ACAD",
      "POWER_SUPPLY_TYPE=Mains",
      "POWER_SUPPLY_ONLINE=2",
    );
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_STATUS=Not charging"),
      usbPd,
    ]);
    assert.ok(reading);

    assert.equal(reading.acConnected, true);
  });

  it("reads the plain online file of a USB node", () => {
    const usb = node("USB", "POWER_SUPPLY_TYPE=USB", "online=1");
    const reading = parseSysfsBattery([energyPack(), usb]);
    assert.ok(reading);

    assert.equal(reading.acConnected, true);
  });

  it("is false when no adapter is online and the pack is idle", () => {
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_STATUS=Full"),
      mainsOffline,
    ]);
    assert.ok(reading);

    assert.equal(reading.acConnected, false);
  });

  it("is true while charging even without an adapter node", () => {
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_STATUS=Charging"),
    ]);
    assert.ok(reading);

    assert.equal(reading.acConnected, true);
  });
});

describe("parseSysfsBattery: peripheral packs", () => {
  /** A wireless mouse or gamepad: a battery node with no design capacity. */
  function peripheral(...lines: string[]): SysfsSupply {
    return node(
      "hidpp_battery_0",
      "POWER_SUPPLY_TYPE=Battery",
      "POWER_SUPPLY_STATUS=Discharging",
      "POWER_SUPPLY_CAPACITY=50",
      "POWER_SUPPLY_POWER_NOW=2000000",
      ...lines,
    );
  }

  it("keeps a peripheral out of the totals of the system battery", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_STATUS=Not charging",
        "POWER_SUPPLY_CAPACITY=100",
      ),
      peripheral(),
      node("AC", "POWER_SUPPLY_TYPE=Mains", "POWER_SUPPLY_ONLINE=1"),
    ]);
    assert.ok(reading);

    // The mouse is discharging at half charge while the laptop sits full on the
    // adapter; every one of those figures has to stay out of the aggregate.
    assert.equal(reading.status, "not-charging");
    assert.equal(reading.percent, 100);
    assert.equal(reading.maxCapacity, 50000);
    assert.equal(reading.acConnected, true);
    assert.equal(toSnapshotBattery(reading).powerState, "full");
  });

  it("returns null when only a peripheral pack exists", () => {
    assert.equal(parseSysfsBattery([peripheral()]), null);
  });

  it("accepts a pack that reports a design capacity under another name", () => {
    const reading = parseSysfsBattery([
      node(
        "CMB0",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Discharging",
        "POWER_SUPPLY_CHARGE_FULL=4000000",
        "POWER_SUPPLY_CHARGE_FULL_DESIGN=5000000",
        "POWER_SUPPLY_CHARGE_NOW=2000000",
        "POWER_SUPPLY_VOLTAGE_MAX_DESIGN=11000000",
      ),
    ]);
    assert.ok(reading);

    assertClose(reading.health, 80);
    assert.equal(reading.percent, 50);
  });

  it("drops a device-scoped pack even when it reports a design capacity", () => {
    const deviceScoped = peripheral(
      "POWER_SUPPLY_SCOPE=Device",
      "POWER_SUPPLY_ENERGY_FULL=1000000",
      "POWER_SUPPLY_ENERGY_FULL_DESIGN=2000000",
      "POWER_SUPPLY_ENERGY_NOW=1000000",
    );
    const reading = parseSysfsBattery([deviceScoped, energyPack()]);
    assert.ok(reading);

    assert.equal(reading.maxCapacity, 50000);
    // With the system pack gone, the node the kernel scoped to one device must
    // not take over as the machine's battery.
    assert.equal(parseSysfsBattery([deviceScoped]), null);
  });

  it("keeps a BATn pack even when the driver scoped it to a device", () => {
    // The scope is a hint, not a veto. A system pack filed under the device
    // scope would otherwise disappear from the card entirely, which is worse
    // than trusting the conventional name.
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_SCOPE=Device"),
    ]);
    assert.ok(reading);

    assert.equal(reading.maxCapacity, 50000);
    assert.equal(reading.health, (100 * 50000) / 60000);
  });
});

describe("parseSysfsBattery: time remaining", () => {
  it("estimates minutes from stored energy over the discharge rate", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_STATUS=Discharging",
        "POWER_SUPPLY_ENERGY_NOW=50000000",
        "POWER_SUPPLY_POWER_NOW=10000000",
      ),
    ]);
    assert.ok(reading);

    assert.equal(reading.timeRemaining, 300);
  });

  it("estimates from the same total the percentage uses", () => {
    // 57143 mWh at 19.177 W is 178.8 minutes; the aggregated stored energy is
    // what feeds the estimate, not a second pass over the nodes.
    const reading = unpluggedReading();

    assert.equal(reading.timeRemaining, 179);
  });

  it("is 0 when a pack does not report its stored energy", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_STATUS=Discharging",
        "POWER_SUPPLY_ENERGY_NOW=50000000",
        "POWER_SUPPLY_POWER_NOW=10000000",
      ),
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Discharging",
        "POWER_SUPPLY_ENERGY_FULL=20000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=20000000",
        "POWER_SUPPLY_POWER_NOW=5000000",
      ),
    ]);
    assert.ok(reading);

    // The total would be missing the second pack, so no estimate is offered.
    assert.equal(reading.timeRemaining, 0);
    assert.equal(reading.percent, -1);
  });

  it("is 0 while charging", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_STATUS=Charging",
        "POWER_SUPPLY_ENERGY_NOW=50000000",
        "POWER_SUPPLY_POWER_NOW=10000000",
      ),
    ]);
    assert.ok(reading);

    assert.equal(reading.timeRemaining, 0);
  });

  it("caps an absurd estimate at two days", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_STATUS=Discharging",
        "POWER_SUPPLY_ENERGY_NOW=60000000",
        "POWER_SUPPLY_POWER_NOW=100",
      ),
    ]);
    assert.ok(reading);

    assert.equal(reading.timeRemaining, 48 * 60);
  });
});

describe("parseSysfsBattery: unusable input", () => {
  it("returns null without any node", () => {
    assert.equal(parseSysfsBattery([]), null);
  });

  it("returns null when only adapter nodes exist", () => {
    const mains = node("AC", "POWER_SUPPLY_TYPE=Mains");
    assert.equal(parseSysfsBattery([mains]), null);
  });

  it("returns null when every battery bay is empty", () => {
    const empty = node(
      "BAT0",
      "POWER_SUPPLY_TYPE=Battery",
      "POWER_SUPPLY_PRESENT=0",
      "POWER_SUPPLY_CAPACITY=0",
    );
    assert.equal(parseSysfsBattery([empty]), null);
  });

  it("returns null when every value is dirty", () => {
    const reading = parseSysfsBattery([
      node(
        "BAT0",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=garbage",
        "POWER_SUPPLY_ENERGY_FULL=abc",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=60000000",
        "POWER_SUPPLY_ENERGY_NOW=",
        "POWER_SUPPLY_CAPACITY=-1",
        "POWER_SUPPLY_VOLTAGE_NOW= ",
        "POWER_SUPPLY_POWER_NOW=oops",
        "POWER_SUPPLY_CYCLE_COUNT=x",
      ),
    ]);

    assert.equal(reading, null);
  });

  it("keeps every number finite when only some values are dirty", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_STATUS=Discharging",
        "POWER_SUPPLY_ENERGY_NOW=n/a",
        "POWER_SUPPLY_CAPACITY=-1",
        "POWER_SUPPLY_POWER_NOW=bad",
        "POWER_SUPPLY_CURRENT_NOW=-",
        "POWER_SUPPLY_CYCLE_COUNT=n/a",
      ),
    ]);
    assert.ok(reading);

    assertFiniteNumbers(reading);
    assert.equal(reading.percent, -1);
    assert.equal(reading.powerW, 0);
    assert.equal(reading.cycleCount, 0);
    assert.equal(reading.timeRemaining, 0);
    assertClose(reading.health, 83.333333333);
    assert.equal(reading.voltage, 12);
  });
});

describe("readSysfsBatteries", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "monitor-pro-sysfs-"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function writeNode(
    name: string,
    ueventLines: string[],
    online?: string,
  ): void {
    const nodeDir = join(root, name);
    mkdirSync(nodeDir, { recursive: true });
    writeFileSync(join(nodeDir, "uevent"), `${ueventLines.join("\n")}\n`);
    if (online !== undefined) {
      writeFileSync(join(nodeDir, "online"), `${online}\n`);
    }
  }

  it("reads uevent files and the plain online file", () => {
    writeNode("BAT0", [
      "POWER_SUPPLY_NAME=BAT0",
      "POWER_SUPPLY_TYPE=Battery",
      "POWER_SUPPLY_STATUS=Discharging",
      "POWER_SUPPLY_ENERGY_FULL=50000000",
      "POWER_SUPPLY_ENERGY_FULL_DESIGN=60000000",
      "POWER_SUPPLY_ENERGY_NOW=25000000",
      "POWER_SUPPLY_VOLTAGE_NOW=12000000",
      "POWER_SUPPLY_POWER_NOW=10000000",
    ]);
    // The adapter node deliberately lacks POWER_SUPPLY_ONLINE so the file read
    // is the only source of the flag.
    writeNode("AC", ["POWER_SUPPLY_NAME=AC", "POWER_SUPPLY_TYPE=Mains"], "1");

    const reading = readSysfsBatteries(root);
    assert.ok(reading);

    assert.equal(reading.acConnected, true);
    assert.equal(reading.maxCapacity, 50000);
    assert.equal(reading.percent, 50);
    assert.equal(reading.powerW, -10);
  });

  it("returns null for an empty directory", () => {
    assert.equal(readSysfsBatteries(root), null);
  });

  it("returns null for a missing directory", () => {
    assert.equal(readSysfsBatteries(join(root, "missing")), null);
  });

  it("returns null when a node has no uevent file", () => {
    mkdirSync(join(root, "BAT0"), { recursive: true });
    assert.equal(readSysfsBatteries(root), null);
  });

  it("ignores lines that are not KEY=VALUE pairs", () => {
    writeNode("BAT0", [
      "garbage",
      "=no-key",
      "POWER_SUPPLY_TYPE=Battery",
      "POWER_SUPPLY_CAPACITY=64",
    ]);

    const reading = readSysfsBatteries(root);
    assert.ok(reading);

    assert.equal(reading.percent, 64);
    assert.equal(reading.status, "unknown");
  });
});

describe("toSnapshotBattery", () => {
  it("maps the plugged-in reading to a full, idle state", () => {
    const battery = toSnapshotBattery(pluggedReading());

    // "Not charging" with the adapter online: only the percentage can tell that
    // the pack is full, which is why "full" is produced here and not by the
    // driver status.
    assert.equal(battery.powerState, "full");
    assert.equal(battery.isCharging, false);
    assert.equal(battery.acConnected, true);
    assert.equal(battery.percent, 100);
    assert.equal(battery.hasBattery, true);
    assert.equal(battery.powerRate, 0);
    assertClose(battery.health, 78.066155641);
    assert.equal(battery.maxCapacity, 56217);
    assert.equal(battery.designedCapacity, 72012);
    assert.equal(battery.currentCapacity, 56217);
    assert.equal(battery.capacityUnit, "mWh");
    assert.equal(battery.voltage, 17.122);
    assert.equal(battery.cycleCount, 0);
    assert.equal(battery.timeRemaining, 0);
    assert.equal(battery.type, "Li-ion");
    assert.equal(battery.model, "R15B06W");
    assert.equal(battery.manufacturer, "SUNWODA");
    assert.equal(battery.serial, "MB100000797712460584");
  });

  it("maps the unplugged reading to a discharging state", () => {
    const battery = toSnapshotBattery(unpluggedReading());

    assert.equal(battery.powerState, "discharging");
    assert.equal(battery.isCharging, false);
    assert.equal(battery.acConnected, false);
    assertClose(battery.powerRate, -19.177);
    assert.equal(battery.percent, 102);
    // 57143 mWh at 19.177 W is 179 minutes; the 48 hour cap is far away here
    // and is covered by the parse-level test instead.
    assert.equal(battery.timeRemaining, 179);
    assert.ok(battery.timeRemaining <= 2880);
  });

  it("maps a charging reading to charging", () => {
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_STATUS=Charging", "POWER_SUPPLY_CAPACITY=60"),
    ]);
    assert.ok(reading);

    const battery = toSnapshotBattery(reading);

    assert.equal(battery.powerState, "charging");
    assert.equal(battery.isCharging, true);
  });

  it("reports an idle pack that is plugged in but not full", () => {
    const reading = parseSysfsBattery([
      energyPack(
        "POWER_SUPPLY_STATUS=Not charging",
        "POWER_SUPPLY_CAPACITY=80",
      ),
      node("AC", "POWER_SUPPLY_TYPE=Mains", "POWER_SUPPLY_ONLINE=1"),
    ]);
    assert.ok(reading);

    const battery = toSnapshotBattery(reading);

    // 80% is plugged in and not flowing, but below the full threshold.
    assert.equal(battery.powerState, "idle");
    assert.equal(battery.isCharging, false);
  });

  it("reports full from the kernel status without an adapter or a high percentage", () => {
    // Charge-limited machines stop short of 100 and some export no adapter node
    // at all; the driver's own status is the only signal left, so it has to be
    // enough on its own.
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_STATUS=Full", "POWER_SUPPLY_CAPACITY=90"),
    ]);
    assert.ok(reading);

    const battery = toSnapshotBattery(reading);

    assert.equal(battery.acConnected, false);
    assert.equal(battery.isCharging, false);
    assert.equal(battery.powerState, "full");
  });

  it("shows no percentage when the reading has none", () => {
    const reading = parseSysfsBattery([
      energyPack("POWER_SUPPLY_STATUS=Discharging"),
      node(
        "BAT1",
        "POWER_SUPPLY_TYPE=Battery",
        "POWER_SUPPLY_STATUS=Discharging",
        "POWER_SUPPLY_ENERGY_FULL=20000000",
        "POWER_SUPPLY_ENERGY_FULL_DESIGN=20000000",
      ),
    ]);
    assert.ok(reading);

    const battery = toSnapshotBattery(reading);

    // One pack never reported its stored energy, so the kernel percentage
    // cannot be formed for the set and the parse layer returns -1. The snapshot
    // contract has no "unknown", so it degrades to 0: the ratio of the partial
    // totals (25000 of 70000 mWh) would read as a plausible 35.7% and hide the
    // hole instead of showing an empty battery.
    assert.equal(reading.percent, -1);
    assert.equal(battery.percent, 0);
    // Health still describes the packs, so it stays computable from the sums.
    assertClose(battery.health, (100 * 70000) / 80000);
  });

  it("reports 0 percent when neither a percentage nor a capacity exists", () => {
    const reading = parseSysfsBattery([energyPack("POWER_SUPPLY_CAPACITY=68")]);
    assert.ok(reading);

    const battery = toSnapshotBattery({
      ...reading,
      percent: -1,
      maxCapacity: 0,
    });

    assert.equal(battery.percent, 0);
  });

  it("returns the no-battery block for a null reading", () => {
    const battery = toSnapshotBattery(null);

    assert.deepEqual(battery, {
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
    });
  });
});
