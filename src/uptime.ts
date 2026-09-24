/**
 * Format an uptime duration (in seconds).
 *
 * "auto" renders the constant form `{d}d {h}h {m}m` documented in the README,
 * including zero-valued parts (e.g. `2d 0h 0m`). Any other string is treated as
 * a custom template supporting the {d}/{h}/{m}/{s} placeholders.
 *
 * Shared by the status bar and the webview so both render uptime identically.
 */
export function formatUptime(seconds: number, format: string): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (format && format !== "auto") {
    return format
      .replace("{d}", String(days))
      .replace("{h}", String(hours))
      .replace("{m}", String(minutes))
      .replace("{s}", String(secs));
  }
  return `${days}d ${hours}h ${minutes}m`;
}
