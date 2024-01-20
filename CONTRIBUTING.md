# CONTRIBUTING.MD

## Development Setup

1. Clone the repository.
2. Run the command `pnpm install` to install dependencies.

## Adding Metrics

To add metrics to the project, follow these steps:

### 1. Edit `metrics.ts`

In the `metrics.ts` file, locate the array `metrics` and add the following objects to it:

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

Open the `locales/en.json` file (and any other relevant localization files) and add the following entries:

```json5
"metric.cpuTemp.name": "CPU Temperature",
"metric.cpuSpeed.name": "CPU Speed",
"metric.osDistro.name": "OS Distribution",
// Add more metric entries here
```

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
