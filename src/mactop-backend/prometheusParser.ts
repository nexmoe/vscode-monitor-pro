/**
 * Prometheus 文本格式解析器。
 *
 * mactop 通过 `--prometheus <port>` 启动后在 `/metrics` 端点暴露
 * Prometheus exposition format 文本。本解析器将其转为结构化对象，
 * 供 MactopDataSource 查询使用。
 *
 * 格式示例：
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
 * 解析 Prometheus exposition format 文本，返回所有指标行。
 * 跳过注释行（# HELP / # TYPE）和空行。
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
 * 解析标签字符串 `key="value",key2="value2"` 为对象。
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
 * 查找第一个匹配指定名称和标签条件的指标，返回其值。
 * 标签条件为空表示不筛选标签。
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
 * 判断指标标签是否包含所有指定的键值对。
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
