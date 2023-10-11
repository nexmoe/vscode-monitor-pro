import { workspace } from "vscode";
import { MetricsExist } from "./constants";
export const getRefreshInterval = () =>
	workspace.getConfiguration().get<number>("monitor-pro.refresh-interval") ??
	1000;

export const getMetrics = workspace
	.getConfiguration()
	.get("monitor-pro.metrics") as MetricsExist[];
