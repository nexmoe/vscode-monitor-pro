import { spawn, ChildProcess } from "child_process";
import * as http from "http";
import type { OutputChannel } from "vscode";
import type { GoAllResponse } from "./rawDataTypes";

const BACKEND_START_TIMEOUT = 10000;
const FETCH_TIMEOUT = 5000;

export interface GoBasicMetrics {
  cpuPercent: number;
  memPercent: number;
  memTotal: number;
  memUsed: number;
  memFree: number;
  memAvailable: number;
  memBuffCache: number;
}

export class GoBackendManager {
  private _process: ChildProcess | null = null;
  private _port: number | null = null;
  private _ready = false;
  private _log: OutputChannel;

  constructor(log: OutputChannel) {
    this._log = log;
  }

  get ready(): boolean {
    return this._ready;
  }

  get port(): number | null {
    return this._port;
  }

  start(binaryPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this._process = spawn(binaryPath, [], {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        });
      } catch (err) {
        reject(err);
        return;
      }

      let buffer = "";

      this._process.stdout!.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("SERVER_READY:")) {
            this._port = parseInt(trimmed.split(":")[1], 10);
            this._ready = true;
            this._log.appendLine(`[GoBackend] Ready on port ${this._port}`);
            resolve();
          }
        }
      });

      this._process.stderr!.on("data", (chunk: Buffer) => {
        this._log.append(chunk.toString());
      });

      this._process.on("error", (err: Error) => {
        this._log.appendLine(`[GoBackend] Process error: ${err.message}`);
        reject(err);
      });

      this._process.on("exit", (code: number | null) => {
        if (!this._ready) {
          reject(new Error(`Go backend exited with code ${code}`));
        }
      });

      setTimeout(() => {
        if (!this._ready) {
          reject(new Error("Go backend startup timed out"));
        }
      }, BACKEND_START_TIMEOUT);
    });
  }

  private fetchJSON<T>(url: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const req = http.get(url, (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => {
          data += chunk.toString();
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.success) {
              resolve(parsed.data as T);
            } else {
              reject(new Error("Go backend returned success=false"));
            }
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on("error", reject);
      req.setTimeout(FETCH_TIMEOUT, () => {
        req.destroy();
        reject(new Error(`Request timed out after ${FETCH_TIMEOUT}ms`));
      });
    });
  }

  async fetchBasic(): Promise<GoBasicMetrics> {
    return this.fetchJSON<GoBasicMetrics>(
      `http://127.0.0.1:${this._port}/api/v1/basic`,
    );
  }

  async fetchAll(): Promise<GoAllResponse> {
    return this.fetchJSON<GoAllResponse>(
      `http://127.0.0.1:${this._port}/api/v1/all`,
    );
  }

  stop(): void {
    if (this._process) {
      this._process.kill();
      this._process = null;
    }
    this._ready = false;
    this._port = null;
  }
}
