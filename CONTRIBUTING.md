# CONTRIBUTING.MD

## Development Setup

1. Clone the repository.
2. Run the command `pnpm install` to install dependencies.

## Project Structure

```
vscode-monitor-pro/
├── src/                    # Extension source code
│   ├── extension.ts        # Entry point, activation & deactivation
│   ├── metrics.ts          # Metric text generation functions
│   ├── metricsInit.ts      # Metric class & status bar item creation
│   ├── configuration.ts    # Configuration access functions
│   ├── constants.ts        # Type definitions & constants
│   ├── logger.ts           # Output channel logger
│   ├── systemData.ts       # Data layer & subscription
│   ├── goBackend.ts        # Go backend manager
│   ├── dataSource.ts       # Data source abstraction
│   ├── battery.ts          # Battery time estimation
│   ├── byteFormat.ts       # Byte formatting utility
│   ├── diskSpace.ts        # Disk space deduplication
│   ├── resourceUsageProvider.ts  # Webview resource usage view
│   └── mactop-backend/     # macOS Apple Silicon backend
├── go-backend/             # Go backend (Windows performance data)
├── l10n/                   # Localization files
├── scripts/                # Build & utility scripts
├── assets/                 # Icons & static assets
├── docs/                   # Documentation
├── .github/                # GitHub Actions & issue templates
├── package.json            # Extension manifest
└── tsconfig.json           # TypeScript configuration
```

## Adding Metrics

To add metrics to the project, follow these steps:

### 1. Edit `src/metrics.ts`

In the `src/metrics.ts` file, locate the array `metrics` and add the following objects to it:

```ts
{
  func: cpuSpeedText,
  section: "cpuSpeed",
},
{
  func: osDistroText,
  section: "osDistro",
},
// Add more metrics objects here
```

### 2. Edit localization files

Open the `l10n` directory and add the relevant localization entries to each language file.

### 3. Update `package.json`

In the `package.json` file, locate the `"monitor-pro.metrics"` section and add the newly added metrics to the `"default"` array and the `"enum"` array:

```json5
"monitor-pro.metrics": {
  "type": "array",
  "items": {
    "type": "string",
    "enum": [
      "cpu",
      "memoryActive",
      "memoryUsed",
      "network",
      "fileSystem",
      "battery",
      "cpuTemp",
      "cpuSpeed",
      "osDistro",
      // Add more metrics here
    ]
  },
  "default": [
    "cpu",
    "memoryActive",
    "memoryUsed",
    "network",
    "fileSystem",
    "battery",
    "cpuTemp",
    "cpuSpeed",
    "osDistro",
    // Add more metrics here
  ],
  "description": "%config.metrics%"
},
//...
```

## Debugging

To debug the extension, follow these steps:

1. Open Visual Studio Code.
2. Go to the **Menu** and select **Run**.
3. Choose **Start Debugging**.

For more detailed instructions, refer to the [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension) guide.
