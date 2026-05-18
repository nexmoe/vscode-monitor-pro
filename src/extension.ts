import { commands, ExtensionContext, l10n, window } from "vscode";
import { TaskManagerProvider } from "./taskManagerProvider";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval } from "./configuration";
import { Metric, getEnabledMetrics, setLogger as setMetricsInitLogger } from "./metricsInit";
import { setLogger as setMetricsLogger } from "./metrics";
import { systemData } from "./systemData";

const log = window.createOutputChannel("Monitor Pro", { log: true });

let metrics: Metric[] = [];
let unsubscribeData: (() => void) | null = null;

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

	const taskManagerProvider = new TaskManagerProvider(ctx.extensionPath);
	ctx.subscriptions.push(
		window.registerWebviewViewProvider(TaskManagerProvider.viewType, taskManagerProvider),
		commands.registerCommand("monitor-pro.focusTaskManager", () => {
			commands.executeCommand("workbench.view.extension.monitor-pro");
		}),
	);
	log.info(l10n.t("Task Manager view registered"));

	systemData.setInterval(getRefreshInterval());
	systemData.start();

	unsubscribeData = systemData.subscribe(() => {
		const t0 = Date.now();
		Promise.all(metrics.map((x) => x.update())).then(() => {
			const elapsed = Date.now() - t0;
			log.debug(l10n.t("Update cycle completed in {0}ms", elapsed));
		}).catch((e) => {
			log.error(l10n.t("Update cycle failed: {0}", String(e)));
		});
	});
};

export const deactivate = () => {
	log.info(l10n.t("Extension deactivating"));
	unsubscribeData?.();
	systemData.stop();
	if (process.platform === "win32") {
		powerShellRelease();
	}
	metrics.forEach((x) => x.dispose());
	log.info(l10n.t("Disposed {0} metrics", metrics.length));
};
