import { strict as assert } from "assert";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { NativeBackendSpec } from "./types";
import {
  findFreePort,
  httpGet,
  isProcessAlive,
  readPortFile,
  writePortFile,
} from "./backendLifecycle";

// The manager logs through vscode.l10n, which only exists inside an extension
// host. Loading it behind a minimal stub lets the lifecycle run in plain mocha
// against stand-in backend processes.
const nodeModule = require("module") as {
  _load(request: string, parent: unknown, isMain: boolean): unknown;
};
const originalLoad = nodeModule._load;
nodeModule._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "vscode") {
    return {
      l10n: {
        t: (message: string, ...args: unknown[]) =>
          args.reduce(
            (acc: string, value, index) =>
              acc.replace(`{${index}}`, String(value)),
            message,
          ),
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Loaded after the stub is installed, so the manager's l10n import resolves.
type NativeBackendManager =
  import("./nativeBackendManager").NativeBackendManager;
const { NativeBackendManager } =
  require("./nativeBackendManager") as typeof import("./nativeBackendManager");

const HEALTH_PATH = "/health";

describe("NativeBackendManager", () => {
  let dir: string;
  let spawnLog: string;
  let portFile: string;
  const children: ChildProcess[] = [];
  const running = new Set<NativeBackendManager>();

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-pro-manager-"));
    spawnLog = path.join(dir, "spawns.log");
    portFile = path.join(dir, "instance.json");
  });

  afterEach(async () => {
    for (const manager of [...running]) {
      await manager.stop();
      running.delete(manager);
    }
    for (const child of children.splice(0)) {
      if (child.pid !== undefined && isProcessAlive(child.pid)) {
        try {
          process.kill(child.pid, "SIGKILL");
        } catch {
          // already gone
        }
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /**
   * Stand-in backend: records every launch in a log file (so a test can prove
   * how many processes were started) and answers the health path over HTTP.
   */
  function spawnArgs(port: number): string[] {
    const script =
      'const fs=require("fs"),http=require("http");' +
      "fs.appendFileSync(process.argv[2],process.pid+String.fromCharCode(10));" +
      'http.createServer((req,res)=>{res.setHeader("Content-Type","application/json");' +
      "res.writeHead(200);res.end('{\"ok\":true}')}).listen(Number(process.argv[1]));";
    return ["-e", script, String(port), spawnLog];
  }

  function spec(): NativeBackendSpec {
    return {
      id: "test",
      displayName: "test",
      portFile,
      markerDir: path.join(dir, "hosts"),
      markerPidField: "backendPid",
      healthPath: HEALTH_PATH,
      spawnArgs,
      graceMs: 0,
      resolveBinary: () => process.execPath,
    };
  }

  function manager(): NativeBackendManager {
    const created = new NativeBackendManager(spec());
    running.add(created);
    return created;
  }

  function spawnedPids(): number[] {
    if (!fs.existsSync(spawnLog)) {
      return [];
    }
    return fs
      .readFileSync(spawnLog, "utf-8")
      .split("\n")
      .filter((line) => line.trim() !== "")
      .map((line) => Number(line.trim()));
  }

  async function waitForHealth(
    port: number,
    timeoutMs = 3000,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const res = await httpGet(port, HEALTH_PATH, 300);
      if (res !== null && res.status === 200) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 30));
    }
    return false;
  }

  async function waitUntilDead(
    pid: number,
    timeoutMs = 2000,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return !isProcessAlive(pid);
  }

  /** An instance another window published, as this window would find it. */
  async function publishForeignInstance(): Promise<{
    port: number;
    pid: number;
  }> {
    const port = await findFreePort();
    const child = spawn(process.execPath, spawnArgs(port), {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    children.push(child);
    assert.ok(child.pid !== undefined);
    assert.equal(await waitForHealth(port), true);

    assert.equal(writePortFile(portFile, { port, pid: child.pid }), "ok");
    return { port, pid: child.pid };
  }

  it("detects a missing backend", () => {
    const missing = new NativeBackendManager({
      ...spec(),
      resolveBinary: () => null,
    });
    assert.equal(missing.isInstalled(), false);
  });

  it("spawns a backend, publishes it and serves requests", async () => {
    const mgr = manager();
    assert.equal(mgr.isInstalled(), true);

    await mgr.start();
    assert.equal(mgr.ready, true);

    const published = readPortFile(portFile);
    assert.ok(published !== null);
    assert.equal(published.port, mgr.port);
    assert.equal(published.pid, spawnedPids()[0]);
    assert.equal(isProcessAlive(published.pid), true);

    const res = await mgr.request(HEALTH_PATH);
    assert.ok(res !== null);
    assert.equal(res.status, 200);
  });

  it("adopts an instance another window published without spawning one", async () => {
    const foreign = await publishForeignInstance();
    const spawnsBefore = spawnedPids().length;

    const mgr = manager();
    await mgr.start();

    assert.equal(mgr.port, foreign.port);
    assert.equal(spawnedPids().length, spawnsBefore);
    assert.deepEqual(readPortFile(portFile), foreign);
  });

  it("reuses the published instance instead of spawning a second one", async () => {
    const first = manager();
    await first.start();
    const published = readPortFile(portFile);
    assert.ok(published !== null);
    assert.equal(spawnedPids().length, 1);

    const second = manager();
    await second.start();

    assert.equal(second.port, published.port);
    assert.equal(spawnedPids().length, 1);
  });

  it("removes the instance and stops the process on shutdown", async () => {
    const mgr = manager();
    await mgr.start();
    const published = readPortFile(portFile);
    assert.ok(published !== null);

    await mgr.stop();
    running.delete(mgr);

    assert.equal(readPortFile(portFile), null);
    assert.equal(await waitUntilDead(published.pid), true);
  });

  it("ignores a published instance whose process is gone", async () => {
    assert.equal(writePortFile(portFile, { port: 1, pid: 999999 }), "ok");

    const mgr = manager();
    await mgr.start();

    const published = readPortFile(portFile);
    assert.ok(published !== null);
    assert.notEqual(published.pid, 999999);
    assert.equal(published.port, mgr.port);
    assert.equal(spawnedPids().length, 1);
  });

  it("reports failure when the backend cannot be published", async () => {
    const broken = new NativeBackendManager({
      ...spec(),
      portFile: path.join(dir, "missing-dir", "instance.json"),
    });
    running.add(broken);

    await assert.rejects(() => broken.start());
  });
});
