import * as vscode from "vscode";
import metrics from "./metrics";
import { getMetrics, MetricsExist } from "./configuration";
import { MetricCtrProps } from "./constants";
import i18n from './i18n';

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
			throw new Error("Metric not initialized");
		}
		this.#bar.text = await this.#func();
	}

	dispose() {
		this.#bar?.dispose();
	}
}

const newBarItem = ({ priority,section }: { priority: number, section: MetricsExist }) => {
	const title = i18n.t(`metric.${section}.name`);

	const sbi = vscode.window.createStatusBarItem(
		`Monitor Pro: ${title}`,
		vscode.StatusBarAlignment.Left,
		priority
	);
	
	sbi.show();
	sbi.tooltip = title;
	sbi.name = sbi.id;
	return sbi;
};

const allMetrics = getMetrics.flatMap((x) => {
	const metric = metrics.find((m) => m.section === x);
	if(metric) {
		return new Metric(metric);
	} else {
		return [];
	}
});
export const getEnabledMetrics = () =>
	allMetrics.flatMap((x, index) => x.init(index) || []);
