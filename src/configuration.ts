import { workspace, ConfigurationChangeEvent } from "vscode";
import { MetricsExist } from "./constants";

const CONFIG_SECTION = "monitor-pro";

const allMetrics: MetricsExist[] = [
  "cpu",
  "memoryActive",
  "memoryUsed",
  "network",
  "fileSystem",
  "battery",
  "cpuTemp",
  "cpuSpeed",
  "osDistro",
  "diskSpace",
  "uptime",
];

const DEFAULT_CHARTS: Record<string, ResourceUsageChartConfig> = {
  cpu: { enabled: true, view: "line", color: "--vscode-charts-blue" },
  memActive: { enabled: true, view: "line", color: "--vscode-charts-green" },
  memUsed: { enabled: false, view: "line", color: "--vscode-charts-green" },
  netRx: { enabled: true, view: "line", color: "--vscode-charts-orange" },
  netTx: { enabled: true, view: "line", color: "--vscode-charts-purple" },
  diskRx: { enabled: true, view: "line", color: "--vscode-charts-yellow" },
  diskWx: { enabled: true, view: "line", color: "--vscode-charts-red" },
  battery: {
    enabled: true,
    view: "line",
    color: "--vscode-textLink-foreground",
  },
  batteryPower: { enabled: true, view: "line", color: "--vscode-charts-green" },
  cpuTemp: { enabled: true, view: "line", color: "--vscode-errorForeground" },
  cpuSpeed: {
    enabled: false,
    view: "line",
    color: "--vscode-terminal-ansiBrightCyan",
  },
  // Info cards are also modeled as chart config items so they share the enabled
  // switch and collection logic. They are enabled by default so the resource
  // view always shows OS distro, uptime, and disk space.
  osDistro: { enabled: true },
  uptime: { enabled: true },
  diskSpace: { enabled: true },
};

const CHART_SECTION = "resourceUsage";

export interface ResourceUsageChartConfig {
  enabled: boolean;
  // The following fields only matter for real charts (canvas line/bar).
  // Info cards (osDistro / uptime / diskSpace) only use enabled and ignore
  // view and color.
  view?: "line" | "bar";
  color?: string;
}

export interface ResourceUsageConfig {
  charts: Record<string, ResourceUsageChartConfig>;
  diskSpaceMounts: string[];
  samplingPoints: number;
}

/**
 * Centrally manages all Monitor Pro configuration access.
 *
 * Provides typed getter methods for every configuration property,
 * centralizing the workspace.getConfiguration() calls that were
 * previously scattered across individual exported functions.
 */
export class ConfigManager {
  /**
   * Get the refresh interval in milliseconds.
   */
  getRefreshInterval(): number {
    return this.get<number>("refresh-interval", 2000);
  }

  /**
   * Get the enabled/disabled state for all metrics.
   */
  getMetricsEnabled(): Record<MetricsExist, boolean> {
    const result = {} as Record<MetricsExist, boolean>;
    for (const metric of allMetrics) {
      result[metric] = this.get<boolean>(`metrics.${metric}`, true);
    }
    return result;
  }

  /**
   * Get the display order of metrics.
   */
  getMetricsOrder(): MetricsExist[] {
    return this.get<MetricsExist[]>("metricsOrder", allMetrics);
  }

  /**
   * Get the unit system (binary or decimal).
   */
  getUnitSystem(): "binary" | "decimal" {
    return this.get<"binary" | "decimal">("unitSystem", "binary");
  }

  /**
   * Get whether to show a space between value and unit.
   */
  getShowSpace(): boolean {
    return this.get<boolean>("showSpace", false);
  }

  /**
   * Get whether to use single unit (auto-scale).
   */
  getSingleUnit(): boolean {
    return this.get<boolean>("singleUnit", false);
  }

  /**
   * Get the significant digits configuration per metric.
   */
  getSignificantDigits(): Record<string, number> {
    return this.get<Record<string, number>>("significantDigits", {});
  }

  /**
   * Get the combined format configuration.
   */
  getFormatConfig() {
    return {
      unitSystem: this.getUnitSystem(),
      showSpace: this.getShowSpace(),
      singleUnit: this.getSingleUnit(),
      significantDigits: this.getSignificantDigits(),
    };
  }

  /**
   * Get the uptime display format string.
   */
  getUptimeFormat(): string {
    return this.get<string>("uptimeFormat", "auto");
  }

  /**
   * Get the resource usage webview configuration (charts, mounts, sampling).
   */
  getResourceUsageConfig(): ResourceUsageConfig {
    const charts = this.get<Record<string, ResourceUsageChartConfig>>(
      `${CHART_SECTION}.charts`,
      {},
    );
    for (const key of Object.keys(DEFAULT_CHARTS)) {
      if (!charts[key]) {
        charts[key] = { ...DEFAULT_CHARTS[key] };
      } else {
        if (charts[key].color === undefined) {
          charts[key].color = DEFAULT_CHARTS[key].color;
        }
      }
    }
    return {
      charts,
      diskSpaceMounts: this.get<string[]>(`${CHART_SECTION}.diskSpaceMounts`, [
        "all",
      ]),
      samplingPoints: this.get<number>(`${CHART_SECTION}.samplingPoints`, 60),
    };
  }

  /**
   * Get the disk space mount paths to monitor.
   */
  getDiskSpaceConfig(): string[] {
    return this.get<string[]>("diskSpace", ["/", "C:"]);
  }

  /**
   * Check if a configuration change event affects Monitor Pro settings.
   */
  isConfigChanged(event: ConfigurationChangeEvent): boolean {
    return event.affectsConfiguration(CONFIG_SECTION);
  }

  private get<T>(key: string, defaultValue: T): T {
    return workspace
      .getConfiguration(CONFIG_SECTION)
      .get<T>(key, defaultValue);
  }
}

// Singleton instance for use across the extension.
export const configManager = new ConfigManager();

// Re-export types for backward compatibility.
export { MetricsExist };
