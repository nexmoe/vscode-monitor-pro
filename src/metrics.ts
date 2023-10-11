import * as SI from "systeminformation";
import byteFormat from "./byteFormat";
import { MetricCtrProps } from "./constants";

const pretty = (bytes: number, option: any = {}): string => {
	return byteFormat(bytes, {
		binary: true,
		space: false,
		single: true,
		minimumFractionDigits: 1,
		minimumIntegerDigits: 1,
		minimumSignificantDigits: 4,
		maximumSignificantDigits: 4,
		...option,
	});
};

const cpuText = async () => {
	const cl = await SI.currentLoad();
	return `$(pulse)${cl.currentLoad.toLocaleString(undefined, {
		maximumSignificantDigits: 3,
		minimumSignificantDigits: 3,
	})}%`;
};

const memText = async () => {
	const m = await SI.mem();
	let active, total;
	if (Number(pretty(m.total, { suffix: false })) < 100) {
		active = pretty(m.active, {
			minimumSignificantDigits: 3,
			maximumSignificantDigits: 3,
		});
		total = pretty(m.total, {
			minimumSignificantDigits: 3,
			maximumSignificantDigits: 3,
		});
	} else {
		active = pretty(m.active);
		total = pretty(m.total);
	}

	if (active.slice(-1) === total.slice(-1)) {
		return `$(server)${active.slice(0, -1)}/${total}`;
	}
	return `$(server)${active}/${total}`;
};

const netText = async () => {
	const ns = await SI.networkStats();
	return `$(cloud-download)${pretty(
		ns?.[0]?.rx_sec ?? 0
	)}/s $(cloud-upload)${pretty(ns?.[0]?.tx_sec ?? 0)}/s`;
};


const fsText = async () => {
	const fs = await SI.fsStats();
	if (!fs || !fs.wx_sec) {
		return "";
	}
	return `$(log-in)${pretty(fs.wx_sec ?? 0)}/s $(log-out)${pretty(
		fs.rx_sec ?? 0
	)}/s`;
};

const batteryText = async () => {
	const b = await SI.battery();
	if (!b.hasBattery) {
		return "";
	}
	return `$(plug)${b.percent}%${b.isCharging ? "(Charging)" : ""}`;
};

const cpuSpeedText = async () => {
	let cpuCurrentSpeed = await SI.cpuCurrentSpeed();
	return `$(dashboard) ${cpuCurrentSpeed.avg}GHz`;
};

const cpuTempText = async () => {
	const cl = await SI.cpuTemperature();
	if (!cl.main) {
		return "";
	}
	return `$(thermometer)${cl.main}°C`;
};

const osDistroText = async () => {
	const os = await SI.osInfo();
	return `${os.distro}`;
};

const metrics: MetricCtrProps[] = [
	{
		func: cpuText,
		name: "CPU Usage",
		section: "monitor-pro.order.cpu",
	},
	{
		func: memText,
		name: "Memory Usage (excl. buffers/cache)",
		section: "monitor-pro.order.memory",
	},
	{
		func: netText,
		name: "Network Usage (Down/Up)",
		section: "monitor-pro.order.network",
	},
	{
		func: fsText,
		name: "File System Usage (Write/Read)",
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
	{
		func: cpuSpeedText,
		name: "CPU Speed",
		section: "monitor-pro.order.cpuSpeed",
	},
	{
		func: osDistroText,
		name: "OS Distro",
		section: "monitor-pro.order.os",
	},
];

export default metrics;
