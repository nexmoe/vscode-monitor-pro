# CONTRIBUTING.MD

## Development Setup

1. Clone the repository.
2. Run the command `pnpm install` to install dependencies.

### Common commands

| Command                                        | What it does                                                              |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm run compile`                             | Type-check, then bundle `extension.ts` and `collector.worker.ts`          |
| `pnpm run watch`                               | Rebuild on change (esbuild + tsc in parallel)                             |
| `pnpm run check-types`                         | `tsc --noEmit` only                                                       |
| `pnpm run lint`                                | ESLint over `src`                                                         |
| `pnpm run test:unit`                           | Compile to `out/` and run the mocha unit tests                            |
| `pnpm run gen-l10n`                            | Re-export runtime strings from `src` into `l10n/` (see Localization)      |
| `pnpm run l10n:check`                          | `gen-l10n` + fail if the committed bundles differ from what source says   |
| `pnpm run l10n:parity`                         | Fail if any locale is missing keys, or `package.nls.json` drifts          |
| `pnpm run go:test`                             | Go backend: `go test ./...`                                               |
| `pnpm run go:vet`                              | Go backend: `go vet ./...`                                                |
| `pnpm run check:universal-vsix -- <file.vsix>` | Fail if a built universal `.vsix` ships `go-backend/bin` or `monitor.exe` |
| `pnpm run format`                              | Prettier over the repo                                                    |

### CI gates

`ci.yml` runs on every branch push and pull request, and fails on:

- `lint` and `test:unit` on Linux, macOS and Windows.
- `format:check`, `l10n:check` and `l10n:parity` on Linux only — the Windows
  runner checks out CRLF, which prettier and the generated-bundle diff would
  reject.
- Go: `go test`, `go vet` and `gofmt -l .` over `go-backend/`, plus
  cross-compiling and `file`-verifying both Windows targets. A single runner
  checks every Go file, so the platform-specific `_windows.go` variants cannot
  drift out of format unnoticed.

The packaging workflows add one more guard:

- `check:universal-vsix` — the universal `.vsix` must not contain
  `go-backend/bin` or `monitor.exe`. `package:vsix:universal` clears
  `go-backend/bin` first, so the check exists to catch a stale binary left
  behind by an earlier Windows build.

## Adding Metrics

A status bar metric touches a handful of files. The chain below is ordered so
that TypeScript points you at the next file: `MetricsExist` is _derived_ from
the `metrics` array (`src/constants.ts`), so a typo in a `section` name is a
compile error rather than a silently missing status bar item.

### 1. Implement the metric in `src/metrics.ts`

Add a formatter and register it in the `metrics` array at the bottom of the
file:

```ts
const cpuSpeedText = async () => {
  // ...
};

const metrics: MetricCtrProps[] = [
  { func: cpuText, section: "cpu" },
  { func: cpuSpeedText, section: "cpuSpeed" },
  // Add more metrics objects here
];
```

`section` must be a unique identifier. Adding an entry here automatically
extends the `MetricsExist` union type, so every `switch` and record keyed by it
will fail to compile until you have handled the new member.

### 2. Register the metric in `src/configuration.ts`

Append the section to the `allMetrics` array. That array defines both the
default enabled set and the default status bar order, because
`getMetricsEnabled()` and `getMetricsOrder()` iterate it.

### 3. Map it to a collection dimension in `src/metricMap.ts`

Each UI metric maps to a `CollectDimension` (one `systeminformation` call or a
local computation). Metrics that share a source share a dimension — for
example `memoryActive` and `memoryUsed` both map to `mem`. If your metric can
reuse an existing dimension, just point at it; only add a new dimension when it
needs a query no one performs yet, and make sure the `need("<dimension>")`
checks in `SIDataSource` and `collector.worker.ts` cover it.

Metrics computed locally (like `uptime`, which calls `os.uptime()`) still need
an entry, and borrow a placeholder dimension so they join the collection set.

### 4. Add a status bar title in `src/metricsInit.ts`

Extend the `getMetricTitle()` switch with a case for the new section. The
fallback returns the raw section name, so a missing case shows up as an
untranslated identifier in the status bar rather than an error.

### 5. Expose the setting in `package.json`

Add a boolean under `contributes.configuration.properties`, and list the new
section in both the `default` and `enum` arrays of `monitor-pro.metricsOrder`:

```json5
"monitor-pro.metrics.cpuSpeed": {
  "default": false,
  "description": "%config.metrics.cpuSpeed%",
  "type": "boolean"
},
```

Note that each metric has its own `monitor-pro.metrics.<name>` boolean; there is
no longer an array-valued `monitor-pro.metrics` setting.

### 6. Add the manifest string to `package.nls.json`

Add a `config.metrics.<name>` key whose value is the human-readable setting
description, then mirror the **same key** into `package.nls.ja.json`,
`package.nls.zh-cn.json` and `package.nls.zh-tw.json` with translated values.

Manifest strings (`package.nls*.json`) are maintained by hand and are _not_
generated — `l10n:parity` enforces that all four locales expose an identical
key set, and that `package.nls.json` contains exactly the `%key%` placeholders
`package.json` references. A missing translation and a leftover dead key both
fail the check.

### 7. Localization

Runtime strings use `vscode.l10n.t(...)` in source and are **generated**, never
edited by hand in the English bundle:

```bash
pnpm run gen-l10n    # rewrites l10n/bundle.l10n.json from the strings in src/
```

Then add the translated values for the new keys to `l10n/bundle.l10n.ja.json`,
`l10n/bundle.l10n.zh-cn.json` and `l10n/bundle.l10n.zh-tw.json` by hand. Verify
everything with:

```bash
pnpm run l10n:check    # gen-l10n must produce no diff against what is committed
pnpm run l10n:parity   # all locales must expose the same key set
```

`l10n:check` is what makes the generated bundle trustworthy in review: if you
forget to run `gen-l10n`, CI fails on the diff.

### 8. Resource Usage cards (optional)

A metric that also renders in the Resource Usage webview needs one entry in the
card registry, `src/resourceUsageCards.ts`. That array is the view's whole card
vocabulary — identity, data source, rendering, defaults — so no other file has
to learn about the card:

```ts
{
  id: "cpuSpeed",              // settings key and webview handle
  kind: "chart",               // "chart" | "text" | "disk"
  metric: "cpuSpeed",          // MetricsExist section this card reads
  label: l10n.t("CPU Speed"),  // must stay a literal l10n.t(...) call
  defaultEnabled: false,
  defaultView: "line",         // charts only
  defaultColor: "--vscode-terminal-ansiBrightCyan", // charts only
}
```

- `kind` decides what the card draws: `chart` is a canvas with the line/bar
  toggle, `text` is a label/value card, `disk` is the per-mount progress-bar
  card. Only `chart` reads `defaultView` and `defaultColor`.
- `metric` names the status bar section whose data the card subscribes to.
  Several cards can share one section (network, fileSystem, battery), so an
  enabled card means "collect this section", never "collect one more section".
- `label` has to be a literal `l10n.t(...)` at the definition site: the
  `gen-l10n` exporter only extracts literal call arguments, so passing a
  variable silently drops the title from the runtime bundle and fails
  `l10n:parity`.
- `array` is optional and adds the per-item view (one cell per CPU core or per
  GPU): `field` is the history-sample field holding the per-item values, `type`
  (`"percent"` / `"temp"` / `"mem"`) picks the cell semantics and scale,
  `prefix` labels the cells (`C0`, `G0`, …), and `valueKey` is required when
  that field holds objects.

The order the view renders cards in is the declaration order of this array, so
the `resourceUsage.chartsOrder` setting needs no list of ids: it stores only the
user's overrides, and `normalizeChartsOrder()` completes them against the
registry (unlisted cards follow in registry order, unknown ids and duplicates are
ignored). A card added to the registry shows up in the panel immediately.
Likewise the webview renders the card list the extension pushes to it, so
`assets/resourceUsageView.html` needs no new id — you only edit that file when
the card needs a kind of rendering that does not exist yet.

Optionally, add the card to the `default` object of
`monitor-pro.resourceUsage.charts` in `package.json`:

```json5
cpuSpeed: {
  "enabled": false,
  "view": "line",
  "color": "--vscode-terminal-ansiBrightCyan"
},
```

Nothing at runtime depends on it: `getResourceUsageConfig()` fills any card the
user has not configured from the registry entry. The manifest `default` is the
default object this setting exposes to the Settings editor, and a card that exists
only in the registry has no key inside it — such a card still renders with its
registry defaults, but a user who wants to configure it has to type the key. This
is the one place where a card default exists twice, and no check compares the two:
when you change `defaultEnabled` / `defaultView` / `defaultColor` in the registry,
update the manifest entry in the same commit.

## Debugging

To debug the extension, follow these steps:

1. Open Visual Studio Code.
2. Go to the **Menu** and select **Run**.
3. Choose **Start Debugging**.

For more detailed instructions, refer to the [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension) guide.
