import * as vscode from "vscode";
import { MetricsExist } from "./constants";
import { getLogger } from "./logger";

/**
 * Unified manager for status bar items.
 *
 * Handles creation, ordering, and disposal of all status bar items,
 * centralizing the priority and alignment logic that was previously
 * scattered across metricsInit.ts.
 */
export class StatusBarManager {
  private items: Map<string, vscode.StatusBarItem> = new Map();

  /**
   * Create a new status bar item for the given metric section.
   */
  create(section: MetricsExist, index: number): vscode.StatusBarItem {
    const priority = -1e3 - index;
    const title = getMetricTitle(section);

    const item = vscode.window.createStatusBarItem(
      vscode.l10n.t("Monitor Pro: {0}", title),
      vscode.StatusBarAlignment.Left,
      priority,
    );

    item.show();
    item.tooltip = title;
    item.name = item.id;

    this.items.set(section, item);

    getLogger().debug(
      vscode.l10n.t(
        "Created status bar item for [{0}] at priority {1}",
        section,
        priority,
      ),
    );

    return item;
  }

  /**
   * Get an existing status bar item by section name.
   */
  get(section: string): vscode.StatusBarItem | undefined {
    return this.items.get(section);
  }

  /**
   * Remove and dispose a specific status bar item.
   */
  remove(section: string): void {
    const item = this.items.get(section);
    if (item) {
      item.dispose();
      this.items.delete(section);
    }
  }

  /**
   * Dispose all managed status bar items.
   */
  dispose(): void {
    for (const [, item] of this.items) {
      item.dispose();
    }
    this.items.clear();
  }

  /**
   * Number of managed items.
   */
  get size(): number {
    return this.items.size;
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
