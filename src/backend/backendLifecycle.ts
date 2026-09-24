/**
 * Process- and file-level primitives shared by every native backend.
 *
 * Deliberately free of vscode imports so the risky parts of the lifecycle
 * (published-instance files, reuse decisions, termination escalation) can be
 * unit-tested; the manager on top owns the log messages.
 *
 * The published instance file is the only way another VS Code window discovers
 * a running backend, so it is written with an exclusive create: two windows
 * racing to start a backend cannot both claim ownership, and the loser knows to
 * discard the process it just spawned.
 */

import * as fs from "fs";
import * as http from "http";
import * as net from "net";

/** How often the terminator checks whether the process left. */
const TERMINATE_POLL_INTERVAL = 50;

export interface PortFileContent {
  port: number;
  pid: number;
}

/** Probe whether a process exists without sending a signal. */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Ask the OS for a free loopback port. Both backends are told which port to use
 * so every window can find them through the published instance file.
 */
export function findFreePort(): Promise<number> {
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

/** Read the published instance; null when missing, unreadable or malformed. */
export function readPortFile(file: string): PortFileContent | null {
  try {
    const parsed = JSON.parse(
      fs.readFileSync(file, "utf-8"),
    ) as PortFileContent;
    if (typeof parsed?.pid !== "number" || typeof parsed?.port !== "number") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Outcome of publishing an instance: "exists" means another window won. */
export type PublishResult = "ok" | "exists" | "error";

/**
 * Publish the instance. Returns "exists" when the file already exists, which
 * means another window claimed the backend first.
 */
export function writePortFile(
  file: string,
  content: PortFileContent,
): PublishResult {
  try {
    fs.writeFileSync(file, JSON.stringify(content), {
      encoding: "utf-8",
      flag: "wx",
    });
    return "ok";
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code === "EEXIST"
      ? "exists"
      : "error";
  }
}

/** Remove the published instance unconditionally. */
export function removePortFile(file: string): void {
  try {
    fs.unlinkSync(file);
  } catch {
    // already gone
  }
}

/**
 * Remove the published instance, but only while it still describes `owned`:
 * another window may have published a newer instance in the meantime, and
 * deleting that would make it undiscoverable.
 */
export function deletePortFileIfOwned(
  file: string,
  owned: PortFileContent,
): boolean {
  const current = readPortFile(file);
  if (
    current === null ||
    current.pid !== owned.pid ||
    current.port !== owned.port
  ) {
    return false;
  }
  removePortFile(file);
  return true;
}

/** Minimal HTTP response shape shared with the data sources. */
export interface HttpResult {
  status: number;
  body: string;
  contentType: string;
}

/** GET a loopback path, returning null on any error or timeout. */
export function httpGet(
  port: number,
  pathname: string,
  timeoutMs: number,
): Promise<HttpResult | null> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}${pathname}`, (res) => {
      const status = res.statusCode ?? 0;
      const contentType = String(res.headers["content-type"] ?? "");
      let body = "";
      res.on("data", (chunk: Buffer) => {
        body += chunk.toString();
      });
      res.on("end", () => resolve({ status, body, contentType }));
      res.on("error", () => resolve(null));
    });
    req.on("error", () => resolve(null));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(null);
    });
  });
}

/**
 * Terminate a process: SIGTERM, then SIGKILL once `graceMs` has passed. A grace
 * of 0 escalates immediately, which is what a backend without signal handling
 * gets (on Windows both signals are TerminateProcess anyway).
 *
 * Returns true when the process had to be killed outright.
 */
export function terminateProcess(
  pid: number,
  graceMs: number,
): Promise<boolean> {
  if (!isProcessAlive(pid)) {
    return Promise.resolve(false);
  }

  try {
    process.kill(pid, "SIGTERM");
  } catch {
    return Promise.resolve(false);
  }

  const forceKill = (): boolean => {
    if (!isProcessAlive(pid)) {
      return false;
    }
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // exited between the liveness check and the signal
    }
    return true;
  };

  if (graceMs <= 0) {
    return Promise.resolve(forceKill());
  }

  return new Promise((resolve) => {
    const deadline = Date.now() + graceMs;
    const timer = setInterval(() => {
      if (!isProcessAlive(pid)) {
        clearInterval(timer);
        resolve(false);
        return;
      }
      if (Date.now() >= deadline) {
        clearInterval(timer);
        resolve(forceKill());
      }
    }, TERMINATE_POLL_INTERVAL);
  });
}
