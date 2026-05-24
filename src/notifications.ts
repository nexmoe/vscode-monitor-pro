import { l10n, window } from "vscode";
import { systemData } from "./systemData";
import { getNotificationConfig, NotificationConfig, NotificationMetric } from "./configuration";
import { getLogger } from "./logger";

type AlertState = "normal" | "alerting";

function getMetricLabel(id: NotificationMetric): string {
  switch (id) {
    case "cpu":
      return l10n.t("CPU usage");
    case "memoryActive":
      return l10n.t("Active memory");
    case "memoryUsed":
      return l10n.t("Total memory");
    case "cpuTemp":
      return l10n.t("CPU temperature");
    case "battery":
      return l10n.t("Battery level");
  }
}

class NotificationManager {
  private _alertStates = new Map<string, AlertState>();
  private _config: NotificationConfig;

  constructor() {
    this._config = getNotificationConfig();
  }

  refreshConfig() {
    this._config = getNotificationConfig();
    if (!this._config.enabled) {
      this._alertStates.clear();
    }
  }

  check() {
    if (!this._config.enabled) {
      return;
    }

    const snapshot = systemData.snapshot;
    if (!snapshot) {
      return;
    }

    this._checkThreshold("cpu", snapshot.currentLoad, this._config.cpu, true);
    this._checkThreshold(
      "memoryActive",
      snapshot.mem.total > 0 ? (snapshot.mem.active / snapshot.mem.total) * 100 : 0,
      this._config.memoryActive,
      true,
    );
    this._checkThreshold(
      "memoryUsed",
      snapshot.mem.total > 0 ? (snapshot.mem.used / snapshot.mem.total) * 100 : 0,
      this._config.memoryUsed,
      true,
    );

    if (snapshot.cpuTemperature.main > 0) {
      this._checkThreshold(
        "cpuTemp",
        snapshot.cpuTemperature.main,
        this._config.cpuTemp,
        true,
      );
    }

    if (snapshot.battery.hasBattery) {
      if (this._config.batteryLow > 0 && !snapshot.battery.isCharging) {
        this._checkThreshold(
          "battery",
          snapshot.battery.percent,
          this._config.batteryLow,
          false,
        );
      }
      if (this._config.batteryHigh > 0 && snapshot.battery.isCharging) {
        this._checkThreshold(
          "battery",
          snapshot.battery.percent,
          this._config.batteryHigh,
          true,
        );
      }
    }
  }

  private _checkThreshold(id: string, value: number, threshold: number, alertAbove: boolean) {
    if (threshold <= 0) {
      return;
    }

    const triggered = alertAbove ? value >= threshold : value <= threshold;
    const prevState = this._alertStates.get(id) ?? "normal";

    if (triggered && prevState === "normal") {
      this._alertStates.set(id, "alerting");
      const rounded = Math.round(value);
      const label = this._getLabel(id);
      window
        .showWarningMessage(
          l10n.t("{0}: {1}% (threshold: {2}%)", label, rounded, threshold),
        )
        .then(undefined, () => {
          getLogger().debug(l10n.t("Notification dismissed for {0}", id));
        });
      getLogger().info(l10n.t("Notification triggered: {0} value={1}% threshold={2}%", id, rounded, threshold));
    } else if (!triggered && prevState === "alerting") {
      this._alertStates.set(id, "normal");
      getLogger().debug(l10n.t("Notification state reset: {0}", id));
    }
  }

  private _getLabel(id: string): string {
    return getMetricLabel(id as NotificationMetric) || id;
  }

  dispose() {
    this._alertStates.clear();
  }
}

export const notificationManager = new NotificationManager();