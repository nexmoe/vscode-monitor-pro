/**
 * Cross-process usage registry for a shared native backend.
 *
 * A backend is spawned detached so every VS Code window (each owning its own
 * extension host process) shares one instance. To keep that sharing without
 * leaking a process after VS Code is fully closed, each extension host holds a
 * marker file for as long as it uses the backend. Shutdown is ownership-based:
 * the window that drops the last marker is the one that stops the backend.
 *
 * A marker is dropped as stale when its extension host is no longer alive
 * (crashed or force-killed window) or when the file cannot be read. Markers
 * belonging to a live host that is attached to a *different* backend instance
 * are kept but not counted: two instances can coexist when one window fails to
 * reuse the instance another window is running, and such a marker must neither
 * block our own shutdown nor be destroyed while its owner still uses it.
 *
 * Unattached markers (pid 0) belong to a window that registered but has not
 * resolved its backend instance yet; they count as live so a window that is
 * concurrently shutting down cannot stop an instance another window is about to
 * reuse.
 */

import * as fs from "fs";
import * as path from "path";
import { isProcessAlive as defaultIsProcessAlive } from "./backendLifecycle";

type IsProcessAlive = (pid: number) => boolean;

export class UsageRegistry {
  private readonly hostPid = process.pid;
  private readonly markerPath: string;

  /**
   * @param dir directory holding one marker per extension host
   * @param pidField name of the marker field carrying the backend PID. Must not
   *   change for a backend that already ships: windows running an older version
   *   read and write the same field, and if the two disagree each side counts
   *   only itself, so the last window to leave stops a backend the other is
   *   still using.
   */
  constructor(
    private readonly dir: string,
    private readonly pidField: string,
    private readonly isProcessAlive: IsProcessAlive = defaultIsProcessAlive,
  ) {
    this.markerPath = path.join(dir, `${this.hostPid}.json`);
  }

  /**
   * Claim the backend before start() runs. Registering this early means a
   * window that shuts down meanwhile sees this host as a live user and leaves
   * the shared instance alone.
   */
  register(): void {
    this.write(0, 0);
  }

  /** Record the resolved backend instance once start() succeeded. */
  attach(port: number, backendPid: number): void {
    this.write(backendPid, port);
  }

  /** Drop this host's marker. Idempotent. */
  unregister(): void {
    this.remove(this.markerPath);
  }

  /**
   * Whether another live host still uses the same backend instance. Markers of
   * dead hosts are pruned on the way so they cannot block a later shutdown.
   */
  hasOtherLiveHosts(backendPid: number): boolean {
    let names: string[];
    try {
      names = fs.readdirSync(this.dir);
    } catch {
      return false;
    }

    let found = false;
    for (const name of names) {
      const file = path.join(this.dir, name);
      if (file === this.markerPath) {
        continue;
      }

      const marker = this.read(file);
      if (marker === null || !this.isProcessAlive(marker.hostPid)) {
        this.remove(file);
        continue;
      }

      // A PID of 0 means the host has not attached yet (start() in flight).
      if (marker.pid === 0 || marker.pid === backendPid) {
        found = true;
      }
    }
    return found;
  }

  private write(backendPid: number, port: number): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const marker: Record<string, number> = { hostPid: this.hostPid };
      marker[this.pidField] = backendPid;
      marker.port = port;
      fs.writeFileSync(this.markerPath, JSON.stringify(marker), "utf-8");
    } catch {
      // A lost marker only costs precision when deciding who stops the backend;
      // the liveness checks on the remaining markers still apply.
    }
  }

  private read(file: string): { hostPid: number; pid: number } | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<
        string,
        unknown
      >;
      if (typeof parsed?.hostPid !== "number") {
        return null;
      }
      const pid = parsed[this.pidField];
      return {
        hostPid: parsed.hostPid,
        pid: typeof pid === "number" ? pid : 0,
      };
    } catch {
      return null;
    }
  }

  private remove(file: string): void {
    try {
      fs.unlinkSync(file);
    } catch {
      // already removed, or raced with another host pruning the same marker
    }
  }
}
