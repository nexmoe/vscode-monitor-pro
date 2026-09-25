import { exec } from "child_process";
import { promisify } from "util";
import {
  commands,
  ExtensionContext,
  l10n,
  ProgressLocation,
  window,
  workspace,
} from "vscode";
import { ResourceUsageProvider } from "./resourceUsageProvider";
import { getRefreshInterval, isConfigChanged } from "./configuration";
import { Metric, getEnabledMetrics } from "./metricsInit";
import { systemData } from "./systemData";
import { NativeBackendManager } from "./backend/nativeBackendManager";
import { MACTOP_SPEC, createGoSpec } from "./backend/spec";
import { GoDataSource, SIDataSource, type DataSource } from "./dataSource";
import { MactopDataSource } from "./mactop-backend/mactopDataSource";
import { getMetricsEnabled, getResourceUsageConfig } from "./configuration";
import { getLogger, initLogger } from "./logger";
import sourceMapSupport from "source-map-support";
import type { MetricsExist } from "./constants";

let metrics: Metric[] = [];
let unsubscribeData: (() => void) | null = null;
/**
 * The one native backend this window runs, if any: the Go binary on Windows,
 * mactop on Apple Silicon, null while the built-in data source is active.
 * The platform branches are mutually exclusive, so one slot covers both.
 */
let activeBackend: NativeBackendManager | null = null;

const execAsync = promisify(exec);

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
  gpu: "gpu",
  gpuTemp: "gpuTemp",
  gpuMem: "gpuMem",
  diskSpace: "diskSpace",
  osDistro: "osDistro",
  uptime: "uptime",
};

/**
 * Compute the actual collection set as the union of status bar metrics.*
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
  const metricsEnabled = getMetricsEnabled();
  for (const [key, on] of Object.entries(metricsEnabled)) {
    if (on) {
      enabled.add(key as MetricsExist);
    }
  }
  const charts = getResourceUsageConfig().charts;
  for (const [chartKey, cfg] of Object.entries(charts)) {
    if (cfg.enabled && CHART_TO_METRIC[chartKey]) {
      enabled.add(CHART_TO_METRIC[chartKey]);
    }
  }
  return enabled;
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

function rebuildMetrics() {
  metrics.forEach((x) => x.dispose());
  metrics = getEnabledMetrics();
  // Sync the actual collection set (status bar + webview charts union) to the
  // data layer for on-demand querying.
  systemData.setEnabledMetrics(computeEnabledMetrics());
  getLogger().info(l10n.t("Metrics initialized: {0}", metrics.length));
}

/**
 * Start a native backend and wire its data source — the one start path shared
 * by the Go and the mactop backend (both are shared, refcounted HTTP servers;
 * see NativeBackendManager for the process lifecycle).
 *
 * A failed start is reported and returns false without falling back to the
 * in-process data source: the user opted into this backend (by platform on
 * Windows, by the mactop setting on Apple Silicon), and collecting nothing is
 * preferable to silently collecting with different semantics. On mactop, the
 * only way onward is the manual switch in offerBuiltinDataSource().
 */
async function startBackend(
  manager: NativeBackendManager,
  makeSource: (manager: NativeBackendManager) => DataSource,
): Promise<boolean> {
  activeBackend = manager;
  try {
    await manager.start();
    systemData.setSource(makeSource(manager));
    return true;
  } catch (err) {
    activeBackend = null;
    await manager.stop();
    getLogger().error(
      l10n.t(
        "{0} backend failed to start: {1}",
        manager.displayName,
        String(err),
      ),
    );
    return false;
  }
}

/**
 * Wire the built-in systeminformation data source and start polling.
 *
 * This is a choice, never an automatic fallback: it only runs after the user
 * explicitly opted out of mactop (the setting, "Don't show again", or the
 * switch button in the failure notification), or on a platform where mactop
 * does not apply at all. Callers guarantee no native backend is running by
 * the time they get here.
 *
 * Order matters: useWorker() must be called before start() so the worker is
 * actually launched; setSource() must come first so the worker collects from
 * the right source. The interval is set here (not only in activate) because
 * the failure-notification button can switch long after activation, when
 * nothing else would start the loop.
 */
function useBuiltInDataSource() {
  activeBackend = null;
  systemData.stop();
  systemData.setSource(new SIDataSource());
  systemData.useWorker();
  systemData.setInterval(getRefreshInterval());
  systemData.start();
}

/**
 * Tell the user mactop failed and offer the one manual path to the built-in
 * data source. Deliberately not awaited by its callers: activation must not
 * block on the answer, and the switch (when clicked) runs after activation
 * has already finished.
 *
 * Clicking the button persists the opt-out, so later activations go straight
 * to the built-in source instead of hitting the same failure again.
 */
async function offerBuiltinDataSource(message: string): Promise<void> {
  const useBuiltinAction = l10n.t("Use built-in data source");
  const selection = await window.showErrorMessage(message, useBuiltinAction);
  if (selection !== useBuiltinAction) {
    return;
  }
  await workspace
    .getConfiguration("monitor-pro")
    .update("mactop.enabled", false, true);
  getLogger().info(
    l10n.t("mactop is disabled via settings, using the built-in data source"),
  );
  useBuiltInDataSource();
}

/**
 * Try to start the mactop backend.
 *
 * While the setting is on (the default), mactop is the one and only data
 * source: a missing or failing mactop leaves metrics off rather than
 * silently switching to systeminformation. The built-in source requires an
 * explicit choice — the setting itself, "Don't show again", or the switch
 * button in the failure notification (see offerBuiltinDataSource).
 *
 * On first run without mactop installed, prompt the user via a VS Code
 * notification offering auto-install (brew install mactop), "Don't show
 * again", and Dismiss. "Don't show again" persists via the
 * monitor-pro.mactop.enabled setting so users can re-enable it in settings.
 */
async function tryStartMactopBackend(): Promise<boolean> {
  // Respect the monitor-pro.mactop.enabled setting first: when the user
  // disabled mactop (e.g. via "Don't show again"), the built-in data source
  // is their explicit choice, even if mactop is already installed.
  const config = workspace.getConfiguration("monitor-pro");
  if (!config.get<boolean>("mactop.enabled", true)) {
    getLogger().info(
      l10n.t("mactop is disabled via settings, using the built-in data source"),
    );
    useBuiltInDataSource();
    return true;
  }

  const manager = new NativeBackendManager(MACTOP_SPEC);
  // Set when this activation just installed mactop, so the success toast is
  // not shown to users whose mactop was already present.
  let freshlyInstalled = false;
  if (!manager.isInstalled()) {
    getLogger().warn(l10n.t("mactop is not installed"));

    const autoInstallAction = l10n.t("Auto install");
    const neverAction = l10n.t("Don't show again");
    const dismissAction = l10n.t("Dismiss");
    const selection = await window.showInformationMessage(
      l10n.t("mactop is not installed. Auto-install runs: brew install mactop"),
      autoInstallAction,
      neverAction,
      dismissAction,
    );

    if (selection === neverAction) {
      // Persisting the opt-out is one of the explicit switches to the
      // built-in data source.
      await config.update("mactop.enabled", false, true);
      useBuiltInDataSource();
      return true;
    }

    if (selection !== autoInstallAction) {
      // Dismissed: metrics stay off for this session; the prompt returns on
      // the next activation.
      return false;
    }

    const installed = await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: l10n.t("Installing mactop…"),
      },
      async () => {
        try {
          // brew install streams a lot of output (often > 1MB);
          // raise maxBuffer so a successful install is not misreported as
          // a failure due to buffer overflow.
          await execAsync("brew install mactop", {
            maxBuffer: 10 * 1024 * 1024,
          });
          return true;
        } catch {
          return false;
        }
      },
    );

    // isInstalled() re-resolves the binary, so the same manager picks up the
    // freshly installed executable.
    if (!installed || !manager.isInstalled()) {
      // Not awaited: activation must not block on the notification, and the
      // switch (if clicked) runs after activation has finished.
      void offerBuiltinDataSource(
        l10n.t(
          "Failed to install mactop. Please try manually: brew install mactop",
        ),
      );
      return false;
    }
    freshlyInstalled = true;
  }

  const started = await startBackend(manager, (m) => new MactopDataSource(m));
  if (started) {
    if (freshlyInstalled) {
      window.showInformationMessage(l10n.t("mactop installed successfully!"));
    }
    return true;
  }

  // Same reason as above: fire-and-forget, the answer cannot block activation.
  void offerBuiltinDataSource(
    l10n.t(
      "mactop failed to start, metrics are disabled. Fix mactop, or switch to the built-in data source",
    ),
  );
  return false;
}

async function initDataSource(ctx: ExtensionContext): Promise<boolean> {
  if (shouldUseGoBackend()) {
    return startBackend(
      new NativeBackendManager(createGoSpec(ctx.extensionPath)),
      (m) => new GoDataSource(m),
    );
  }
  if (shouldUseMactopBackend()) {
    // Awaited, so activation does not continue against a data source that is
    // about to be replaced by mactop (see the view registration in activate).
    return tryStartMactopBackend();
  }
  getLogger().info(
    l10n.t("Using built-in data source: {0}", "systeminformation"),
  );
  useBuiltInDataSource();
  return true;
}

export const activate = async (ctx: ExtensionContext) => {
  sourceMapSupport.install();
  initLogger("Monitor Pro");
  getLogger().info(l10n.t("Extension activating"));

  rebuildMetrics();
  getLogger().info(
    l10n.t("Platform: {0}, Architecture: {1}", process.platform, process.arch),
  );

  // The data source is resolved before the view is registered: the webview
  // snapshots source-dependent config (powerMode) when it resolves and does not
  // re-read it, so registering it first would freeze the pre-mactop value in any
  // window whose panel is already visible.
  const sourceReady = await initDataSource(ctx);

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

  if (sourceReady) {
    systemData.setInterval(getRefreshInterval());
    systemData.start();
  }

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
        // Changes to webview chart enabled states affect the actual collection
        // set, so re-inject it.
        systemData.setEnabledMetrics(computeEnabledMetrics());
        resourceUsageProvider.pushConfigUpdate();
        getLogger().debug(l10n.t("Resource Usage view config pushed"));
      }
    }),
  );
};

export const deactivate = async () => {
  getLogger().info(l10n.t("Extension deactivating"));
  const backend = activeBackend;
  activeBackend = null;
  unsubscribeData?.();
  systemData.stop();
  metrics.forEach((x) => x.dispose());
  getLogger().info(l10n.t("Disposed {0} metrics", metrics.length));
  // Awaited last: the backend is shared and refcounted, so stopping it may
  // need to wait out the SIGTERM grace period before its process is killed, and
  // the polling loop must already be stopped so no collection races it.
  await backend?.stop();
};
