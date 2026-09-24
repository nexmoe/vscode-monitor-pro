import type { NativeBackendManager } from "./backend/nativeBackendManager";
import { RawDataAdapter } from "./rawDataAdapter";
import type { GoAllResponse } from "./rawDataTypes";
import type { SystemSnapshot } from "./systemData";
import type { MetricsExist } from "./constants";
import { collectSISnapshot } from "./siCollector";

export interface DataSource {
  readonly name: string;
  /**
   * Semantics of battery.powerRate for this source. "battery" is signed battery
   * net power (positive while charging, negative while discharging, 0 when
   * idle); "soc" is total SoC power, which is a positive draw and is reported
   * even without a battery. Consumers branch on this instead of comparing the
   * source name.
   */
  readonly powerRateKind: "battery" | "soc";
  collect(
    prev: SystemSnapshot | null,
    enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot>;
}

export class GoDataSource implements DataSource {
  readonly name = "go";
  readonly powerRateKind = "battery";
  private adapter = new RawDataAdapter();

  constructor(private backend: NativeBackendManager) {}

  async collect(
    _prev: SystemSnapshot | null,
    enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot> {
    return this.adapter.toSnapshot(await this._fetchAll(enabled));
  }

  /** GET /api/v1/all and unwrap its {success, data} envelope. */
  private async _fetchAll(enabled: Set<MetricsExist>): Promise<GoAllResponse> {
    // Forward enabled metrics so the backend only collects the corresponding
    // dimensions (true on-demand querying).
    const query =
      enabled.size > 0
        ? `?metrics=${encodeURIComponent([...enabled].join(","))}`
        : "";

    const res = await this.backend.request(`/api/v1/all${query}`);
    if (res === null || res.status !== 200) {
      throw new Error("Go backend request failed");
    }
    if (!res.contentType.includes("application/json")) {
      throw new Error(
        `Expected JSON response but got content-type: ${res.contentType || "none"}`,
      );
    }

    const parsed = JSON.parse(res.body) as {
      success?: boolean;
      data?: GoAllResponse;
    };
    if (!parsed.success || parsed.data === undefined) {
      throw new Error("Go backend returned success=false");
    }
    return parsed.data;
  }
}

export class SIDataSource implements DataSource {
  readonly name = "systeminformation";
  readonly powerRateKind = "battery";

  async collect(
    prev: SystemSnapshot | null,
    enabled: Set<MetricsExist>,
  ): Promise<SystemSnapshot> {
    return collectSISnapshot(prev, enabled);
  }
}
