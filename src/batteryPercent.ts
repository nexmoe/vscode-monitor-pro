/**
 * Battery display percentages are clamped to 0-100 in this common layer, which
 * every backend (Go, systeminformation, mactop) flows through before reaching
 * the UI. Raw capacity values (designedCapacity, maxCapacity, currentCapacity)
 * are never modified - only the derived display values are normalized.
 */
export function clampBatteryPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  if (value > 100) {
    return 100;
  }
  return value;
}

export function normalizeBatteryPercentages(battery: {
  percent: number;
  health: number;
}): void {
  battery.percent = clampBatteryPercent(battery.percent);
  battery.health = clampBatteryPercent(battery.health);
}