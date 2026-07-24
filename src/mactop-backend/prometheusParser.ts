/**
 * Prometheus text format parser.
 *
 * When launched with `--prometheus <port>`, mactop exposes the Prometheus
 * exposition format text at the `/metrics` endpoint. This parser converts that
 * text into a structured object for MactopDataSource to consume.
 *
 * Example format:
 *   # HELP mactop_cpu_usage_percent Current total CPU usage percentage
 *   # TYPE mactop_cpu_usage_percent gauge
 *   mactop_cpu_usage_percent 12.65
 *   mactop_power_watts{component="total"} 7.96
 */

export interface PrometheusMetric {
  name: string;
  labels: Record<string, string>;
  value: number;
}

/**
 * Parse Prometheus exposition format text and return all metric lines.
 * Skips comment lines (# HELP / # TYPE) and blank lines.
 */
export function parsePrometheusText(text: string): PrometheusMetric[] {
  const metrics: PrometheusMetric[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    let name: string;
    let labels: Record<string, string> = {};
    let valueStr: string;

    const braceStart = trimmed.indexOf("{");
    const braceEnd = trimmed.lastIndexOf("}");

    if (braceStart >= 0 && braceEnd > braceStart) {
      // metric_name{labels} value
      name = trimmed.substring(0, braceStart);
      const labelsStr = trimmed.substring(braceStart + 1, braceEnd);
      labels = parseLabels(labelsStr);
      valueStr = trimmed.substring(braceEnd + 1).trim();
    } else {
      // metric_name value
      const spaceIdx = trimmed.lastIndexOf(" ");
      if (spaceIdx < 0) continue;
      name = trimmed.substring(0, spaceIdx);
      valueStr = trimmed.substring(spaceIdx + 1).trim();
    }

    const value = parseFloat(valueStr);
    if (!isNaN(value)) {
      metrics.push({ name, labels, value });
    }
  }

  return metrics;
}

/**
 * Parse a label string `key="value",key2="value2"` into an object.
 */
function parseLabels(s: string): Record<string, string> {
  const labels: Record<string, string> = {};
  const regex = /(\w+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(s)) !== null) {
    labels[match[1]] = match[2];
  }
  return labels;
}

/**
 * Find the first metric matching the given name and optional label filter,
 * returning its value. An empty label filter means no label filtering.
 */
export function findMetricValue(
  metrics: PrometheusMetric[],
  name: string,
  labelFilter?: Record<string, string>,
): number | undefined {
  for (const m of metrics) {
    if (m.name !== name) continue;
    if (labelFilter && !matchesLabels(m.labels, labelFilter)) continue;
    return m.value;
  }
  return undefined;
}

/**
 * Check whether the metric labels contain all specified key/value pairs.
 */
function matchesLabels(
  labels: Record<string, string>,
  filter: Record<string, string>,
): boolean {
  for (const [key, val] of Object.entries(filter)) {
    if (labels[key] !== val) return false;
  }
  return true;
}
