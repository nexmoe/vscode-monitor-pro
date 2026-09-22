import { strict as assert } from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { HostRegistry, type HostMarker } from "./hostRegistry";

const SELF = process.pid;
const OTHER_HOST = 424242;
const DEAD_HOST = 434343;
const MACTOP_PID = 9090;

describe("HostRegistry", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "monitor-pro-registry-"));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // Registry over an isolated directory with a deterministic liveness stub.
  function registry(alive: number[] = [SELF, OTHER_HOST]): HostRegistry {
    return new HostRegistry(dir, (pid) => alive.includes(pid));
  }

  function writeMarker(name: string, marker: HostMarker): void {
    fs.writeFileSync(path.join(dir, name), JSON.stringify(marker), "utf-8");
  }

  function markers(): string[] {
    return fs.readdirSync(dir).sort();
  }

  it("registers this host as unattached", () => {
    registry().register();
    const raw = JSON.parse(
      fs.readFileSync(path.join(dir, `${SELF}.json`), "utf-8"),
    );
    assert.equal(raw.hostPid, SELF);
    assert.equal(raw.mactopPid, 0);
    assert.equal(raw.port, 0);
  });

  it("attach records the resolved mactop instance", () => {
    const reg = registry();
    reg.register();
    reg.attach(1234, MACTOP_PID);
    const raw = JSON.parse(
      fs.readFileSync(path.join(dir, `${SELF}.json`), "utf-8"),
    );
    assert.equal(raw.mactopPid, MACTOP_PID);
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
    reg.attach(1234, MACTOP_PID);
    assert.equal(reg.hasOtherLiveHosts(MACTOP_PID), false);
  });

  it("counts a live host attached to the same instance", () => {
    writeMarker("other.json", {
      hostPid: OTHER_HOST,
      mactopPid: MACTOP_PID,
      port: 1234,
    });
    assert.equal(registry().hasOtherLiveHosts(MACTOP_PID), true);
  });

  it("counts a live host whose instance is not resolved yet", () => {
    writeMarker("other.json", { hostPid: OTHER_HOST, mactopPid: 0, port: 0 });
    assert.equal(registry().hasOtherLiveHosts(MACTOP_PID), true);
  });

  it("ignores but keeps a live host on a different instance", () => {
    writeMarker("other.json", {
      hostPid: OTHER_HOST,
      mactopPid: MACTOP_PID + 1,
      port: 1235,
    });
    assert.equal(registry().hasOtherLiveHosts(MACTOP_PID), false);
    assert.deepEqual(markers(), ["other.json"]);
  });

  it("prunes markers whose host is gone", () => {
    writeMarker("dead.json", {
      hostPid: DEAD_HOST,
      mactopPid: MACTOP_PID,
      port: 1234,
    });
    writeMarker("garbage.json", { hostPid: OTHER_HOST, mactopPid: 1, port: 1 });
    fs.writeFileSync(path.join(dir, "unreadable.json"), "{oops", "utf-8");

    assert.equal(registry().hasOtherLiveHosts(MACTOP_PID), false);
    assert.deepEqual(markers(), ["garbage.json"]);
  });

  it("reports no other hosts when the marker directory is missing", () => {
    const reg = new HostRegistry(path.join(dir, "missing"), () => true);
    assert.equal(reg.hasOtherLiveHosts(MACTOP_PID), false);
  });
});
