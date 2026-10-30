import {
  workspace,
  ConfigurationChangeEvent,
  ConfigurationTarget,
} from "vscode";
import { MetricsExist } from "./constants";
import {
  RESOURCE_USAGE_CARDS,
  RESOURCE_USAGE_CARD_IDS,
  normalizeChartsOrder,
  type ResourceUsageCard,
} from "./resourceUsageCards";

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
  "gpu",
  "gpuTemp",
  "gpuMem",
  "osDistro",
  "diskSpace",
  "uptime",
];

export function getRefreshInterval(): number {
  return (
    workspace
      .getConfiguration(CONFIG_SECTION)
      .get<number>("refresh-interval") ?? 2000
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
    workspace
      .getConfiguration(CONFIG_SECTION)
      .get<"binary" | "decimal">("unitSystem") ?? "binary"
  );
}

export function getShowSpace(): boolean {
  return workspace
    .getConfiguration(CONFIG_SECTION)
    .get<boolean>("showSpace", false);
}

export function getSingleUnit(): boolean {
  return workspace
    .getConfiguration(CONFIG_SECTION)
    .get<boolean>("singleUnit", false);
}

export function getSignificantDigits(): Record<string, number> {
  return (
    workspace
      .getConfiguration(CONFIG_SECTION)
      .get<Record<string, number>>("significantDigits") ?? {}
  );
}

export function getFormatConfig() {
  return {
    unitSystem: getUnitSystem(),
    showSpace: getShowSpace(),
    singleUnit: getSingleUnit(),
    significantDigits: getSignificantDigits(),
  };
}

export function getUptimeFormat(): string {
  return workspace
    .getConfiguration(CONFIG_SECTION)
    .get<string>("uptimeFormat", "auto");
}

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
  /**
   * Card ids in render order. Always a full permutation of the registered ids,
   * so consumers never have to fill in cards the user did not list.
   */
  chartsOrder: string[];
  diskSpaceMounts: string[];
  samplingPoints: number;
}

/** Fresh-install settings for one card, taken from its registry entry. */
function defaultChartConfig(card: ResourceUsageCard): ResourceUsageChartConfig {
  const chart: ResourceUsageChartConfig = { enabled: card.defaultEnabled };
  if (card.defaultView !== undefined) {
    chart.view = card.defaultView;
  }
  if (card.defaultColor !== undefined) {
    chart.color = card.defaultColor;
  }
  return chart;
}

/**
 * The per-card defaults the view falls back to when the user's
 * `resourceUsage.charts` entry says nothing. Derived from the registry so a new
 * card needs no second declaration here.
 */
const DEFAULT_CHARTS: Record<string, ResourceUsageChartConfig> =
  Object.fromEntries(
    RESOURCE_USAGE_CARDS.map((card) => [card.id, defaultChartConfig(card)]),
  );

const CHART_SECTION = "resourceUsage";

export function getResourceUsageConfig(): ResourceUsageConfig {
  const config = workspace.getConfiguration(CONFIG_SECTION);
  const stored = config.get<Record<string, ResourceUsageChartConfig>>(
    `${CHART_SECTION}.charts`,
    {},
  );
  // Copy before hydrating. get() returns the manifest default object itself
  // when the user has not overridden the setting, so filling defaults in place
  // would write into that shared instance and leak this read's hydration into
  // every later read in the window.
  const charts: Record<string, ResourceUsageChartConfig> = {};
  for (const [key, value] of Object.entries(stored)) {
    charts[key] = { ...value };
  }
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
    chartsOrder: normalizeChartsOrder(
      config.get<unknown>(`${CHART_SECTION}.chartsOrder`, []),
      RESOURCE_USAGE_CARD_IDS,
    ),
    diskSpaceMounts: config.get<string[]>(`${CHART_SECTION}.diskSpaceMounts`, [
      "all",
    ]),
    samplingPoints: config.get<number>(`${CHART_SECTION}.samplingPoints`, 60),
  };
}

/**
 * The `resourceUsage` keys the webview's config message is built from, as the
 * user's own settings file holds them.
 *
 * `get()` returns the effective value (manifest default merged with every
 * layer), so writing it back would materialize the entire 17-card default block
 * in the user's file the first time they toggle a single view. `inspect()`'s
 * global value is the raw object the user actually wrote, which is what a
 * minimal patch has to start from. Any key the user never set stays undefined
 * instead of being pinned to the manifest default.
 */
export interface RawResourceUsageSettings {
  charts: unknown;
  chartsOrder: unknown;
  diskSpaceMounts: unknown;
  samplingPoints: unknown;
}

function globalValueOf<T>(key: string): T | undefined {
  return workspace.getConfiguration(CONFIG_SECTION).inspect<T>(key)
    ?.globalValue;
}

export function getRawResourceUsageSettings(): RawResourceUsageSettings {
  return {
    charts: globalValueOf(`${CHART_SECTION}.charts`),
    chartsOrder: globalValueOf(`${CHART_SECTION}.chartsOrder`),
    diskSpaceMounts: globalValueOf(`${CHART_SECTION}.diskSpaceMounts`),
    samplingPoints: globalValueOf(`${CHART_SECTION}.samplingPoints`),
  };
}

/**
 * Write one `resourceUsage` key at the user level.
 *
 * Global scope on purpose: these are view preferences, not project settings, and
 * a workspace-scoped write would hand a personal choice to everyone who opens the
 * repository. Only the addressed key is written, so the settings file keeps
 * holding exactly what the user changed.
 */
/** The `resourceUsage` keys the view is allowed to write back. */
export type ResourceUsageBackWriteKey = "charts" | "chartsOrder";

export function updateResourceUsageSetting(
  key: ResourceUsageBackWriteKey,
  value: unknown,
): Thenable<void> {
  return workspace
    .getConfiguration(CONFIG_SECTION)
    .update(`${CHART_SECTION}.${key}`, value, ConfigurationTarget.Global);
}

export function getDiskSpaceConfig(): string[] {
  return (
    workspace.getConfiguration(CONFIG_SECTION).get<string[]>("diskSpace") ?? [
      "/",
      "C:",
    ]
  );
}

export function isConfigChanged(event: ConfigurationChangeEvent): boolean {
  return event.affectsConfiguration(CONFIG_SECTION);
}

export { MetricsExist };
