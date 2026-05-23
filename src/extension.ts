import { commands, ExtensionContext, l10n, window, workspace } from "vscode";
import { ResourceUsageProvider } from "./resourceUsageProvider";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { getRefreshInterval, isConfigChanged } from "./configuration";
import { Metric, getEnabledMetrics } from "./metricsInit";
import { updateGlobalConfig } from "./metrics";
import { systemData } from "./systemData";
import { GoBackendManager } from "./goBackend";
import { GoDataSource, SIDataSource } from "./dataSource";
import {
  getUnitSystem,
  getShowSpace,
  getSingleUnit,
  getSignificantDigits,
} from "./configuration";
import { getLogger, initLogger } from "./logger";
import sourceMapSupport from "source-map-support";

let metrics: Metric[] = [];
let unsubscribeData: (() => void) | null = null;
let goBackend: GoBackendManager | null = null;

const GO_BINARY_NAME = process.platform === "win32" ? "monitor.exe" : "monitor";

function getGoBinaryPath(ctx: ExtensionContext): string {
  return `${ctx.extensionPath}/go-backend/bin/${GO_BINARY_NAME}`;
}

function shouldUseGoBackend(): boolean {
  return process.platform === "win32";
}

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
  getLogger().info(l10n.t("Metrics initialized: {0}", metrics.length));
}

function tryStartGoBackend(ctx: ExtensionContext) {
  const binaryPath = getGoBinaryPath(ctx);
  goBackend = new GoBackendManager();
  goBackend
    .start(binaryPath)
    .then(() => {
      systemData.setSource(new GoDataSource(goBackend!));
      getLogger().info(
        l10n.t(
          "Go backend started on port {0}, source: {1}",
          goBackend!.port!,
          systemData.sourceName,
        ),
      );
    })
    .catch((err) => {
      getLogger().warn(
        l10n.t("Go backend unavailable: {0}, using fallback", String(err)),
      );
      goBackend?.stop();
      goBackend = null;
      systemData.setSource(new SIDataSource());
    });
}

function initDataSource(ctx: ExtensionContext) {
  if (shouldUseGoBackend()) {
    tryStartGoBackend(ctx);
  } else {
    getLogger().info(l10n.t("Using built-in data source: {0}", "systeminformation"));
    systemData.useWorker();
  }
}

export const activate = async (ctx: ExtensionContext) => {
  sourceMapSupport.install();
  initLogger("Monitor Pro");
  getLogger().info(l10n.t("Extension activating"));

  if (process.platform === "win32") {
    powerShellStart();
  }

  applyFormatConfig();
  rebuildMetrics();
  getLogger().info(
    l10n.t("Platform: {0}, Architecture: {1}", process.platform, process.arch),
  );

  const resourceUsageProvider = new ResourceUsageProvider(ctx.extensionPath);
  ctx.subscriptions.push(
    window.registerWebviewViewProvider(
      ResourceUsageProvider.viewType,
      resourceUsageProvider,
    ),
    commands.registerCommand("monitor-pro.focusResourceUsage", () => {
      commands.executeCommand("workbench.view.extension.monitor-pro");
    }),
  );
  getLogger().info(l10n.t("Resource Usage view registered"));

  initDataSource(ctx);

  systemData.setInterval(getRefreshInterval());
  systemData.start();

  unsubscribeData = systemData.subscribe(() => {
    const t0 = Date.now();
    Promise.all(metrics.map((x) => x.update()))
      .then(() => {
        const elapsed = Date.now() - t0;
        getLogger().debug(l10n.t("Update cycle completed in {0}ms", elapsed));
      })
      .catch((e) => {
        getLogger().error(l10n.t("Update cycle failed: {0}", String(e)));
      });
  });

  // ── Hot-reload: react to config changes without restart ──
  ctx.subscriptions.push(
    workspace.onDidChangeConfiguration((event) => {
      if (!isConfigChanged(event)) {
        return;
      }

      getLogger().info(l10n.t("Configuration changed, hot-reloading"));

      if (
        event.affectsConfiguration("monitor-pro.unitSystem") ||
        event.affectsConfiguration("monitor-pro.showSpace") ||
        event.affectsConfiguration("monitor-pro.singleUnit") ||
        event.affectsConfiguration("monitor-pro.significantDigits")
      ) {
        applyFormatConfig();
        getLogger().debug(l10n.t("Format config updated"));
      }

      if (event.affectsConfiguration("monitor-pro.refresh-interval")) {
        systemData.setInterval(getRefreshInterval());
        getLogger().debug(
          l10n.t("Refresh interval updated to {0}ms", getRefreshInterval()),
        );
      }

      if (
        event.affectsConfiguration("monitor-pro.metrics") ||
        event.affectsConfiguration("monitor-pro.metricsOrder") ||
        event.affectsConfiguration("monitor-pro.uptimeFormat")
      ) {
        rebuildMetrics();
        getLogger().debug(l10n.t("Metrics rebuilt"));
      }

      if (event.affectsConfiguration("monitor-pro.diskSpace")) {
        getLogger().debug(l10n.t("Disk space config updated"));
      }

      if (
        event.affectsConfiguration("monitor-pro.resourceUsage") ||
        event.affectsConfiguration("monitor-pro.metrics.uptime") ||
        event.affectsConfiguration("monitor-pro.metrics.osDistro")
      ) {
        resourceUsageProvider.pushConfigUpdate();
        getLogger().debug(l10n.t("Resource Usage view config pushed"));
      }
    }),
  );
};

export const deactivate = () => {
  getLogger().info(l10n.t("Extension deactivating"));
  goBackend?.stop();
  goBackend = null;
  unsubscribeData?.();
  systemData.stop();
  if (process.platform === "win32") {
    powerShellRelease();
  }
  metrics.forEach((x) => x.dispose());
  getLogger().info(l10n.t("Disposed {0} metrics", metrics.length));
};
