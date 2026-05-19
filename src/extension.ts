import { ExtensionContext, l10n, window } from "vscode";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval } from "./configuration";
import { Metric, getEnabledMetrics, setLogger as setMetricsInitLogger } from "./metricsInit";
import { setLogger as setMetricsLogger } from "./metrics";

const log = window.createOutputChannel("Monitor Pro", { log: true });

let timeoutId: NodeJS.Timeout;
let metrics: Metric[] = [];

export const activate = async (ctx: ExtensionContext) => {
	log.info(l10n.t("Extension activating"));

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

	metrics.forEach((x) => x.dispose());
	metrics = getEnabledMetrics();
	log.info(l10n.t("Metrics initialized: {0}", metrics.length));
	log.info(l10n.t("Platform: {0}, Architecture: {1}", process.platform, process.arch));

	const scheduleUpdate = async () => {
		const t0 = Date.now();
		try {
			await Promise.all(metrics.map((x) => x.update()));
			const elapsed = Date.now() - t0;
			log.debug(l10n.t("Update cycle completed in {0}ms", elapsed));
		} catch (e) {
			log.error(l10n.t("Update cycle failed: {0}", String(e)));
		}
		const interval = getRefreshInterval();
		log.debug(l10n.t("Next update scheduled in {0}ms", interval));
		timeoutId = setTimeout(scheduleUpdate, interval);
	};
	scheduleUpdate();
};

export const deactivate = () => {
	log.info(l10n.t("Extension deactivating"));
	if (process.platform === "win32") {
		powerShellRelease();
	}
	clearTimeout(timeoutId);
	metrics.forEach((x) => x.dispose());
	log.info(l10n.t("Disposed {0} metrics", metrics.length));
};
