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
