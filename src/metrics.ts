import prettyBytes from "pretty-bytes";
import * as SI from "systeminformation";
import { MetricCtrProps } from "./constants";

const pretty = (bytes: number, option: any = {}): string => {
	return prettyBytes(bytes, {
		binary: true,
		space: false,
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
		...option,
	});
};

const cpuText = async () => {
	const cl = await SI.currentLoad();
	return `$(pulse)${cl.currentLoad.toFixed(2)}%`;
};

const memText = async () => {
	const m = await SI.mem();
	const active = pretty(m.active, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	}).replace(/[a-zA-Z\s]+/, "");
	const total = pretty(m.total, {
		minimumFractionDigits: 1,
		maximumFractionDigits: 1,
	});
	return `$(server)${active}/${total}`;
};

const netText = async () => {
	const ns = await SI.networkStats();
	return `$(cloud-download)${pretty(
		ns?.[0]?.rx_sec ?? 0
	)} $(cloud-upload)${pretty(ns?.[0]?.tx_sec ?? 0)}`;
};

const fsText = async () => {
	const fs = await SI.fsStats();
	return `$(log-in)${pretty(fs.wx_sec ?? 0)}$(log-out)${pretty(
		fs.rx_sec ?? 0
	)}`;
};

const batteryText = async () => {
	const b = await SI.battery();
	if (!b.hasBattery) {
		return "";
	}
	return `$(plug)${b.percent}%${b.isCharging ? "(Charging)" : ""}`;
};

const cpuTempText = async () => {
	const cl = await SI.cpuTemperature();
	if (!cl.main) {
		return "";
	}
	return `$(thermometer)${cl.main}°C`;
};

const metrics: MetricCtrProps[] = [
	{
		func: cpuText,
		name: "CPU Usage",
		section: "monitor-pro.order.cpu",
	},
	{
		func: memText,
		name: "Memory Usage",
		section: "monitor-pro.order.memory",
	},
	{
		func: netText,
		name: "Network Usage",
		section: "monitor-pro.order.network",
	},
	{
		func: fsText,
		name: "File System Usage",
		section: "monitor-pro.order.fileSystem",
	},
	{
		func: batteryText,
		name: "Battery Status",
		section: "monitor-pro.order.battery",
	},
	{
		func: cpuTempText,
		name: "CPU Temperature",
		section: "monitor-pro.order.cpuTemp",
	},
];

export default metrics;
