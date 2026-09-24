/**
 * Everything the shared manager needs to know about a native backend.
 *
 * The backends differ only in these knobs; the lifecycle (claiming the
 * instance, reuse, health check, refcounted shutdown) is identical.
 */
export interface NativeBackendSpec {
  /** Stable id, used in error messages. */
  id: string;
  /** Name used in log messages ("Go", "mactop"). */
  displayName: string;
  /** Absolute path of the file other windows read to find the instance. */
  portFile: string;
  /** Directory holding one usage marker per extension host. */
  markerDir: string;
  /** Marker field carrying the backend PID. See UsageRegistry. */
  markerPidField: string;
  /** HTTP path that answers 200 once the backend is up. */
  healthPath: string;
  /** Arguments that place the backend on the given port. */
  spawnArgs(port: number): string[];
  /** Milliseconds the backend gets to honour SIGTERM before it is killed. */
  graceMs: number;
  /** Absolute path of the executable, or null when it is not installed. */
  resolveBinary(): string | null;
}
