/**
 * Normalization layer for the battery values the UI shows.
 *
 * Percent clamping and power-state derivation live in the same module because
 * both are derived display values and every backend (Go, systeminformation,
 * mactop, Linux sysfs) passes through here: one definition keeps the platforms
 * from drifting apart. Raw capacity values (designedCapacity, maxCapacity,
 * currentCapacity) are never modified - only the derived display values are
 * normalized.
 *
 * No `vscode` import: the collector worker thread loads this module too.
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

/**
 * Percentage from which a plugged-in, idle pack counts as full.
 *
 * Not exactly 100: charge limits and drivers stop a fraction short of the
 * nominal maximum, and a pack held at 99.6% is full for every practical
 * purpose.
 */
export const FULL_PERCENT_THRESHOLD = 99.5;

export interface BatteryFlowState {
  charging: boolean;
  discharging: boolean;
  /**
   * The backend's own full-charge flag, false when it has none.
   *
   * Only some backends report it (the Linux kernel status does,
   * systeminformation does not), and it outranks the percentage: a pack held at
   * a charge limit sits below the threshold while the driver still calls it
   * full, and a pack whose adapter node is missing has no AC flag to pair the
   * percentage with.
   */
  full: boolean;
  acConnected: boolean;
  percent: number;
}

/**
 * Power state to display, derived from the flow the backend reported.
 *
 * Charging and discharging win over everything else, or a pack that still moves
 * current would be labelled full just because it sits at 100. When the pack is
 * at rest, a reported full-charge status is authoritative; falling back to "on
 * AC and near the top" covers the backends that only say whether the adapter is
 * connected, so the percentage is the last resort rather than the only signal.
 */
export function deriveBatteryPowerState(
  input: BatteryFlowState,
): "charging" | "discharging" | "full" | "idle" {
  if (input.charging) {
    return "charging";
  }
  if (input.discharging) {
    return "discharging";
  }
  if (
    input.full ||
    (input.acConnected && input.percent >= FULL_PERCENT_THRESHOLD)
  ) {
    return "full";
  }
  return "idle";
}
