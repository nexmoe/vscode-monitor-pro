import * as vscode from "vscode";
import metrics from "./metrics";
import { configManager, MetricsExist } from "./configuration";
import { MetricCtrProps } from "./constants";
import { getLogger } from "./logger";
import { StatusBarManager } from "./statusBarManager";

export class Metric {
  #func: () => Promise<string>;
  #bar: vscode.StatusBarItem | null = null;
  #section: MetricsExist;

  constructor({ func, section }: MetricCtrProps) {
    this.#func = func;
    this.#section = section;
  }

  init(index: number, barManager: StatusBarManager) {
    this.#bar = barManager.create(this.#section, index);
    this.update();
    return this;
  }

  async update() {
    if (!this.#bar) {
      throw new Error(vscode.l10n.t("Metric not initialized"));
    }
    try {
      this.#bar.text = await this.#func();
      getLogger().debug(
        vscode.l10n.t(
          "Metric [{0}] updated: {1}",
          this.#section,
          this.#bar.text,
        ),
      );
    } catch (e) {
      getLogger().error(
        vscode.l10n.t(
          "Metric [{0}] update failed: {1}",
          this.#section,
          String(e),
        ),
      );
    }
  }

  dispose() {
    this.#bar?.dispose();
  }
}

export const getEnabledMetrics = (barManager: StatusBarManager) => {
  const enabled = configManager.getMetricsEnabled();
  const order = configManager.getMetricsOrder();
  getLogger().debug(vscode.l10n.t("Enabled metrics: {0}", JSON.stringify(enabled)));
  getLogger().debug(vscode.l10n.t("Metrics order: {0}", JSON.stringify(order)));

  return order.flatMap((section, index) => {
    if (!enabled[section]) {
      getLogger().debug(
        vscode.l10n.t('Metric "{0}" disabled by user, skipping', section),
      );
      return [];
    }
    const metric = metrics.find((m) => m.section === section);
    if (metric) {
      getLogger().debug(
        vscode.l10n.t(
          "Creating metric [{0}] at priority {1}",
          section,
          -1e3 - index,
        ),
      );
      return new Metric(metric).init(index, barManager);
    }
    getLogger().warn(
      vscode.l10n.t('Metric section "{0}" not found, skipping', section),
    );
    return [];
  });
};
