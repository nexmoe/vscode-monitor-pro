import { commands, ExtensionContext, l10n, Uri, window, workspace } from "vscode";
import { ResourceUsageProvider } from "./resourceUsageProvider";
import { powerShellRelease, powerShellStart } from "systeminformation";
import { configManager } from "./configuration";
import { Metric, getEnabledMetrics } from "./metricsInit";
import { updateGlobalConfig } from "./metrics";
import { systemData } from "./systemData";
import { GoBackendManager } from "./goBackend";
import { GoDataSource, SIDataSource } from "./dataSource";
import { MactopBackendManager } from "./mactop-backend/mactopBackendManager";
import { MactopDataSource } from "./mactop-backend/mactopDataSource";
import { getLogger, initLogger } from "./logger";
import sourceMapSupport from "source-map-support";
import type { MetricsExist } from "./constants";
import { StatusBarManager } from "./statusBarManager";

let metrics: Metric[] = [];
let unsubscribeData: (() => void) | null = null;
let goBackend: GoBackendManager | null = null;
let mactopBackend: MactopBackendManager | null = null;
let statusBarManager: StatusBarManager;

/**
 * webview chart key -> corresponding status bar metric section.
 *
 * For example, netRx/netTx share the network dimension, diskRx/diskWx share
 * the fileSystem dimension, and batteryPower/battery share the battery
 * dimension. Enabling any chart in a group means the corresponding metric must
 * be collected.
 */
const CHART_TO_METRIC: Record<string, MetricsExist> = {
  cpu: "cpu",
  memActive: "memoryActive",
  memUsed: "memoryUsed",
  netRx: "network",
  netTx: "network",
  diskRx: "fileSystem",
  diskWx: "fileSystem",
  battery: "battery",
  batteryPower: "battery",
  cpuTemp: "cpuTemp",
  cpuSpeed: "cpuSpeed",
  diskSpace: "diskSpace",
  osDistro: "osDistro",
  uptime: "uptime",
};

/**
 * Compute the actual collection set as the union of status bar metrics.
 * switches and webview resourceUsage.charts.*.enabled.
 *
 * Both configurations are now unified: webview info cards (OS distro / uptime /
 * disk space) are also modeled as chart items and enabled by default. Any
 * metric enabled on either side (status bar or webview chart/card) is
 * collected; metrics disabled on both sides are not queried at all (true
 * on-demand querying).
 */
function computeEnabledMetrics(): Set<MetricsExist> {
  const enabled = new Set<MetricsExist>();
  const metricsEnabled = configManager.getMetricsEnabled();
  for (const [key, on] of Object.entries(metricsEnabled)) {
    if (on) {
      enabled.add(key as MetricsExist);
    }
  }
  const charts = configManager.getResourceUsageConfig().charts;
  for (const [chartKey, cfg] of Object.entries(charts)) {
    if (cfg.enabled && CHART_TO_METRIC[chartKey]) {
      enabled.add(CHART_TO_METRIC[chartKey]);
    }
  }
  return enabled;
}

const GO_BINARY_NAME = process.platform === "win32" ? "monitor.exe" : "monitor";

function getGoBinaryPath(ctx: ExtensionContext): string {
  return `${ctx.extensionPath}/go-backend/bin/${GO_BINARY_NAME}`;
}

function shouldUseGoBackend(): boolean {
  return process.platform === "win32";
}

/**
 * Use mactop as the backend data source on macOS Apple Silicon.
 * mactop runs a Prometheus HTTP server that provides SoC metrics such as
 * CPU/GPU/ANE power and temperature.
 */
function shouldUseMactopBackend(): boolean {
  return process.platform === "darwin" && process.arch === "arm64";
}

function applyFormatConfig() {
  const unitSystem = configManager.getUnitSystem();
  updateGlobalConfig(
    unitSystem === "binary",
    configManager.getShowSpace(),
    configManager.getSingleUnit(),
    configManager.getSignificantDigits(),
  );
}

function rebuildMetrics() {
  metrics.forEach((x) => x.dispose());
  statusBarManager.dispose();
  metrics = getEnabledMetrics(statusBarManager);
  // Sync the actual collection set (status bar + webview charts union) to the
  // data layer for on-demand querying.
  systemData.setEnabledMetrics(computeEnabledMetrics());
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

/**
 * Try to start the mactop backend.
 *
 * Flow: detect installation -> start() (reuse or create) ->
 * setSource(MactopDataSource). Falls back to SIDataSource + worker on failure.
 * On first run without mactop installed, prompt the user via a VS Code
 * notification.
 */
async function tryStartMactopBackend(ctx: ExtensionContext) {
  mactopBackend = new MactopBackendManager();

  if (!mactopBackend.isMactopInstalled()) {
    getLogger().warn(l10n.t("mactop is not installed, using fallback data source"));
    mactopBackend = null;
    // Prompt the user to install mactop
    const installAction = l10n.t("Install mactop");
    const dismissAction = l10n.t("Dismiss");
    const selection = await window.showInformationMessage(
      l10n.t(
        "mactop is not installed. Install it via Homebrew (brew install amoranth/brew/mactop) to enable macOS SoC monitoring (power, temperature, GPU).",
      ),
      installAction,
      dismissAction,
    );
    if (selection === installAction) {
      // Open the mactop installation page
      commands.executeCommand(
        "vscode.open",
        Uri.parse("https://github.com/context-labs/mactop"),
      );
    }
    systemData.setSource(new SIDataSource());
    systemData.useWorker();
    return;
  }

  try {
    await mactopBackend.start();
    systemData.setSource(new MactopDataSource(mactopBackend));
    getLogger().info(
      l10n.t(
        "mactop backend started on port {0}, source: {1}",
        mactopBackend.port!,
        systemData.sourceName,
      ),
    );
  } catch (err) {
    getLogger().warn(
      l10n.t("mactop backend unavailable: {0}, using fallback", String(err)),
    );
    mactopBackend?.stop();
    mactopBackend = null;
    systemData.setSource(new SIDataSource());
    systemData.useWorker();
  }
}

function initDataSource(ctx: ExtensionContext) {
  if (shouldUseGoBackend()) {
    tryStartGoBackend(ctx);
  } else if (shouldUseMactopBackend()) {
    tryStartMactopBackend(ctx);
  } else {
    getLogger().info(l10n.t("Using built-in data source: {0}", "systeminformation"));
    systemData.useWorker();
  }
}

export const activate = async (ctx: ExtensionContext) => {
  sourceMapSupport.install();
  initLogger("Monitor Pro");
  getLogger().info(l10n.t("Extension activating"));

  statusBarManager = new StatusBarManager();

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

  systemData.setInterval(configManager.getRefreshInterval());
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
      if (!configManager.isConfigChanged(event)) {
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
        systemData.setInterval(configManager.getRefreshInterval());
        getLogger().debug(
          l10n.t("Refresh interval updated to {0}ms", configManager.getRefreshInterval()),
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
        // Changes to webview chart enabled states affect the actual collection
        // set, so re-inject it.
        systemData.setEnabledMetrics(computeEnabledMetrics());
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
  mactopBackend?.stop();
  mactopBackend = null;
  unsubscribeData?.();
  systemData.stop();
  if (process.platform === "win32") {
    powerShellRelease();
  }
  metrics.forEach((x) => x.dispose());
  statusBarManager.dispose();
  getLogger().info(l10n.t("Disposed {0} metrics", metrics.length));
};
