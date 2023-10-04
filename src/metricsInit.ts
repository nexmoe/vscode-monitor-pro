import * as vscode from "vscode";
import metrics from "./metrics";
import { getOrder } from "./configuration";
import { MetricCtrProps, OrderConfigurationKey } from "./constants";

export class Metric {
	#func: () => Promise<string>;
	#name: string;
	#section: OrderConfigurationKey;
	#bar: vscode.StatusBarItem | null = null;

	constructor({ func, name, section }: MetricCtrProps) {
		this.#func = func;
		this.#name = name;
		this.#section = section;
	}

	init() {
		const order = getOrder(this.#section);
		if (!order) {
			return;
		}
		this.#bar = newBarItem({ name: this.#name, priority: -1e3 - order });
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

const allMetrics = metrics.map((x) => new Metric(x));
export const getEnabledMetrics = () =>
	allMetrics.flatMap((x) => x.init() || []);
