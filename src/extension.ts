// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { workspace, ExtensionContext } from "vscode";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval } from "./configuration";
import { Metric, getEnabledMetrics } from "./metricsInit";
import I18n from "./i18n";

let intervalIds: NodeJS.Timeout;
let metrics: Metric[] = [];

// workspace.onDidChangeConfiguration(() => {
// 	deactivate();
// 	activate();
// });

export const activate = async (ctx: ExtensionContext) => {
	if (process.platform === "win32") {
		powerShellStart();
	}
	I18n.init(ctx.extensionPath);
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
