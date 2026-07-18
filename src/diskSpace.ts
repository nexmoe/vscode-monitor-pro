import type { SystemSnapshot } from "./systemData";

export type FsSizeEntry = SystemSnapshot["fsSize"][number];

/**
 * 按物理设备去重 fsSize 列表，避免磁盘容量被重复计算。
 *
 * 背景：`systeminformation` 的 `fsSize()` 与 Go 后端的 `disk.usage` 都按挂载点返回一行。
 * 同一块物理磁盘在"all"下会出现多次（btrfs 子卷、快照、bind mount、overlay、snap loop 等），
 * 每一行都报告整个池的容量，直接对 size/used 求和会把同一份容量累加多遍。
 *
 * 去重键为 `fs`（设备源，如 `/dev/nvme0n1p2`、`overlay`、`tmpfs`）；`fs` 为空时回退到 `mount`。
 * 组内保留一个代表性挂载：优先取 mount 路径最短者（使 `/` 优先于 `/@`、`/home` 优先于 `/@home`），
 * 路径长度相同时取 size 最大者。
 *
 * 结果：每块物理磁盘（及每个虚拟文件系统）只保留一行。Windows 盘符天然唯一，去重为 no-op。
 * 函数为纯函数且幂等。
 */
export function dedupeFsSize(rows: FsSizeEntry[]): FsSizeEntry[] {
  if (!rows || rows.length <= 1) {
    return rows;
  }

  const groups = new Map<string, FsSizeEntry[]>();
  for (const row of rows) {
    const key = (row.fs && row.fs.trim()) || (row.mount && row.mount.trim()) || "";
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
    // 取 mount 路径最短者；长度相同取 size 最大者。
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
