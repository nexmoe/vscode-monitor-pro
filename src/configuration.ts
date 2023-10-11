import { workspace } from "vscode";

export const getRefreshInterval = () =>
	workspace
		.getConfiguration()
		.get<number>("resource-monitor.refresh-interval") ?? 1000;

export const getMetrics = <const>[
	"cpu",
	"memory",
	"memoryUsed",
	"network",
	"fileSystem",
	"battery",
	"cpuTemp",
	"cpuSpeed",
	"os",
];
