import { strict as assert } from "assert";

/**
 * Exercises the provider's write-back path against a stubbed `vscode` module.
 *
 * The point is the settings file's shape, not the API surface: a naive write
 * puts the whole 17-card default object into the user's settings, and a rebuilt
 * view on every click blanks the charts. Both are only observable at this layer,
 * so the messages are replayed through the real class instead of a helper.
 */

interface FakeChannelLine {
  level: string;
  message: string;
}

const settings = new Map<string, unknown>();
const updates: Array<{ key: string; value: unknown; target: number }> = [];
const logLines: FakeChannelLine[] = [];
let updateShouldFail = false;
let updateShouldThrow = false;

// Names and values mirror VS Code's own ConfigurationTarget enum: the stub has
// to answer to the exact property the provider reads, so the project's naming
// rule cannot apply here.
/* eslint-disable @typescript-eslint/naming-convention */
const ConfigurationTarget = {
  Global: 1,
  Workspace: 2,
  WorkspaceFolder: 3,
};
/* eslint-enable @typescript-eslint/naming-convention */

function formatMessage(message: string, ...args: unknown[]): string {
  return args.reduce<string>(
    (acc, value, index) => acc.replace(`{${index}}`, String(value)),
    message,
  );
}

const vscodeStub = {
  /* eslint-disable-next-line @typescript-eslint/naming-convention */
  ConfigurationTarget,
  l10n: { t: formatMessage },
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback?: unknown) =>
        settings.has(key) ? settings.get(key) : fallback,
      inspect: (key: string) => ({ key, globalValue: settings.get(key) }),
      update: (key: string, value: unknown, target: number) => {
        if (updateShouldThrow) {
          throw new Error("settings api blew up");
        }
        if (updateShouldFail) {
          return Promise.reject(new Error("settings are read-only"));
        }
        // Recorded synchronously, applied on a microtask: VS Code writes the file
        // and reloads its cache before update() settles, so a value inspected
        // while a write is still in flight is the old one.
        updates.push({ key, value, target });
        return new Promise<void>((resolve) => {
          queueMicrotask(() => {
            settings.set(key, value);
            resolve();
          });
        });
      },
    }),
  },
  window: {
    createOutputChannel: () => {
      const record = (level: string) => (message: string) =>
        logLines.push({ level, message });
      return {
        trace: record("trace"),
        debug: record("debug"),
        info: record("info"),
        warn: record("warn"),
        error: record("error"),
      };
    },
  },
};

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
    return vscodeStub;
  }
  return originalLoad.call(this, request, parent, isMain);
};

type ProviderModule = typeof import("./resourceUsageProvider");
type LoggerModule = typeof import("./logger");
const { ResourceUsageProvider } =
  require("./resourceUsageProvider") as ProviderModule;
const { getLogger } = require("./logger") as LoggerModule;

// The logger is spied through its own object instead of initLogger(): another
// test file in this suite loads the logger first behind a vscode stub that has
// no output channel, so the channel plumbing is not available here. What these
// tests care about is which level the provider reports at.
const logger = getLogger();
const originalDebug = logger.debug.bind(logger);
const originalError = logger.error.bind(logger);

interface FakeView {
  posted: Array<{ type?: string; data?: unknown }>;
  view: { webview: { postMessage(message: unknown): void } };
}

/** 等排队的写入全部 settle：写入走微任务，最后再让出一个宏任务。 */
async function flushSettingsWrites(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
  }
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function fakeView(): FakeView {
  const posted: FakeView["posted"] = [];
  return {
    posted,
    view: {
      webview: {
        postMessage: (message: unknown) =>
          posted.push(message as FakeView["posted"][number]),
      },
    },
  };
}

/**
 * A provider with a view attached. Attaching the view directly skips
 * resolveWebviewView() on purpose: that starts the collector and its worker,
 * which has nothing to do with the settings writes under test.
 */
function providerWithView(view: FakeView["view"]): {
  provider: InstanceType<ProviderModule["ResourceUsageProvider"]>;
  send(view: FakeView["view"], message: unknown): void;
} {
  const provider = new ResourceUsageProvider("/extension");
  (provider as unknown as Record<"_view", unknown>)._view = view;
  const send = (_view: FakeView["view"], message: unknown) =>
    (
      provider as unknown as {
        _handleMessage(v: unknown, m: unknown): void;
      }
    )._handleMessage(_view, message);
  return { provider, send };
}

describe("ResourceUsageProvider settings write-back", () => {
  beforeEach(() => {
    settings.clear();
    updates.length = 0;
    logLines.length = 0;
    updateShouldFail = false;
    updateShouldThrow = false;
    logger.debug = (message: string) =>
      logLines.push({ level: "debug", message });
    logger.error = (message: string) =>
      logLines.push({ level: "error", message });
  });

  afterEach(async () => {
    // Let every queued write settle; otherwise its callback would land inside the
    // next test and rewrite the settings map it just cleared.
    await flushSettingsWrites();
    logger.debug = originalDebug;
    logger.error = originalError;
  });

  it("writes only the addressed card's view, at user scope", () => {
    settings.set("resourceUsage.charts", {
      cpu: { enabled: false, color: "--vscode-charts-blue" },
      netRx: { enabled: true },
    });
    const view = fakeView();
    const { send } = providerWithView(view.view);

    send(view.view, { type: "setCardView", id: "cpu", view: "bar" });

    assert.equal(updates.length, 1);
    assert.equal(updates[0].key, "resourceUsage.charts");
    assert.equal(updates[0].target, ConfigurationTarget.Global);
    assert.deepEqual(updates[0].value, {
      cpu: { enabled: false, color: "--vscode-charts-blue", view: "bar" },
      netRx: { enabled: true },
    });
  });

  it("does not materialize the registry defaults into the settings file", () => {
    const view = fakeView();
    const { send } = providerWithView(view.view);

    send(view.view, { type: "setCardView", id: "cpu", view: "line" });

    assert.equal(updates.length, 1);
    const written = updates[0].value as Record<string, unknown>;
    assert.deepEqual(Object.keys(written), ["cpu"]);
    assert.deepEqual(written.cpu, { view: "line" });
  });

  it("writes the normalized order as one key", () => {
    const view = fakeView();
    const { send } = providerWithView(view.view);

    send(view.view, {
      type: "setChartsOrder",
      order: ["diskSpace", "cpu", "not-a-card", "cpu"],
    });

    assert.equal(updates.length, 1);
    assert.equal(updates[0].key, "resourceUsage.chartsOrder");
    assert.equal(updates[0].target, ConfigurationTarget.Global);
    const order = updates[0].value as string[];
    // The webview only reports the cards it rendered; ids it cannot know about
    // are appended in registry order rather than dropped from the layout.
    assert.equal(order.length, 17);
    assert.equal(order[0], "diskSpace");
    assert.equal(order[1], "cpu");
    assert.ok(order.includes("gpuMem"));
    assert.equal(new Set(order).size, 17);
  });

  it("ignores invalid requests instead of writing them", () => {
    const view = fakeView();
    const { send } = providerWithView(view.view);

    for (const message of [
      { type: "setCardView", id: "not-a-card", view: "bar" },
      { type: "setCardView", id: "cpu", view: "array" },
      { type: "setCardView", id: "cpu" },
      // Registered, but text and disk cards have no view to persist.
      { type: "setCardView", id: "uptime", view: "line" },
      { type: "setChartsOrder" },
      { type: "setChartsOrder", order: "cpu,memActive" },
      { type: "setChartsOrder", order: { order: ["cpu"] } },
      { type: "somethingElse" },
    ]) {
      send(view.view, message);
    }

    assert.equal(updates.length, 0);
    const debugLines = logLines.filter((line) => line.level === "debug");
    assert.equal(debugLines.length, 8);
  });

  it("suppresses exactly one config push after its own write", async () => {
    const view = fakeView();
    const { provider, send } = providerWithView(view.view);

    send(view.view, { type: "setCardView", id: "cpu", view: "bar" });
    // The host only reports this change once the write has landed, so the event
    // is replayed after the queue settles.
    await flushSettingsWrites();
    // The view already shows the new mode, so rebuilding it for the echo of
    // this write would blank every canvas until the next sample.
    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 0);

    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 1);
    assert.equal(view.posted[0].type, "config");
  });

  it("keeps both cards when two views arrive in the same tick", async () => {
    const view = fakeView();
    const { send } = providerWithView(view.view);

    // Same tick, two different cards: the second write must not start from the
    // snapshot taken before the first one landed, or it erases the first card.
    send(view.view, { type: "setCardView", id: "cpu", view: "bar" });
    send(view.view, { type: "setCardView", id: "gpu", view: "bar" });
    await flushSettingsWrites();

    assert.equal(updates.length, 2, "each gesture writes exactly once");
    for (const call of updates) {
      assert.equal(call.target, ConfigurationTarget.Global);
    }
    assert.deepEqual(updates[1].value, {
      cpu: { view: "bar" },
      gpu: { view: "bar" },
    });
    assert.deepEqual(settings.get("resourceUsage.charts"), {
      cpu: { view: "bar" },
      gpu: { view: "bar" },
    });
  });

  it("keeps the suppression one-shot across two rapid writes", async () => {
    const view = fakeView();
    const { provider, send } = providerWithView(view.view);

    send(view.view, { type: "setChartsOrder", order: ["cpu", "diskSpace"] });
    send(view.view, { type: "setCardView", id: "cpu", view: "bar" });
    await flushSettingsWrites();

    // Both writes landed before the first change event, so the mark describes the
    // settings as they are now; only the first push may be skipped.
    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 0);

    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 1);
  });

  it("still pushes when the change carried more than our write", async () => {
    const view = fakeView();
    const { provider, send } = providerWithView(view.view);

    send(view.view, { type: "setCardView", id: "cpu", view: "bar" });
    await flushSettingsWrites();
    // The user changed another key in the same change event; suppressing the
    // push would hide that from the view.
    settings.set("resourceUsage.samplingPoints", 30);

    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 1);
  });

  it("never suppresses the first render", async () => {
    const view = fakeView();
    const { provider, send } = providerWithView(view.view);

    send(view.view, { type: "setCardView", id: "cpu", view: "bar" });
    await flushSettingsWrites();
    send(view.view, { type: "ready" });
    assert.equal(view.posted.length, 1);
    assert.equal(view.posted[0].type, "config");

    // The mark survives the first render: the change event it belongs to has
    // not arrived yet, and that one is still not worth a rebuild.
    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 1);
  });

  it("re-pushes the persisted state once when the write is rejected", async () => {
    const view = fakeView();
    const { provider, send } = providerWithView(view.view);

    updateShouldFail = true;
    send(view.view, { type: "setCardView", id: "cpu", view: "bar" });
    await flushSettingsWrites();

    assert.equal(updates.length, 0);
    assert.equal(logLines.filter((line) => line.level === "error").length, 1);
    // The view is still showing the optimistic value, so the persisted state has
    // to be pushed back exactly once.
    assert.equal(view.posted.length, 1);
    assert.equal(view.posted[0].type, "config");

    // The mark is gone: no echo is coming for a write that failed.
    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 2);
  });

  it("survives a settings api that throws synchronously", async () => {
    const view = fakeView();
    const { provider, send } = providerWithView(view.view);

    updateShouldThrow = true;
    assert.doesNotThrow(() => {
      send(view.view, { type: "setCardView", id: "cpu", view: "bar" });
    });
    await flushSettingsWrites();

    assert.equal(updates.length, 0);
    assert.equal(logLines.filter((line) => line.level === "error").length, 1);
    assert.equal(view.posted.length, 1);
    assert.equal(view.posted[0].type, "config");

    provider.pushConfigUpdate();
    assert.equal(view.posted.length, 2);
  });

  it("never lets an exception escape the message handler", () => {
    const view = fakeView();
    const { send } = providerWithView(view.view);
    // A hostile message object: reading the type is enough to throw, which is
    // outside the write queue, so only the entry guard can absorb it.
    const hostile = {
      get type(): string {
        throw new Error("hostile message");
      },
    };

    assert.doesNotThrow(() => send(view.view, hostile));
    assert.equal(logLines.filter((line) => line.level === "error").length, 1);
    // The entry guard also pushes the persisted state back, since the view may
    // have applied something optimistically.
    assert.equal(view.posted.length, 1);
    assert.equal(view.posted[0].type, "config");
  });
});
