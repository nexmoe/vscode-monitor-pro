import { commands, ExtensionContext, l10n, window, workspace } from "vscode";
import { TaskManagerProvider } from "./taskManagerProvider";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval, isConfigChanged } from "./configuration";
import { Metric, getEnabledMetrics, setLogger as setMetricsInitLogger } from "./metricsInit";
import { setLogger as setMetricsLogger, updateGlobalConfig } from "./metrics";
import { systemData } from "./systemData";
import { getUnitSystem, getShowSpace, getSingleUnit, getSignificantDigits } from "./configuration";

const log = window.createOutputChannel("Monitor Pro", { log: true });

let metrics: Metric[] = [];
let unsubscribeData: (() => void) | null = null;

function applyFormatConfig() {
  const unitSystem = getUnitSystem();
  updateGlobalConfig(
    unitSystem === "binary",
    getShowSpace(),
    getSingleUnit(),
    getSignificantDigits(),
  );
}

function rebuildMetrics() {
  metrics.forEach((x) => x.dispose());
  metrics = getEnabledMetrics();
  log.info(l10n.t("Metrics initialized: {0}", metrics.length));
}

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

  applyFormatConfig();
  rebuildMetrics();
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

  // ── Hot-reload: react to config changes without restart ──
  ctx.subscriptions.push(
    workspace.onDidChangeConfiguration((event) => {
      if (!isConfigChanged(event)) {
        return;
      }

      log.info(l10n.t("Configuration changed, hot-reloading"));

      // 1. Format config: unit system, space, significant digits
      if (event.affectsConfiguration("monitor-pro.unitSystem") ||
          event.affectsConfiguration("monitor-pro.showSpace") ||
          event.affectsConfiguration("monitor-pro.singleUnit") ||
          event.affectsConfiguration("monitor-pro.significantDigits")) {
        applyFormatConfig();
        log.debug(l10n.t("Format config updated"));
      }

      // 2. Refresh interval
      if (event.affectsConfiguration("monitor-pro.refresh-interval")) {
        systemData.setInterval(getRefreshInterval());
        log.debug(l10n.t("Refresh interval updated to {0}ms", getRefreshInterval()));
      }

      // 3. Metrics enabled/order changed → rebuild status bar items
      if (event.affectsConfiguration("monitor-pro.metrics") ||
          event.affectsConfiguration("monitor-pro.metricsOrder") ||
          event.affectsConfiguration("monitor-pro.uptimeFormat")) {
        rebuildMetrics();
        log.debug(l10n.t("Metrics rebuilt"));
      }

      // 4. Disk space config changed
      if (event.affectsConfiguration("monitor-pro.diskSpace")) {
        log.debug(l10n.t("Disk space config updated"));
      }
    }),
  );
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
