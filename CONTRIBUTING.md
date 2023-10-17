# CONTRIBUTING.MD

## Start

Clone and run `pnpm install`

## Add Metrics

### 1. Edit `metrics.ts`

```ts
const metrics: MetricCtrProps[] = [
 //……
 {
  func: cpuSpeedText,
  section: "cpuSpeed",
 },
 {
  func: osDistroText,
  section: "osDistro",
 },
 // Add to here
];
```

### 2. Edit `locales/en.json` and others

```json
//……
"metric.cpuTemp.name": "CPU Temperature",
"metric.cpuSpeed.name": "CPU Speed",
"metric.osDistro.name": "OS Distribution"
// Add to here
//……
```

### 3. Edit `package.json`

```json
//……
"monitor-pro.metrics": {
  "type": "array",
  "items": {
    "type": "string",
    "enum": [
      "cpu", // section
      "memoryActive",
      "memoryUsed",
      "network",
      "fileSystem",
      "battery",
      "cpuTemp",
      "cpuSpeed",
      "osDistro"
      // Add to here
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
    "osDistro"
    // Add to here
  ],
  "description": "%config.metrics%"
},
//……
```

## Debug

VS Code -> Menu -> Run -> Start Debugging

See more: [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension#debugging-the-extension)
