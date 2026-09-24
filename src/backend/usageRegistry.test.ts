import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { UsageRegistry } from "./usageRegistry";

const SELF = process.pid;
const OTHER_HOST = 424242;
const DEAD_HOST = 434343;
const BACKEND_PID = 9090;
const PID_FIELD = "mactopPid";

describe("UsageRegistry", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-pro-usage-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Registry over an isolated directory with a deterministic liveness stub.
  function registry(
    alive: number[] = [SELF, OTHER_HOST],
    pidField: string = PID_FIELD,
  ): UsageRegistry {
    return new UsageRegistry(dir, pidField, (pid) => alive.includes(pid));
  }

  function writeMarker(
    name: string,
    marker: { hostPid: number; pid: number; port: number },
  ): void {
    const raw: Record<string, number> = { hostPid: marker.hostPid };
    raw[PID_FIELD] = marker.pid;
    raw.port = marker.port;
    fs.writeFileSync(path.join(dir, name), JSON.stringify(raw), "utf-8");
  }

  function markers(): string[] {
    return fs.readdirSync(dir).sort();
  }

  it("registers this host as unattached under the configured pid field", () => {
    registry().register();
    const raw = JSON.parse(
      fs.readFileSync(path.join(dir, `${SELF}.json`), "utf-8"),
    );
    assert.equal(raw.hostPid, SELF);
    assert.equal(raw[PID_FIELD], 0);
    assert.equal(raw.port, 0);
  });

  it("attach records the resolved backend instance", () => {
    const reg = registry();
    reg.register();
    reg.attach(1234, BACKEND_PID);
    const raw = JSON.parse(
      fs.readFileSync(path.join(dir, `${SELF}.json`), "utf-8"),
    );
    assert.equal(raw[PID_FIELD], BACKEND_PID);
    assert.equal(raw.port, 1234);
  });

  it("unregister drops this host's marker and is idempotent", () => {
    const reg = registry();
    reg.register();
    reg.unregister();
    reg.unregister();
    assert.deepEqual(markers(), []);
  });

  it("ignores this host's own marker", () => {
    const reg = registry();
    reg.attach(1234, BACKEND_PID);
    assert.equal(reg.hasOtherLiveHosts(BACKEND_PID), false);
  });

  it("counts a live host attached to the same instance", () => {
    writeMarker("other.json", {
      hostPid: OTHER_HOST,
      pid: BACKEND_PID,
      port: 1234,
    });
    assert.equal(registry().hasOtherLiveHosts(BACKEND_PID), true);
  });

  it("counts a live host whose instance is not resolved yet", () => {
    writeMarker("other.json", { hostPid: OTHER_HOST, pid: 0, port: 0 });
    assert.equal(registry().hasOtherLiveHosts(BACKEND_PID), true);
  });

  it("ignores but keeps a live host on a different instance", () => {
    writeMarker("other.json", {
      hostPid: OTHER_HOST,
      pid: BACKEND_PID + 1,
      port: 1235,
    });
    assert.equal(registry().hasOtherLiveHosts(BACKEND_PID), false);
    assert.deepEqual(markers(), ["other.json"]);
  });

  it("prunes markers whose host is gone", () => {
    writeMarker("dead.json", {
      hostPid: DEAD_HOST,
      pid: BACKEND_PID,
      port: 1234,
    });
    writeMarker("kept.json", {
      hostPid: OTHER_HOST,
      pid: BACKEND_PID,
      port: 1235,
    });
    fs.writeFileSync(path.join(dir, "unreadable.json"), "{oops", "utf-8");

    assert.equal(registry().hasOtherLiveHosts(BACKEND_PID), true);
    assert.deepEqual(markers(), ["kept.json"]);
  });

  it("reports no other hosts when the marker directory is missing", () => {
    const reg = new UsageRegistry(
      path.join(dir, "missing"),
      PID_FIELD,
      () => true,
    );
    assert.equal(reg.hasOtherLiveHosts(BACKEND_PID), false);
  });

  it("honours a different pid field name", () => {
    const reg = registry([SELF, OTHER_HOST], "backendPid");
    reg.attach(1234, BACKEND_PID);
    const raw = JSON.parse(
      fs.readFileSync(path.join(dir, `${SELF}.json`), "utf-8"),
    );
    assert.equal(raw.backendPid, BACKEND_PID);
    assert.equal(raw.mactopPid, undefined);

    const other: Record<string, number> = {
      hostPid: OTHER_HOST,
      backendPid: BACKEND_PID,
      port: 1234,
    };
    fs.writeFileSync(path.join(dir, "other.json"), JSON.stringify(other));
    assert.equal(reg.hasOtherLiveHosts(BACKEND_PID), true);
  });
});
