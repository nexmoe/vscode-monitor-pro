import * as vscode from "vscode";
import metrics from "./metrics";
import { getMetrics, MetricsExist } from "./configuration";
import { MetricCtrProps } from "./constants";
import i18n from './i18n';

const _logger: { debug: (m: string) => void; warn: (m: string) => void; error: (m: string) => void } = {
	debug: () => {},
	warn: () => {},
	error: () => {},
};

export function setLogger(l: typeof _logger) {
	Object.assign(_logger, l);
}

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
		try {
			this.#bar.text = await this.#func();
			_logger.debug(`Metric[${this.#section}] updated OK: ${this.#bar.text}`);
		} catch (e) {
			_logger.error(`Metric[${this.#section}] update FAILED: ${String(e)}`);
			this.#bar.text = `$(error) ${this.#section}`;
		}
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

export const getEnabledMetrics = () => {
	const enabledSections = getMetrics() ?? [];
	_logger.debug(`getEnabledMetrics: enabledSections=${JSON.stringify(enabledSections)}`);
	return enabledSections.flatMap((x, index) => {
		const metric = metrics.find((m) => m.section === x);
		if (metric) {
			_logger.debug(`getEnabledMetrics: creating Metric[${x}] at priority ${-1e3 - index}`);
			return new Metric(metric).init(index);
		}
		_logger.warn(`getEnabledMetrics: section "${x}" not found, skipping`);
		return [];
	});
};
