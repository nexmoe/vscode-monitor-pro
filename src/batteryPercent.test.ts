import { strict as assert } from "assert";
import {
  clampBatteryPercent,
  normalizeBatteryPercentages,
} from "./batteryPercent";

// Mirrors the health calculation used by the systeminformation and mactop
// data sources: (maxCapacity / designedCapacity) * 100.
function health(full: number, design: number): number {
  if (!full || !design) {
    return 0;
  }
  return (full / design) * 100;
}

describe("clampBatteryPercent", () => {
  const cases: Array<[string, number, number]> = [
    ["above 100 clamps to 100", 101, 100],
    ["far above 100 clamps to 100", 150, 100],
    ["exactly 100 stays 100", 100, 100],
    ["within range stays unchanged", 75, 75],
    ["exactly 0 stays 0", 0, 0],
    ["negative clamps to 0", -5, 0],
    ["NaN clamps to 0", Number.NaN, 0],
  ];
  for (const [name, input, expected] of cases) {
    it(name, () => {
      assert.equal(clampBatteryPercent(input), expected);
    });
  }
});

describe("battery health display", () => {
  const cases: Array<[string, number, number, number]> = [
    ["full capacity above design shows 100", 5300, 5000, 100],
    ["full capacity equals design shows 100", 5000, 5000, 100],
    ["degraded battery shows 80", 4000, 5000, 80],
  ];
  for (const [name, full, design, expected] of cases) {
    it(name, () => {
      assert.equal(clampBatteryPercent(health(full, design)), expected);
    });
  }

  it("missing capacity shows 0", () => {
    assert.equal(clampBatteryPercent(health(0, 5000)), 0);
  });

  it("zero design capacity shows 0", () => {
    assert.equal(clampBatteryPercent(health(5000, 0)), 0);
  });
});

describe("normalizeBatteryPercentages", () => {
  it("clamps percent and health while preserving raw capacity", () => {
    const battery = {
      designedCapacity: 5000,
      maxCapacity: 5300,
      currentCapacity: 2500,
      percent: 101,
      health: 150,
    };
    normalizeBatteryPercentages(battery);
    assert.equal(battery.percent, 100);
    assert.equal(battery.health, 100);
    assert.equal(battery.designedCapacity, 5000);
    assert.equal(battery.maxCapacity, 5300);
    assert.equal(battery.currentCapacity, 2500);
  });

  it("leaves valid values unchanged", () => {
    const battery = { percent: 42, health: 80 };
    normalizeBatteryPercentages(battery);
    assert.equal(battery.percent, 42);
    assert.equal(battery.health, 80);
  });
});