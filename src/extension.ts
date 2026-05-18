import { ExtensionContext, window } from "vscode";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval } from "./configuration";
import { Metric, getEnabledMetrics } from "./metricsInit";
import I18n from "./i18n";

const log = window.createOutputChannel("Monitor Pro", { log: true });

let timeoutId: NodeJS.Timeout;
let metrics: Metric[] = [];

export const activate = async (ctx: ExtensionContext) => {
	log.info("activate() start");
	if (process.platform === "win32") {
		powerShellStart();
	}
	try {
		I18n.init(ctx.extensionPath);
		log.info("I18n.init OK");
	} catch (e) {
		log.error("I18n.init FAILED: " + String(e));
	}
	metrics.forEach((x) => x.dispose());
	metrics = getEnabledMetrics();
	log.info(`metrics created: ${metrics.length}`);
	const scheduleUpdate = async () => {
		try {
			await Promise.all(metrics.map((x) => x.update()));
			// log.info("update cycle OK");
		} catch (e) {
			log.error("update cycle FAILED: " + String(e));
		}
		timeoutId = setTimeout(scheduleUpdate, getRefreshInterval());
	};
	scheduleUpdate();
};

export const deactivate = () => {
	if (process.platform === "win32") {
		powerShellRelease();
	}
	clearTimeout(timeoutId);
	metrics.forEach((x) => x.dispose());
};
