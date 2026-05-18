import { ExtensionContext, window } from "vscode";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval } from "./configuration";
import { Metric, getEnabledMetrics, setLogger as setMetricsInitLogger } from "./metricsInit";
import { setLogger as setMetricsLogger } from "./metrics";
import I18n from "./i18n";

const log = window.createOutputChannel("Monitor Pro", { log: true });

let timeoutId: NodeJS.Timeout;
let metrics: Metric[] = [];

export const activate = async (ctx: ExtensionContext) => {
	log.info("activate() start");

	const logger = {
		debug: (msg: string) => log.debug(msg),
		warn: (msg: string) => log.warn(msg),
		error: (msg: string) => log.error(msg),
	};
	setMetricsLogger(logger);
	setMetricsInitLogger(logger);

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
	log.info(`platform=${process.platform}, arch=${process.arch}`);

	const scheduleUpdate = async () => {
		const t0 = Date.now();
		try {
			await Promise.all(metrics.map((x) => x.update()));
			log.debug(`update cycle OK (${Date.now() - t0}ms)`);
		} catch (e) {
			log.error("update cycle FAILED: " + String(e));
		}
		const interval = getRefreshInterval();
		log.debug(`next update in ${interval}ms`);
		timeoutId = setTimeout(scheduleUpdate, interval);
	};
	scheduleUpdate();
};

export const deactivate = () => {
	log.info("deactivate() called");
	if (process.platform === "win32") {
		powerShellRelease();
	}
	clearTimeout(timeoutId);
	metrics.forEach((x) => x.dispose());
	log.info(`disposed ${metrics.length} metrics`);
};
