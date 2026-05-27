import * as vscode from "vscode";

export function formatEstimatedBatteryTime(
  powerRate: number,
  maxCapacity: number,
  currentCapacity: number,
  isCharging: boolean,
): string {
  if (powerRate === 0 || maxCapacity <= 0 || currentCapacity <= 0) {
    return "";
  }

  const powerMw = Math.abs(powerRate) * 1000;
  if (powerMw < 1) return "";

  const remainingHours = isCharging
    ? (maxCapacity - currentCapacity) / powerMw
    : currentCapacity / powerMw;

  if (remainingHours <= 0 || remainingHours > 48) return "";

  const totalMinutes = Math.round(remainingHours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (isCharging) {
    return vscode.l10n.t("{0}h {1}m until full", h, m);
  }
  return vscode.l10n.t("{0}h {1}m until empty", h, m);
}
