/**
 * Descriptors for the two native backends.
 *
 * Platform selection itself stays where it was (Windows uses the Go binary,
 * macOS Apple Silicon uses mactop); only the lifecycle is shared.
 */

import { execSync } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { NativeBackendSpec } from "./types";

/**
 * mactop is spawned with `--headless --prometheus <port>`.
 *
 * The port file and marker paths, and the marker's PID field name, must stay
 * compatible with the versions that shipped before both backends shared one
 * implementation: a window running an older version and one running a newer
 * version must agree on the same instance, otherwise each counts only itself
 * and the last window to leave stops a backend the other is still using.
 */
export const MACTOP_SPEC: NativeBackendSpec = {
  id: "mactop",
  displayName: "mactop",
  portFile: path.join(os.tmpdir(), "vscode-monitor-pro-mactop.json"),
  markerDir: path.join(os.tmpdir(), "vscode-monitor-pro-mactop-hosts"),
  markerPidField: "mactopPid",
  healthPath: "/metrics",
  spawnArgs: (port) => ["--headless", "--prometheus", String(port)],
  // mactop ignores SIGTERM in practice, so a long grace period would only delay
  // the shutdown and widen the window in which another window could adopt an
  // instance that is already being stopped.
  graceMs: 200,
  resolveBinary: () => {
    try {
      const found = execSync("which mactop", {
        stdio: "pipe",
        encoding: "utf-8",
      }).trim();
      if (found && fs.existsSync(found)) {
        return found;
      }
    } catch {
      // not in PATH, fall through to the common install locations
    }

    for (const candidate of [
      "/opt/homebrew/bin/mactop", // Apple Silicon
      "/usr/local/bin/mactop", // Intel
    ]) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  },
};

/** The Go backend ships inside the extension, so its path is known. */
export function createGoSpec(extensionPath: string): NativeBackendSpec {
  return {
    id: "go",
    displayName: "Go",
    portFile: path.join(os.tmpdir(), "vscode-monitor-pro-go.json"),
    markerDir: path.join(os.tmpdir(), "vscode-monitor-pro-go-hosts"),
    markerPidField: "backendPid",
    healthPath: "/health",
    spawnArgs: (port) => ["-port", String(port)],
    // The binary has no signal handling and Windows maps both signals to
    // TerminateProcess, so a grace period would only add latency.
    graceMs: 0,
    resolveBinary: () => {
      const name = process.platform === "win32" ? "monitor.exe" : "monitor";
      const binary = path.join(extensionPath, "go-backend", "bin", name);
      return fs.existsSync(binary) ? binary : null;
    },
  };
}
