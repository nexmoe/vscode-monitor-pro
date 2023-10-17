import metrics from "./metrics";

export const metricsExist: string[] = metrics.map((x) => x.section);

export type MetricsExist = (typeof metricsExist)[number];

export interface MetricCtrProps {
	func: () => Promise<string>;
	section: MetricsExist;
}
