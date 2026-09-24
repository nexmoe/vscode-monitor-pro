/**
 * Lifecycle of a native backend shared by every VS Code window.
 *
 * mactop and the Windows Go binary are both long-running local HTTP servers, so
 * they follow one lifecycle:
 *
 * 1. Claim a usage marker before anything else, so a window that is shutting
 *    down does not stop an instance this window is about to reuse.
 * 2. Reuse the published instance when it is alive and healthy; otherwise spawn
 *    a detached process on a port chosen here and publish it.
 * 3. Publish with an exclusive create: two windows starting at the same time
 *    cannot both claim the instance, and the loser discards its own process.
 * 4. On shutdown, drop the marker and stop the backend only when no other
 *    window is left. The instance is unpublished before any signal is sent, so
 *    a window activating meanwhile starts a fresh one instead of adopting an
 *    instance that is already dying.
 *
 * Data shaping lives in the data sources; this manager only owns the process
 * and the HTTP transport.
 */

import { spawn, ChildProcess } from "child_process";
import { l10n } from "vscode";
import { getLogger } from "../logger";
import type { NativeBackendSpec } from "./types";
import { UsageRegistry } from "./usageRegistry";
import {
  deletePortFileIfOwned,
  findFreePort,
  httpGet,
  isProcessAlive,
  readPortFile,
  removePortFile,
  terminateProcess,
  writePortFile,
  type HttpResult,
  type PortFileContent,
} from "./backendLifecycle";

const HEALTH_CHECK_TIMEOUT = 500;
const STARTUP_TIMEOUT = 10000;
const HEALTH_POLL_INTERVAL = 300;
const REQUEST_TIMEOUT = 5000;

export class NativeBackendManager {
  private _process: ChildProcess | null = null;
  private _port: number | null = null;
  private _ready = false;
  private _binaryPath: string | null = null;
  /** Backend process backing this window, whether spawned here or reused. */
  private _backendPid: number | null = null;
  private _registered = false;
  private readonly _registry: UsageRegistry;

  constructor(private readonly spec: NativeBackendSpec) {
    this._registry = new UsageRegistry(spec.markerDir, spec.markerPidField);
  }

  get ready(): boolean {
    return this._ready;
  }

  get port(): number | null {
    return this._port;
  }

  /**
   * Detect whether the backend is installed. The resolved path is cached for
   * the later start() call, because resolving may probe the file system or PATH.
   */
  isInstalled(): boolean {
    this._binaryPath = this.spec.resolveBinary();
    return this._binaryPath !== null;
  }

  /**
   * Start or reuse the backend.
   *
   * Reuse is tried first; otherwise a detached process is spawned on a free
   * port, waited for over HTTP, then published for the other windows.
   */
  async start(): Promise<void> {
    // Claiming first keeps a window that shuts down right now from stopping the
    // instance this window is about to reuse.
    this._registry.register();
    this._registered = true;

    const existing = await this._tryReuse();
    if (existing !== null) {
      this._adopt(existing);
      this._logReused(existing.port);
      return;
    }

    // Resolved on demand: isInstalled() is the caller's pre-check, but start()
    // does not depend on having been called first.
    if (this._binaryPath === null) {
      this._binaryPath = this.spec.resolveBinary();
    }
    if (!this._binaryPath) {
      throw new Error(`${this.spec.id} binary not found`);
    }

    const port = await findFreePort();
    await this._spawnProcess(port);
    this._port = port;
    this._ready = true;

    const published: PortFileContent = { port, pid: this._backendPid! };
    const publishResult = writePortFile(this.spec.portFile, published);
    if (publishResult !== "ok") {
      if (publishResult === "error") {
        getLogger().warn(
          l10n.t("Failed to write {0} port file", this.spec.displayName),
        );
      }

      // Another window claimed the backend first, so its instance is the shared
      // one: drop ours and use theirs.
      await terminateProcess(published.pid, 0);
      this._process = null;
      this._backendPid = null;
      this._port = null;
      this._ready = false;

      const winner = await this._tryReuse();
      if (winner === null) {
        throw new Error(`${this.spec.id} backend instance could not be published`);
      }
      this._adopt(winner);
      this._logReused(winner.port);
      return;
    }

    this._registry.attach(port, published.pid);
    getLogger().info(
      l10n.t(
        "{0} backend started on port {1}",
        this.spec.displayName,
        String(port),
      ),
    );
  }

  /**
   * Release this window's claim on the backend.
   *
   * The backend is shared by every VS Code window, so it is only stopped here
   * when this is the last window using it; otherwise the others keep reusing it
   * through the port file.
   */
  async stop(): Promise<void> {
    const backendPid = this._backendPid;
    const port = this._port;

    this._process = null;
    this._backendPid = null;
    this._port = null;
    this._ready = false;

    if (!this._registered) {
      return;
    }
    this._registered = false;

    // Drop our own marker before counting the others, so a window stopping at
    // the same time cannot count us as a live user of the shared instance.
    this._registry.unregister();

    if (backendPid === null || port === null) {
      // start() never got as far as a process; nothing was published.
      return;
    }

    if (this._registry.hasOtherLiveHosts(backendPid)) {
      getLogger().info(
        l10n.t(
          "{0} backend kept alive, other VS Code windows still use it",
          this.spec.displayName,
        ),
      );
      return;
    }

    // Unpublish before signalling: the instance is doomed from here on, and a
    // window activating right now must start a fresh one rather than adopt this
    // one and lose it mid-flight. The port file is only removed while it still
    // describes this instance, since another window may have published a newer
    // one in the meantime.
    deletePortFileIfOwned(this.spec.portFile, { port, pid: backendPid });
    const killed = await terminateProcess(backendPid, this.spec.graceMs);
    if (killed) {
      getLogger().warn(
        l10n.t(
          "{0} process (PID {1}) did not exit, killing it",
          this.spec.displayName,
          String(backendPid),
        ),
      );
    }
    getLogger().info(
      l10n.t(
        "{0} backend shut down, no other VS Code window is using it",
        this.spec.displayName,
      ),
    );
  }

  /**
   * GET a backend path. Returns null on connection error or timeout; the data
   * source decides what a useful response looks like.
   */
  request(pathname: string, timeoutMs: number = REQUEST_TIMEOUT): Promise<HttpResult | null> {
    if (!this._ready || this._port === null) {
      return Promise.resolve(null);
    }
    return httpGet(this._port, pathname, timeoutMs);
  }

  /** Record a reused instance without owning it. */
  private _adopt(instance: PortFileContent): void {
    this._process = null;
    this._port = instance.port;
    this._backendPid = instance.pid;
    this._ready = true;
    this._registry.attach(instance.port, instance.pid);
  }

  private _logReused(port: number): void {
    getLogger().info(
      l10n.t(
        "{0} backend reused on port {1}",
        this.spec.displayName,
        String(port),
      ),
    );
  }

  /**
   * Try to reuse the published instance. Returns null when there is none, when
   * its process is gone, or when it fails the health check; a published record
   * that cannot be used is removed so this window is able to publish its own.
   */
  private async _tryReuse(): Promise<PortFileContent | null> {
    const published = readPortFile(this.spec.portFile);
    if (published === null) {
      return null;
    }

    if (!isProcessAlive(published.pid)) {
      getLogger().info(
        l10n.t(
          "{0} process (PID {1}) not alive, starting new",
          this.spec.displayName,
          String(published.pid),
        ),
      );
      removePortFile(this.spec.portFile);
      return null;
    }

    if (!(await this._healthCheck(published.port))) {
      getLogger().info(
        l10n.t(
          "{0} backend on port {1} failed health check, starting new",
          this.spec.displayName,
          String(published.port),
        ),
      );
      removePortFile(this.spec.portFile);
      return null;
    }

    return published;
  }

  private async _healthCheck(port: number): Promise<boolean> {
    const res = await httpGet(port, this.spec.healthPath, HEALTH_CHECK_TIMEOUT);
    return res !== null && res.status === 200;
  }

  /**
   * Spawn the backend detached so it survives this window, and wait until it
   * answers the health check.
   *
   * stdout is ignored: neither backend needs to report anything back, and an
   * unread pipe would fill up and block the process. stderr is kept for
   * diagnostics.
   */
  private _spawnProcess(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this._process = spawn(this._binaryPath!, this.spec.spawnArgs(port), {
          stdio: ["ignore", "ignore", "pipe"],
          detached: true,
          windowsHide: true,
        });
      } catch (err) {
        reject(err);
        return;
      }

      // Recorded before the health check so a timed-out startup can still be
      // torn down by the caller's stop().
      this._backendPid = this._process.pid ?? null;

      this._process.stderr?.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) {
          getLogger().warn(
            l10n.t("{0} stderr: {1}", this.spec.displayName, msg),
          );
        }
      });

      // Let the parent exit independently of the backend.
      this._process.unref();

      let settled = false;

      const cleanup = () => {
        clearInterval(poll);
        clearTimeout(timeout);
      };
      const fail = (err: Error) => {
        if (!settled) {
          settled = true;
          cleanup();
          reject(err);
        }
      };

      const checkHealth = async () => {
        if (settled) {
          return;
        }
        if (await this._healthCheck(port)) {
          settled = true;
          cleanup();
          resolve();
        }
      };

      // Neither backend reports readiness, so it is probed over HTTP.
      const poll = setInterval(checkHealth, HEALTH_POLL_INTERVAL);
      checkHealth();
      const timeout = setTimeout(
        () => fail(new Error(`${this.spec.id} startup timed out`)),
        STARTUP_TIMEOUT,
      );

      this._process.on("error", (err: Error) => fail(err));
      this._process.on("exit", (code: number | null) =>
        fail(new Error(`${this.spec.id} exited with code ${code}`)),
      );
    });
  }
}
