import { workspace } from "vscode";
import { OrderConfigurationKey } from "./constants";

export const getOrder = (key: OrderConfigurationKey) =>
	workspace.getConfiguration().get<number>(key) ?? 0;

export const getRefreshInterval = () =>
	workspace
		.getConfiguration()
		.get<number>("resource-monitor.refresh-interval") ?? 1000;
