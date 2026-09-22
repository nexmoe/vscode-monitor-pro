/**
 * Cross-process usage registry for the shared mactop backend.
 *
 * mactop is spawned detached so every VS Code window (each owning its own
 * extension host process) shares one instance. To keep that sharing without
 * leaking a process after VS Code is fully closed, each extension host holds a
 * marker file for as long as it uses the backend. Shutdown is ownership-based:
 * the window that drops the last marker is the one that kills mactop.
 *
 * A marker is dropped as stale when its extension host is no longer alive
 * (crashed or force-killed window) or when the file cannot be read. Markers
 * belonging to a live host that is attached to a *different* mactop instance
 * are kept but not counted: two instances can coexist when one window fails to
 * reuse the instance another window is running, and such a marker must neither
 * block our own shutdown nor be destroyed while its owner still uses it.
 *
 * Unattached markers (mactopPid 0) belong to a window that registered but has
 * not resolved its mactop instance yet; they count as live so a window that is
 * concurrently shutting down cannot kill an instance another window is about
 * to reuse.
 *
 * This module deliberately avoids importing vscode so it stays unit-testable.
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const DEFAULT_MARKER_DIR = path.join(
  os.tmpdir(),
  "vscode-monitor-pro-mactop-hosts",
);

export interface HostMarker {
  /** Extension host process of the window holding the backend. */
  hostPid: number;
  /** mactop process this host is attached to; 0 while start() is in flight. */
  mactopPid: number;
  /** mactop HTTP port, 0 while start() is in flight. */
  port: number;
}

type IsProcessAlive = (pid: number) => boolean;

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export class HostRegistry {
  private readonly hostPid = process.pid;
  private readonly markerPath: string;

  constructor(
    private readonly dir: string = DEFAULT_MARKER_DIR,
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
    this.write({ hostPid: this.hostPid, mactopPid: 0, port: 0 });
  }

  /** Record the resolved mactop instance once start() succeeded. */
  attach(port: number, mactopPid: number): void {
    this.write({ hostPid: this.hostPid, mactopPid, port });
  }

  /** Drop this host's marker. Idempotent. */
  unregister(): void {
    this.remove(this.markerPath);
  }

  /**
   * Whether another live host still uses the same mactop instance. Markers of
   * dead hosts are pruned on the way so they cannot block a later shutdown.
   */
  hasOtherLiveHosts(mactopPid: number): boolean {
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

      // mactopPid 0 means the host has not attached yet (start() in flight).
      if (marker.mactopPid === 0 || marker.mactopPid === mactopPid) {
        found = true;
      }
    }
    return found;
  }

  private write(marker: HostMarker): void {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.markerPath, JSON.stringify(marker), "utf-8");
    } catch {
      // A lost marker only costs precision when deciding who shuts mactop
      // down; the liveness checks on the remaining markers still apply.
    }
  }

  private read(file: string): HostMarker | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as HostMarker;
      return typeof parsed?.hostPid === "number" ? parsed : null;
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
