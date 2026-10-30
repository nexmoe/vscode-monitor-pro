import { strict as assert } from "assert";

// The registry labels go through vscode.l10n, which only exists inside an
// extension host. A minimal stub lets the module load in plain mocha; only
// l10n.t is needed because the registry is data plus copy.
const nodeModule = require("module") as {
  _load(request: string, parent: unknown, isMain: boolean): unknown;
};
const originalLoad = nodeModule._load;
nodeModule._load = function (
  request: string,
  parent: unknown,
  isMain: boolean,
) {
  if (request === "vscode") {
    return {
      l10n: {
        t: (message: string, ...args: unknown[]) =>
          args.reduce(
            (acc: string, value, index) =>
              acc.replace(`{${index}}`, String(value)),
            message,
          ),
      },
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

// Loaded after the stub is installed, so the registry's vscode import resolves.
type ResourceUsageCardsModule = typeof import("./resourceUsageCards");
const {
  RESOURCE_USAGE_CARDS,
  RESOURCE_USAGE_CARD_IDS,
  getResourceUsageCard,
  getResourceUsageCardsInOrder,
  normalizeChartsOrder,
} = require("./resourceUsageCards") as ResourceUsageCardsModule;

// The declaration order is the default render order, so it is part of the
// contract: changing it changes what every user sees on a fresh install.
const EXPECTED_ORDER = [
  "cpu",
  "memActive",
  "memUsed",
  "netRx",
  "netTx",
  "diskRx",
  "diskWx",
  "battery",
  "batteryPower",
  "cpuTemp",
  "cpuSpeed",
  "gpu",
  "gpuTemp",
  "gpuMem",
  "uptime",
  "osDistro",
  "diskSpace",
];

describe("resourceUsageCards", () => {
  it("declares every card exactly once, in the default render order", () => {
    assert.deepEqual([...RESOURCE_USAGE_CARD_IDS], EXPECTED_ORDER);
  });

  it("keeps the card kinds and defaults the view was built around", () => {
    const byId = new Map(RESOURCE_USAGE_CARDS.map((c) => [c.id, c]));

    for (const id of EXPECTED_ORDER) {
      const card = byId.get(id);
      assert.ok(card, `missing card ${id}`);
      assert.ok(card.label.length > 0, `empty label for ${id}`);
      // Only the two opt-in charts start disabled.
      assert.equal(
        card.defaultEnabled,
        id !== "cpuSpeed" && id !== "memUsed",
        `unexpected defaultEnabled for ${id}`,
      );
      if (card.kind === "chart") {
        assert.equal(card.defaultView, "line", `view for ${id}`);
        assert.ok(card.defaultColor, `color for ${id}`);
      } else {
        assert.equal(card.defaultView, undefined, `view for ${id}`);
        assert.equal(card.defaultColor, undefined, `color for ${id}`);
      }
    }

    assert.equal(byId.get("uptime")?.kind, "text");
    assert.equal(byId.get("osDistro")?.kind, "text");
    assert.equal(byId.get("diskSpace")?.kind, "disk");
    // Several cards share one collection section; that sharing is what makes
    // the enabled union in computeEnabledMetrics meaningful.
    assert.equal(byId.get("netRx")?.metric, "network");
    assert.equal(byId.get("netTx")?.metric, "network");
    assert.equal(byId.get("diskRx")?.metric, "fileSystem");
    assert.equal(byId.get("diskWx")?.metric, "fileSystem");
    assert.equal(byId.get("battery")?.metric, "battery");
    assert.equal(byId.get("batteryPower")?.metric, "battery");
  });

  // The webview draws the per-item view straight from this metadata, so a
  // renamed field or value key would silently empty the array view instead of
  // failing loudly. These names are the contract with the history samples
  // (ResourceUsagePayload's cpuCores / cpuTempCores and GpuCard's keys).
  it("declares the per-item view only for the cards that have one", () => {
    const arrays = Object.fromEntries(
      RESOURCE_USAGE_CARDS.filter((card) => card.array).map((card) => [
        card.id,
        card.array,
      ]),
    );
    assert.deepEqual(arrays, {
      cpu: { field: "cpuCores", type: "percent", prefix: "C" },
      cpuTemp: { field: "cpuTempCores", type: "temp", prefix: "C" },
      gpu: {
        field: "gpuCards",
        type: "percent",
        prefix: "G",
        valueKey: "utilization",
      },
      gpuTemp: {
        field: "gpuCards",
        type: "temp",
        prefix: "G",
        valueKey: "temperature",
      },
      gpuMem: {
        field: "gpuCards",
        type: "mem",
        prefix: "G",
        valueKey: "memUsed",
      },
    });
    for (const card of RESOURCE_USAGE_CARDS) {
      if (card.kind !== "chart") {
        assert.equal(
          card.array,
          undefined,
          `${card.id} carries array metadata`,
        );
      }
    }
  });

  it("looks cards up by id", () => {
    assert.equal(getResourceUsageCard("cpu")?.kind, "chart");
    assert.equal(getResourceUsageCard("no-such-card"), undefined);
    assert.deepEqual(
      getResourceUsageCardsInOrder(["diskSpace", "unknown", "cpu"]).map(
        (c) => c.id,
      ),
      ["diskSpace", "cpu"],
    );
  });

  describe("normalizeChartsOrder", () => {
    const known = ["a", "b", "c"] as const;

    it("returns the registry order when nothing is configured", () => {
      for (const raw of [undefined, null, "", 42, {}, true]) {
        const result = normalizeChartsOrder(raw, known);
        assert.deepEqual(result, [...known], `raw=${String(raw)}`);
        assert.notEqual(result, known, "must return a copy");
      }
    });

    it("returns the registry order for an empty array", () => {
      assert.deepEqual(normalizeChartsOrder([], known), ["a", "b", "c"]);
    });

    it("honors a complete custom order", () => {
      assert.deepEqual(normalizeChartsOrder(["c", "a", "b"], known), [
        "c",
        "a",
        "b",
      ]);
    });

    it("appends unlisted ids in registry order", () => {
      assert.deepEqual(normalizeChartsOrder(["c"], known), ["c", "a", "b"]);
      assert.deepEqual(normalizeChartsOrder(["b"], known), ["b", "a", "c"]);
    });

    it("drops non-strings and unknown ids", () => {
      assert.deepEqual(
        normalizeChartsOrder(["b", 1, null, "zzz", {}, ["a"], "c"], known),
        ["b", "c", "a"],
      );
    });

    it("drops duplicates, keeping the first occurrence", () => {
      assert.deepEqual(normalizeChartsOrder(["b", "b", "a", "b", "a"], known), [
        "b",
        "a",
        "c",
      ]);
    });

    it("always returns a permutation of the known ids", () => {
      const result = normalizeChartsOrder(
        ["b", "nope", "b", 7, "a"],
        RESOURCE_USAGE_CARD_IDS,
      );
      assert.equal(result.length, RESOURCE_USAGE_CARD_IDS.length);
      assert.deepEqual(
        [...result].sort(),
        [...RESOURCE_USAGE_CARD_IDS].sort(),
        "no id may be lost or invented",
      );
    });
  });
});
