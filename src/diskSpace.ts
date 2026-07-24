import type { SystemSnapshot } from "./systemData";

export type FsSizeEntry = SystemSnapshot["fsSize"][number];

/**
 * Deduplicate fsSize entries by physical device so disk capacity is not
 * double-counted.
 *
 * Background: both systeminformation's fsSize() and the Go backend's
 * disk.usage return one row per mount point. The same physical disk can appear
 * multiple times under "all" (btrfs subvolumes, snapshots, bind mounts,
 * overlay, snap loop, etc.), and each row reports the whole pool capacity.
 * Summing size/used directly would add the same capacity multiple times.
 *
 * The deduplication key is `fs` (the device source, e.g. /dev/nvme0n1p2,
 * overlay, tmpfs); if `fs` is empty it falls back to `mount`.
 * Within each group the representative mount is chosen by shortest mount path
 * (so / wins over /@ and /home wins over /@home), breaking ties by largest
 * size.
 *
 * Result: one row per physical disk and per virtual filesystem. Windows drive
 * letters are naturally unique, so deduplication is a no-op there.
 * The function is pure and idempotent.
 */
/**
 * Extract the deduplication grouping key.
 *
 * macOS APFS: multiple volumes of the same container have device paths like
 * /dev/diskNsM (or /dev/diskNsMsR) and must be merged by physical disk
 * /dev/diskN, otherwise the container capacity is reported once per volume.
 * Device names on other platforms (Linux /dev/nvme0n1p2, /dev/sda1; Windows
 * drive letters) do not match this pattern and fall back to the raw fs value.
 */
function getDedupeKey(row: FsSizeEntry): string {
  const fs = (row.fs && row.fs.trim()) || "";
  if (fs) {
    const apfsMatch = fs.match(/^\/dev\/disk(\d+)s\d+/);
    if (apfsMatch) {
      return `/dev/disk${apfsMatch[1]}`;
    }
    return fs;
  }
  return (row.mount && row.mount.trim()) || "";
}

export function dedupeFsSize(rows: FsSizeEntry[]): FsSizeEntry[] {
  if (!rows || rows.length <= 1) {
    return rows;
  }

  const groups = new Map<string, FsSizeEntry[]>();
  for (const row of rows) {
    const key = getDedupeKey(row);
    if (!key) {
      continue;
    }
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const result: FsSizeEntry[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length === 1) {
      result.push(bucket[0]);
      continue;
    }
    // Prefer the shortest mount path; on ties pick the largest size.
    let best = bucket[0];
    for (let i = 1; i < bucket.length; i++) {
      const cur = bucket[i];
      if (
        cur.mount.length < best.mount.length ||
        (cur.mount.length === best.mount.length && cur.size > best.size)
      ) {
        best = cur;
      }
    }
    result.push(best);
  }

  return result;
}
