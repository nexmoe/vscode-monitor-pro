/**
 * The Resource Usage view's single card vocabulary.
 *
 * Everything the view knows about a card lives here: its identity, the metric
 * it subscribes to, how it renders, and the settings a fresh install starts
 * with. The declaration order is the default render order, so no separate
 * default-order list has to be maintained alongside the definitions.
 *
 * The label must stay a literal `l10n.t(...)` call at the definition site: the
 * `gen-l10n` exporter only extracts literal call arguments, so passing a
 * variable here would silently drop the title from the runtime bundle and
 * break `l10n:parity`.
 */
import { l10n } from "vscode";
import type { MetricsExist } from "./constants";

export type ResourceUsageCardKind = "chart" | "text" | "disk";

export type ResourceUsageCardView = "line" | "bar";

/**
 * What a card needs to offer the per-item ("array") view: which field of a
 * history sample holds one value per item, and how a cell is drawn from it.
 *
 * Cards without this field have no per-item dimension, so the webview must not
 * show the array toggle for them. `type` drives the cell semantics:
 *   percent - value is 0-100, usage colors, "%" label
 *   temp    - fixed 0-110 scale, thermal colors, "°C" label
 *   mem     - per-item used/total percent, tooltip shows name plus the
 *             byte-formatted used/total supplied by the extension
 */
export interface ResourceUsageCardArray {
  /** Field of a history sample holding the per-item values. */
  readonly field: string;
  readonly type: "percent" | "temp" | "mem";
  /** Prefix of the per-item label, e.g. "C" renders C0, C1, ... */
  readonly prefix: string;
  /** Set when the array holds objects and one key selects the value. */
  readonly valueKey?: string;
}

export interface ResourceUsageCard {
  readonly id: string;
  readonly kind: ResourceUsageCardKind;
  /**
   * Status bar metric section this card's data belongs to. Several cards may
   * share one section (network, fileSystem, battery), so an enabled card means
   * "collect this section", never "collect exactly one section".
   */
  readonly metric: MetricsExist;
  readonly label: string;
  readonly defaultEnabled: boolean;
  /** Only meaningful for real charts; text and disk cards ignore it. */
  readonly defaultView?: ResourceUsageCardView;
  /** Only meaningful for real charts; text and disk cards ignore it. */
  readonly defaultColor?: string;
  readonly array?: ResourceUsageCardArray;
}

export const RESOURCE_USAGE_CARDS: readonly ResourceUsageCard[] = [
  {
    id: "cpu",
    kind: "chart",
    metric: "cpu",
    label: l10n.t("CPU"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-blue",
    array: { field: "cpuCores", type: "percent", prefix: "C" },
  },
  {
    id: "memActive",
    kind: "chart",
    metric: "memoryActive",
    label: l10n.t("Mem Active"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-green",
  },
  {
    id: "memUsed",
    kind: "chart",
    metric: "memoryUsed",
    label: l10n.t("Mem Used"),
    defaultEnabled: false,
    defaultView: "line",
    defaultColor: "--vscode-charts-green",
  },
  {
    id: "netRx",
    kind: "chart",
    metric: "network",
    label: l10n.t("Network Down"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-orange",
  },
  {
    id: "netTx",
    kind: "chart",
    metric: "network",
    label: l10n.t("Network Up"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-purple",
  },
  {
    id: "diskRx",
    kind: "chart",
    metric: "fileSystem",
    label: l10n.t("Disk Read"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-yellow",
  },
  {
    id: "diskWx",
    kind: "chart",
    metric: "fileSystem",
    label: l10n.t("Disk Write"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-red",
  },
  {
    id: "battery",
    kind: "chart",
    metric: "battery",
    label: l10n.t("Battery"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-textLink-foreground",
  },
  {
    id: "batteryPower",
    kind: "chart",
    metric: "battery",
    label: l10n.t("Power (W)"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-green",
  },
  {
    id: "cpuTemp",
    kind: "chart",
    metric: "cpuTemp",
    label: l10n.t("CPU Temp"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-errorForeground",
    array: { field: "cpuTempCores", type: "temp", prefix: "C" },
  },
  {
    id: "cpuSpeed",
    kind: "chart",
    metric: "cpuSpeed",
    label: l10n.t("CPU Speed"),
    defaultEnabled: false,
    defaultView: "line",
    defaultColor: "--vscode-terminal-ansiBrightCyan",
  },
  // GPU cards are enabled by default; they appear once the active data source
  // reports live NVIDIA GPU data (no data -> the webview hides them via
  // UNAVAILABLE_CHECKERS). Only the status bar GPU metrics remain opt-in.
  {
    id: "gpu",
    kind: "chart",
    metric: "gpu",
    label: l10n.t("GPU"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-green",
    array: {
      field: "gpuCards",
      type: "percent",
      prefix: "G",
      valueKey: "utilization",
    },
  },
  {
    id: "gpuTemp",
    kind: "chart",
    metric: "gpuTemp",
    label: l10n.t("GPU Temp"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-orange",
    array: {
      field: "gpuCards",
      type: "temp",
      prefix: "G",
      valueKey: "temperature",
    },
  },
  {
    id: "gpuMem",
    kind: "chart",
    metric: "gpuMem",
    label: l10n.t("GPU Memory"),
    defaultEnabled: true,
    defaultView: "line",
    defaultColor: "--vscode-charts-purple",
    array: { field: "gpuCards", type: "mem", prefix: "G", valueKey: "memUsed" },
  },
  // The non-chart cards share the enabled switch and the collection logic with
  // the charts, which is why they are modeled here instead of as a separate
  // list. They are enabled by default so the view always shows uptime, the OS
  // distribution, and disk space.
  {
    id: "uptime",
    kind: "text",
    metric: "uptime",
    label: l10n.t("Uptime"),
    defaultEnabled: true,
  },
  {
    id: "osDistro",
    kind: "text",
    metric: "osDistro",
    label: l10n.t("OS Distro"),
    defaultEnabled: true,
  },
  {
    id: "diskSpace",
    kind: "disk",
    metric: "diskSpace",
    label: l10n.t("Disk Space"),
    defaultEnabled: true,
  },
];

export const RESOURCE_USAGE_CARD_IDS: readonly string[] =
  RESOURCE_USAGE_CARDS.map((card) => card.id);

const CARDS_BY_ID = new Map(
  RESOURCE_USAGE_CARDS.map((card) => [card.id, card] as const),
);

export function getResourceUsageCard(
  id: string,
): ResourceUsageCard | undefined {
  return CARDS_BY_ID.get(id);
}

/**
 * Resolve card ids to definitions, preserving the order given.
 *
 * Unknown ids are dropped rather than rejected: the order may still hold an id
 * removed from the registry (an older settings value, a hand-edited one), and a
 * stale entry must not stop the remaining cards from rendering.
 */
export function getResourceUsageCardsInOrder(
  order: readonly string[],
): ResourceUsageCard[] {
  const cards: ResourceUsageCard[] = [];
  for (const id of order) {
    const card = CARDS_BY_ID.get(id);
    if (card) {
      cards.push(card);
    }
  }
  return cards;
}

/**
 * Normalize a user-supplied card order against the known card ids.
 *
 * A settings array is user input and can be anything: missing, a scalar, an
 * object, numbers, duplicates, ids from a future or older version. The result
 * is always a permutation of `knownIds`: listed ids first in their listed
 * order, then every unlisted id in registry order. An absent or non-array value
 * means "not customized" and yields the registry order unchanged.
 */
export function normalizeChartsOrder(
  raw: unknown,
  knownIds: readonly string[],
): string[] {
  const known = new Set(knownIds);
  const ordered: string[] = [];
  const seen = new Set<string>();

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry !== "string") {
        continue;
      }
      if (!known.has(entry) || seen.has(entry)) {
        continue;
      }
      seen.add(entry);
      ordered.push(entry);
    }
  }

  for (const id of knownIds) {
    if (!seen.has(id)) {
      ordered.push(id);
    }
  }
  return ordered;
}
