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

### 8. Chart and info-card metrics (optional)

Metrics that also render in the Resource Usage webview need three more
registrations. These are currently maintained as three parallel lists and are
**not** covered by a consistency check, so keep them in sync by hand:

| Where                                           | What to add                                       |
| ----------------------------------------------- | ------------------------------------------------- |
| `src/configuration.ts` `DEFAULT_CHARTS`         | default `enabled` / `view` / `color` for the card |
| `src/extension.ts` `CHART_TO_METRIC`            | chart id -> `MetricsExist` section                |
| `assets/resourceUsageView.html` `ALL_CHART_IDS` | the chart id, so the frontend renders it          |

The webview is a single self-contained HTML file with its CSS and JS inlined;
adding a new chart id without all three entries means the card silently never
appears.

## Debugging

To debug the extension, follow these steps:

1. Open Visual Studio Code.
2. Go to the **Menu** and select **Run**.
3. Choose **Start Debugging**.

For more detailed instructions, refer to the [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension) guide.
