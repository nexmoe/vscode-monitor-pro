import * as vscode from "vscode";
import metrics from "./metrics";
import {
  getMetricsEnabled,
  getMetricsOrder,
  MetricsExist,
} from "./configuration";
import { MetricCtrProps } from "./constants";

const _logger: {
  debug: (m: string) => void;
  warn: (m: string) => void;
  error: (m: string) => void;
} = {
  debug: () => {},
  warn: () => {},
  error: () => {},
};

export function setLogger(l: typeof _logger) {
  Object.assign(_logger, l);
}

export class Metric {
  #func: () => Promise<string>;
  #bar: vscode.StatusBarItem | null = null;
  #section: MetricsExist;

  constructor({ func, section }: MetricCtrProps) {
    this.#func = func;
    this.#section = section;
  }

  init(index: number) {
    this.#bar = newBarItem({ priority: -1e3 - index, section: this.#section });
    this.update();
    return this;
  }

  async update() {
    if (!this.#bar) {
      throw new Error(vscode.l10n.t("Metric not initialized"));
    }
    try {
      this.#bar.text = await this.#func();
      _logger.debug(
        vscode.l10n.t(
          "Metric [{0}] updated: {1}",
          this.#section,
          this.#bar.text,
        ),
      );
    } catch (e) {
      _logger.error(
        vscode.l10n.t(
          "Metric [{0}] update failed: {1}",
          this.#section,
          String(e),
        ),
      );
      this.#bar.text = vscode.l10n.t("$(error) {0}", this.#section);
    }
  }

  dispose() {
    this.#bar?.dispose();
  }
}

function getMetricTitle(section: MetricsExist): string {
  switch (section) {
    case "cpu":
      return vscode.l10n.t("CPU Usage");
    case "memoryActive":
      return vscode.l10n.t("Memory Active");
    case "memoryUsed":
      return vscode.l10n.t("Memory Used");
    case "network":
      return vscode.l10n.t("Network (Down/Up)");
    case "fileSystem":
      return vscode.l10n.t("File System (Read/Write)");
    case "battery":
      return vscode.l10n.t("Battery Status");
    case "cpuTemp":
      return vscode.l10n.t("CPU Temperature");
    case "cpuSpeed":
      return vscode.l10n.t("CPU Speed");
    case "osDistro":
      return vscode.l10n.t("OS Distribution");
    case "diskSpace":
      return vscode.l10n.t("Storage Space");
    case "uptime":
      return vscode.l10n.t("Running Time");
  }
  return section;
}

const newBarItem = ({
  priority,
  section,
}: {
  priority: number;
  section: MetricsExist;
}) => {
  const title = getMetricTitle(section);

  const sbi = vscode.window.createStatusBarItem(
    vscode.l10n.t("Monitor Pro: {0}", title),
    vscode.StatusBarAlignment.Left,
    priority,
  );

  sbi.show();
  sbi.tooltip = title;
  sbi.name = sbi.id;
  return sbi;
};

export const getEnabledMetrics = () => {
  const enabled = getMetricsEnabled();
  const order = getMetricsOrder();
  _logger.debug(vscode.l10n.t("Enabled metrics: {0}", JSON.stringify(enabled)));
  _logger.debug(vscode.l10n.t("Metrics order: {0}", JSON.stringify(order)));

  return order.flatMap((section, index) => {
    if (!enabled[section]) {
      _logger.debug(
        vscode.l10n.t('Metric "{0}" disabled by user, skipping', section),
      );
      return [];
    }
    const metric = metrics.find((m) => m.section === section);
    if (metric) {
      _logger.debug(
        vscode.l10n.t(
          "Creating metric [{0}] at priority {1}",
          section,
          -1e3 - index,
        ),
      );
      return new Metric(metric).init(index);
    }
    _logger.warn(
      vscode.l10n.t('Metric section "{0}" not found, skipping', section),
    );
    return [];
  });
};
