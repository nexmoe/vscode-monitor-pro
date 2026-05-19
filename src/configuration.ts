import { workspace, ConfigurationChangeEvent } from "vscode";
import { MetricsExist } from "./constants";

const CONFIG_SECTION = "monitor-pro";

const allMetrics: MetricsExist[] = [
  "cpu", "memoryActive", "memoryUsed", "network", "fileSystem",
  "battery", "cpuTemp", "cpuSpeed", "osDistro", "diskSpace", "uptime",
];

export function getRefreshInterval(): number {
  return (
    workspace.getConfiguration(CONFIG_SECTION).get<number>("refresh-interval") ?? 2000
  );
}

export function getMetricsEnabled(): Record<MetricsExist, boolean> {
  const config = workspace.getConfiguration(CONFIG_SECTION);
  const result = {} as Record<MetricsExist, boolean>;
  for (const metric of allMetrics) {
    result[metric] = config.get<boolean>(`metrics.${metric}`, true);
  }
  return result;
}

export function getMetricsOrder(): MetricsExist[] {
  const config = workspace.getConfiguration(CONFIG_SECTION);
  return config.get<MetricsExist[]>("metricsOrder", allMetrics);
}

export function getUnitSystem(): "binary" | "decimal" {
  return (
    workspace.getConfiguration(CONFIG_SECTION).get<"binary" | "decimal">("unitSystem") ?? "binary"
  );
}

export function getShowSpace(): boolean {
  return workspace.getConfiguration(CONFIG_SECTION).get<boolean>("showSpace", false);
}

export function getSingleUnit(): boolean {
  return workspace.getConfiguration(CONFIG_SECTION).get<boolean>("singleUnit", false);
}

export function getSignificantDigits(): Record<string, number> {
  return workspace.getConfiguration(CONFIG_SECTION).get<Record<string, number>>("significantDigits") ?? {};
}

export function getFormatConfig() {
  return {
    unitSystem: getUnitSystem(),
    showSpace: getShowSpace(),
    significantDigits: getSignificantDigits(),
  };
}

export function getUptimeFormat(): string {
  return workspace.getConfiguration(CONFIG_SECTION).get<string>("uptimeFormat", "auto");
}

export interface ResourceUsageChartConfig {
  enabled: boolean;
  view: "line" | "bar";
  color?: string;
}

export interface ResourceUsageConfig {
  charts: Record<string, ResourceUsageChartConfig>;
  diskSpaceMounts: string[];
}

const DEFAULT_CHARTS: Record<string, ResourceUsageChartConfig> = {
  cpu:       { enabled: true,  view: "line", color: "--vscode-charts-blue" },
  memActive: { enabled: true,  view: "line", color: "--vscode-charts-green" },
  memUsed:   { enabled: false, view: "line", color: "--vscode-charts-green" },
  netRx:     { enabled: true,  view: "line", color: "--vscode-charts-orange" },
  netTx:     { enabled: true,  view: "line", color: "--vscode-charts-purple" },
  diskRx:    { enabled: true,  view: "line", color: "--vscode-charts-yellow" },
  diskWx:    { enabled: true,  view: "line", color: "--vscode-charts-red" },
  battery:   { enabled: true,  view: "line", color: "--vscode-textLink-foreground" },
  cpuTemp:   { enabled: true,  view: "line", color: "--vscode-errorForeground" },
  cpuSpeed:  { enabled: true,  view: "line", color: "--vscode-terminal-ansiBrightCyan" },
};

const CHART_SECTION = "resourceUsage";

export function getResourceUsageConfig(): ResourceUsageConfig {
  const config = workspace.getConfiguration(CONFIG_SECTION);
  const charts = config.get<Record<string, ResourceUsageChartConfig>>(`${CHART_SECTION}.charts`, {});
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
    diskSpaceMounts: config.get<string[]>(`${CHART_SECTION}.diskSpaceMounts`, ["all"]),
  };
}



export function getDiskSpaceConfig(): string[] {
  return (
    workspace.getConfiguration(CONFIG_SECTION).get<string[]>("diskSpace") ?? [
      "/", "C:",
    ]
  );
}

export function isConfigChanged(event: ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(CONFIG_SECTION);
}

export { MetricsExist };
