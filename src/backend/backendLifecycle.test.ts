import { strict as assert } from "assert";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as os from "os";
import * as path from "path";
import {
  deletePortFileIfOwned,
  findFreePort,
  httpGet,
  isProcessAlive,
  readPortFile,
  removePortFile,
  terminateProcess,
  writePortFile,
} from "./backendLifecycle";

// A detached node process is used as the backend stand-in. Both variants print
// "ready" once they are up, because a signal that arrives before the runtime has
// installed the SIGTERM handler takes the default action and kills the process.
const COOPERATIVE = 'console.log("ready"); setTimeout(() => {}, 30000);';
const STUBBORN =
  'process.on("SIGTERM", () => {}); console.log("ready"); setTimeout(() => {}, 30000);';

describe("backendLifecycle port file", () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-pro-lifecycle-"));
    file = path.join(dir, "instance.json");
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("round-trips a published instance", () => {
    assert.equal(writePortFile(file, { port: 1234, pid: 42 }), "ok");
    assert.deepEqual(readPortFile(file), { port: 1234, pid: 42 });
  });

  it("reports a missing or malformed instance as null", () => {
    assert.equal(readPortFile(file), null);
    fs.writeFileSync(file, "{oops");
    assert.equal(readPortFile(file), null);
    fs.writeFileSync(file, JSON.stringify({ port: 1234 }));
    assert.equal(readPortFile(file), null);
  });

  it("publishes exclusively so two windows cannot both claim the instance", () => {
    assert.equal(writePortFile(file, { port: 1234, pid: 42 }), "ok");
    assert.equal(writePortFile(file, { port: 1235, pid: 43 }), "exists");
    assert.deepEqual(readPortFile(file), { port: 1234, pid: 42 });
  });

  it("removes the instance only while it still describes the passed record", () => {
    writePortFile(file, { port: 1234, pid: 42 });

    assert.equal(deletePortFileIfOwned(file, { port: 1234, pid: 99 }), false);
    assert.equal(deletePortFileIfOwned(file, { port: 9999, pid: 42 }), false);
    assert.deepEqual(readPortFile(file), { port: 1234, pid: 42 });

    assert.equal(deletePortFileIfOwned(file, { port: 1234, pid: 42 }), true);
    assert.equal(readPortFile(file), null);
  });

  it("removePortFile tolerates a missing file", () => {
    removePortFile(file);
    assert.equal(readPortFile(file), null);
  });
});

describe("backendLifecycle process handling", () => {
  const children: ChildProcess[] = [];

  afterEach(() => {
    for (const child of children.splice(0)) {
      if (child.pid !== undefined && isProcessAlive(child.pid)) {
        try {
          process.kill(child.pid, "SIGKILL");
        } catch {
          // already gone
        }
      }
    }
  });

  /** Spawns the stand-in and resolves once it is up and handling signals. */
  function spawnNode(script: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", script], {
        detached: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
      child.unref();
      children.push(child);

      const pid = child.pid;
      if (pid === undefined) {
        reject(new Error("stand-in has no pid"));
        return;
      }

      const timer = setTimeout(
        () => reject(new Error("stand-in did not become ready")),
        5000,
      );
      let output = "";
      child.stdout?.on("data", (chunk: Buffer) => {
        output += chunk.toString();
        if (output.includes("ready")) {
          clearTimeout(timer);
          resolve(pid);
        }
      });
      child.once("exit", () => {
        clearTimeout(timer);
        reject(new Error("stand-in exited before it was ready"));
      });
    });
  }

  /** A killed process stays visible until its parent reaps it. */
  async function waitUntilDead(pid: number, timeoutMs = 2000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!isProcessAlive(pid)) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return !isProcessAlive(pid);
  }

  it("sees this process as alive", () => {
    assert.equal(isProcessAlive(process.pid), true);
  });

  it("waits for a cooperative process instead of killing it", async () => {
    const pid = await spawnNode(COOPERATIVE);
    assert.equal(isProcessAlive(pid), true);

    assert.equal(await terminateProcess(pid, 150), false);
    assert.equal(await waitUntilDead(pid), true);
  });

  it("escalates to SIGKILL when the process ignores SIGTERM", async () => {
    const pid = await spawnNode(STUBBORN);
    assert.equal(isProcessAlive(pid), true);

    assert.equal(await terminateProcess(pid, 150), true);
    assert.equal(await waitUntilDead(pid), true);
  });

  it("does not wait when the grace period is zero", async () => {
    const pid = await spawnNode(STUBBORN);
    await terminateProcess(pid, 0);
    assert.equal(await waitUntilDead(pid), true);
  });

  it("reports no escalation for a process that is already gone", async () => {
    const pid = await spawnNode(COOPERATIVE);
    await terminateProcess(pid, 150);
    await waitUntilDead(pid);

    assert.equal(await terminateProcess(pid, 150), false);
  });
});

describe("backendLifecycle httpGet", () => {
  let server: http.Server | null = null;

  afterEach(async () => {
    if (server !== null) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = null;
    }
  });

  async function listen(): Promise<number> {
    server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.setHeader("Content-Type", "application/json");
        res.writeHead(200);
        res.end('{"success":true,"data":"ok"}');
        return;
      }
      res.writeHead(404);
      res.end("nope");
    });
    await new Promise<void>((resolve) =>
      server!.listen(0, "127.0.0.1", () => resolve()),
    );
    return (server!.address() as net.AddressInfo).port;
  }

  it("returns the status and body", async () => {
    const port = await listen();
    const res = await httpGet(port, "/health", 1000);
    assert.ok(res !== null);
    assert.equal(res.status, 200);
    assert.equal(res.body, '{"success":true,"data":"ok"}');
  });

  it("returns non-200 responses to the caller", async () => {
    const port = await listen();
    const res = await httpGet(port, "/missing", 1000);
    assert.ok(res !== null);
    assert.equal(res.status, 404);
  });

  it("returns null when nothing is listening", async () => {
    const port = await findFreePort();
    assert.equal(await httpGet(port, "/health", 500), null);
  });
});
