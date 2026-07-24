/**
 * mactop child-process manager.
 *
 * Responsibilities:
 * - Detect whether mactop is installed
 * - Temporary file port discovery: writes port+PID to a temp file on first start
 *   and reuses it in subsequent windows
 * - Process liveness check (process.kill(pid, 0)) and HTTP health check
 * - Detached process: mactop stays alive after VS Code windows close, enabling
 *   reuse across windows
 * - Allocate a free port with the Node net module (mactop does not support the
 *   random port :0)
 * - Poll the /metrics endpoint via HTTP to fetch Prometheus text data
 *
 * Design decisions:
 * - Do not kill mactop in deactivate, and do not delete the temp file. Let
 *   mactop stay alive so the next VS Code window can reuse the same process
 *   via the temp file + PID check + health check.
 * - The temp file is naturally overwritten when the existing process is found
 *   dead and a new one is started.
 * - Launch mactop in --headless mode to avoid TUI initialization failures in a
 *   non-terminal environment.
 * - stdout is set to "ignore" so headless JSON output does not fill the pipe
 *   buffer and block the process.
 */

import { spawn, execSync, ChildProcess } from "child_process";
import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as net from "net";
import { l10n } from "vscode";
import { getLogger } from "../logger";
import { parsePrometheusText, type PrometheusMetric } from "./prometheusParser";

const HEALTH_CHECK_TIMEOUT = 500;
const STARTUP_TIMEOUT = 10000;
const HEALTH_POLL_INTERVAL = 300;
const FETCH_TIMEOUT = 5000;

/** Temporary file path storing mactop's port and PID for reuse across windows. */
const PORT_FILE = path.join(os.tmpdir(), "vscode-monitor-pro-mactop.json");

interface PortFileContent {
  port: number;
  pid: number;
}

export class MactopBackendManager {
  private _process: ChildProcess | null = null;
  private _port: number | null = null;
  private _ready = false;
  private _binaryPath: string | null = null;

  get ready(): boolean {
    return this._ready;
  }

  get port(): number | null {
    return this._port;
  }

  /**
   * Detect whether mactop is installed.
   * First tries `which mactop`, then checks common Homebrew paths for Apple
   * Silicon and Intel. Caches the binary path on success for later spawn.
   */
  isMactopInstalled(): boolean {
    try {
      const result = execSync("which mactop", {
        stdio: "pipe",
        encoding: "utf-8",
      }).trim();
      if (result && fs.existsSync(result)) {
        this._binaryPath = result;
        return true;
      }
    } catch {
      // not in PATH, fall through to common paths
    }

    const commonPaths = [
      "/opt/homebrew/bin/mactop", // Apple Silicon
      "/usr/local/bin/mactop", // Intel
    ];
    for (const p of commonPaths) {
      if (fs.existsSync(p)) {
        this._binaryPath = p;
        return true;
      }
    }
    return false;
  }

  /**
   * Start or reuse the mactop backend.
   *
   * Flow:
   * 1. Read temp file -> PID liveness check -> HTTP health check -> reuse
   * 2. Otherwise allocate a free port and spawn mactop --prometheus <port>
   * 3. Poll health check until it passes or times out
   * 4. Write temp file (port + PID) for later windows to reuse
   */
  async start(): Promise<void> {
    // Try to reuse an existing instance
    const existingPort = await this._tryReuseExisting();
    if (existingPort !== null) {
      this._port = existingPort;
      this._ready = true;
      getLogger().info(
        l10n.t("mactop backend reused on port {0}", String(existingPort)),
      );
      return;
    }

    if (!this._binaryPath) {
      throw new Error("mactop binary not found");
    }

    // Allocate a free port
    const port = await this._findFreePort();

    // Start the mactop process
    await this._startProcess(port);

    this._port = port;
    this._ready = true;

    // Write temp file
    this._writePortFile(port);

    getLogger().info(
      l10n.t("mactop backend started on port {0}", String(port)),
    );
  }

  /**
   * Try to reuse a running mactop instance recorded in the temp file.
   * Returns the reusable port, or null if a new instance must be started.
   */
  private async _tryReuseExisting(): Promise<number | null> {
    try {
      const content = fs.readFileSync(PORT_FILE, "utf-8");
      const info = JSON.parse(content) as PortFileContent;

      // Check if the process is still alive
      if (!this._isProcessAlive(info.pid)) {
        getLogger().info(
          l10n.t(
            "mactop process (PID {0}) not alive, starting new",
            String(info.pid),
          ),
        );
        return null;
      }

      // HTTP health check
      const healthy = await this._healthCheck(info.port);
      if (!healthy) {
        getLogger().info(
          l10n.t(
            "mactop on port {0} failed health check, starting new",
            String(info.port),
          ),
        );
        return null;
      }

      return info.port;
    } catch {
      return null;
    }
  }

  /**
   * Probe whether the process exists using process.kill(pid, 0), which sends
   * no signal.
   */
  private _isProcessAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * HTTP GET /metrics health check with a 500 ms timeout.
   */
  private _healthCheck(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${port}/metrics`, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode === 200));
        res.on("error", () => resolve(false));
      });
      req.on("error", () => resolve(false));
      req.setTimeout(HEALTH_CHECK_TIMEOUT, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * Use the Node net module to get an OS-assigned free port, then close it and
   * pass it to mactop. mactop does not support the random port :0, so the
   * caller must provide an explicit port.
   */
  private _findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address() as net.AddressInfo;
        const port = addr.port;
        server.close(() => resolve(port));
      });
      server.on("error", reject);
    });
  }

  /**
   * Spawn mactop --headless --prometheus <port>, detached so it survives after
   * VS Code closes.
   *
   * --headless is mandatory: without it mactop enters TUI mode and calls
   * ui.Init(), which crashes immediately with exit code 1 in a non-terminal
   * environment like the VS Code extension host child process. Headless mode
   * calls startHeadlessPrometheus() to start the Prometheus server and runs an
   * infinite loop that continuously collects and publishes metrics.
   *
   * stdout is set to "ignore": headless mode continuously outputs JSON to
   * stdout. If "pipe" is used without reading, the pipe buffer (~64 KB) fills
   * up and blocks the process.
   * stderr is set to "pipe" with a data handler to capture error messages for
   * diagnostics.
   *
   * Polls the health check until mactop is ready or the startup times out.
   */
  private _startProcess(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this._process = spawn(
          this._binaryPath!,
          ["--headless", "--prometheus", String(port)],
          {
            stdio: ["ignore", "ignore", "pipe"],
            detached: true,
          },
        );
      } catch (err) {
        reject(err);
        return;
      }

      // Capture stderr to diagnose startup failures
      this._process.stderr?.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) {
          getLogger().warn(l10n.t("mactop stderr: {0}", msg));
        }
      });

      // unref so the parent (extension host) can exit independently
      this._process.unref();

      let resolved = false;

      const cleanup = () => {
        clearInterval(healthInterval);
        clearTimeout(timeoutHandle);
      };

      // Poll health check (mactop emits no "ready" signal, so we probe)
      const checkHealth = async () => {
        if (resolved) return;
        const healthy = await this._healthCheck(port);
        if (healthy && !resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };

      const healthInterval = setInterval(checkHealth, HEALTH_POLL_INTERVAL);
      checkHealth(); // Run immediately

      const timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error("mactop startup timed out"));
        }
      }, STARTUP_TIMEOUT);

      this._process.on("error", (err: Error) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(err);
        }
      });

      this._process.on("exit", (code: number | null) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          reject(new Error(`mactop exited with code ${code}`));
        }
      });
    });
  }

  /**
   * Write port and PID to the temp file so other VS Code windows can reuse the
   * backend.
   */
  private _writePortFile(port: number): void {
    const pid = this._process?.pid;
    if (pid === undefined) return;
    const data: PortFileContent = { port, pid };
    try {
      fs.writeFileSync(PORT_FILE, JSON.stringify(data), "utf-8");
    } catch (e) {
      getLogger().warn(
        l10n.t("Failed to write mactop port file: {0}", String(e)),
      );
    }
  }

  /**
   * HTTP GET /metrics and return the parsed Prometheus metric array.
   */
  async fetchMetrics(): Promise<PrometheusMetric[]> {
    if (!this._ready || this._port === null) {
      throw new Error("mactop backend not ready");
    }
    return new Promise((resolve, reject) => {
      const req = http.get(
        `http://127.0.0.1:${this._port}/metrics`,
        (res) => {
          let data = "";
          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
          });
          res.on("end", () => {
            try {
              resolve(parsePrometheusText(data));
            } catch (e) {
              reject(e);
            }
          });
        },
      );
      req.on("error", reject);
      req.setTimeout(FETCH_TIMEOUT, () => {
        req.destroy();
        reject(new Error("mactop metrics fetch timed out"));
      });
    });
  }

  /**
   * Clean up this instance's references. Does not kill the mactop process
   * (it is detached and may be reused by other windows) and does not delete the
   * temp file (reused by later windows).
   */
  stop(): void {
    this._process = null;
    this._ready = false;
    this._port = null;
  }
}
