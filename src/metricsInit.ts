import * as vscode from "vscode";
import metrics from "./metrics";
import { getMetrics } from "./configuration";
import { MetricCtrProps } from "./constants";

export class Metric {
	#func: () => Promise<string>;
	#name: string;
	#bar: vscode.StatusBarItem | null = null;

	constructor({ func, name }: MetricCtrProps) {
		this.#func = func;
		this.#name = name;
	}

	init(index: number) {
		this.#bar = newBarItem({ name: this.#name, priority: -1e3 - index });
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

const newBarItem = ({ name, priority }: { name: string; priority: number }) => {
	const sbi = vscode.window.createStatusBarItem(
		`Monitor Pro: ${name}`,
		vscode.StatusBarAlignment.Left,
		priority
	);
	sbi.show();
	sbi.tooltip = name;
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
