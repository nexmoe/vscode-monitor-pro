/**
 * mactop 子进程管理器。
 *
 * 职责：
 * - 检测 mactop 是否已安装
 * - 临时文件端口发现：首次启动将 port+PID 写入临时文件，后续窗口优先复用
 * - 进程存活检查（process.kill(pid, 0)）和 HTTP 健康检查
 * - detached 进程：mactop 在 VS Code 窗口关闭后自然存活，支持跨窗口复用
 * - Node net 模块分配空闲端口（mactop 不支持随机端口 :0）
 * - HTTP 轮询 /metrics 端点获取 Prometheus 文本数据
 *
 * 设计决策：
 * - 不在 deactivate 时 kill mactop，也不删除临时文件——让 mactop 自然存活，
 *   下一个 VS Code 窗口通过临时文件 + PID 检查 + 健康检查复用同一进程。
 * - 临时文件在发现 mactop 进程已死时被自然覆盖（启动新进程时重写）。
 * - 使用 --headless 模式启动 mactop，避免无终端环境下 TUI 初始化失败。
 * - stdout 设为 "ignore" 避免 headless JSON 输出填满管道缓冲区导致阻塞。
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

/** 临时文件路径：存储 mactop 的 port 和 PID，供跨窗口复用。 */
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
   * 检测 mactop 是否已安装。
   * 先尝试 `which mactop`，再检查 Homebrew 常见路径（Apple Silicon / Intel）。
   * 成功时缓存二进制路径供 spawn 使用。
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
   * 启动或复用 mactop 后端。
   *
   * 流程：
   * 1. 读取临时文件 → PID 存活检查 → HTTP 健康检查 → 复用
   * 2. 失败则分配空闲端口，spawn mactop --prometheus <port>
   * 3. 轮询健康检查直到通过或超时
   * 4. 写入临时文件（port + PID）供后续窗口复用
   */
  async start(): Promise<void> {
    // 尝试复用已有实例
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

    // 分配空闲端口
    const port = await this._findFreePort();

    // 启动 mactop 进程
    await this._startProcess(port);

    this._port = port;
    this._ready = true;

    // 写入临时文件
    this._writePortFile(port);

    getLogger().info(
      l10n.t("mactop backend started on port {0}", String(port)),
    );
  }

  /**
   * 尝试从临时文件中复用已运行的 mactop 实例。
   * 返回可复用的端口号，或 null 表示需要启动新实例。
   */
  private async _tryReuseExisting(): Promise<number | null> {
    try {
      const content = fs.readFileSync(PORT_FILE, "utf-8");
      const info = JSON.parse(content) as PortFileContent;

      // 检查进程是否存活
      if (!this._isProcessAlive(info.pid)) {
        getLogger().info(
          l10n.t(
            "mactop process (PID {0}) not alive, starting new",
            String(info.pid),
          ),
        );
        return null;
      }

      // HTTP 健康检查
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
   * 使用 process.kill(pid, 0) 探测进程是否存在（不发信号）。
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
   * HTTP GET /metrics 健康检查，超时 500ms。
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
   * 使用 Node net 模块获取 OS 分配的空闲端口，然后 close 后传给 mactop。
   * mactop 不支持 :0 随机端口，必须由调用方指定。
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
   * Spawn mactop --headless --prometheus <port>，detached 使其在 VS Code 关闭后存活。
   *
   * --headless 必须：不带此标志 mactop 会进入 TUI 模式调用 ui.Init()，
   * 在无终端环境（VS Code extension host 子进程）下立即以 exit code 1 崩溃。
   * headless 模式调用 startHeadlessPrometheus() 启动 Prometheus 服务器，
   * 并运行无限循环持续采集和发布指标。
   *
   * stdout 设为 "ignore"：headless 模式持续向 stdout 输出 JSON，
   * 若使用 "pipe" 但不读取，管道缓冲区（~64KB）填满后进程会阻塞。
   * stderr 设为 "pipe" 并添加 data handler 捕获错误信息用于诊断。
   *
   * 轮询健康检查直到 mactop 就绪或超时。
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

      // 捕获 stderr 用于诊断启动失败原因
      this._process.stderr?.on("data", (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        if (msg) {
          getLogger().warn(l10n.t("mactop stderr: {0}", msg));
        }
      });

      // unref 使父进程（extension host）可以独立退出
      this._process.unref();

      let resolved = false;

      const cleanup = () => {
        clearInterval(healthInterval);
        clearTimeout(timeoutHandle);
      };

      // 轮询健康检查（mactop 不输出 "ready" 信号，需主动探测）
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
      checkHealth(); // 立即执行一次

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
   * 将 port 和 PID 写入临时文件，供其他 VS Code 窗口复用。
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
   * HTTP GET /metrics，返回解析后的 Prometheus 指标数组。
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
   * 清理本实例引用。不 kill mactop 进程（detached，可能被其他窗口复用），
   * 也不删除临时文件（供后续窗口复用）。
   */
  stop(): void {
    this._process = null;
    this._ready = false;
    this._port = null;
  }
}
