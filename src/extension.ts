// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval } from "./configuration";
import { Metric, getEnabledMetrics } from "./metricsInit";

let intervalIds: NodeJS.Timeout;
let metrics: Metric[] = [];

vscode.workspace.onDidChangeConfiguration(() => {
	deactivate();
	activate();
});


export const activate = async () => {
	if (process.platform === "win32") {
		powerShellStart();
	}
	metrics.forEach((x) => x.dispose());
	metrics = getEnabledMetrics();
	const updateBarsText = async () =>
		await Promise.all(metrics.map((x) => x.update()));
	intervalIds = setInterval(updateBarsText, getRefreshInterval());
};

export const deactivate = () => {
	if (process.platform === "win32") {
		powerShellRelease();
	}
	clearInterval(intervalIds);
	metrics.forEach((x) => x.dispose());
};
