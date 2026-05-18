import os from "os";
import * as vscode from "vscode";
import byteFormat from "./byteFormat";
import { MetricCtrProps } from "./constants";
import { getDiskSpaceConfig } from "./configuration";
import { systemData } from "./systemData";

const _logger: { debug: (m: string) => void; warn: (m: string) => void; error: (m: string) => void } = {
	debug: () => {},
	warn: () => {},
	error: () => {},
};

export function setLogger(l: typeof _logger) {
	Object.assign(_logger, l);
}

const pretty = (bytes: number, option: any = {}): string => {
	return byteFormat(bytes, {
		binary: true,
		space: false,
		single: false,
		minimumFractionDigits: 1,
		minimumIntegerDigits: 1,
		minimumSignificantDigits: 4,
		maximumSignificantDigits: 4,
		...option,
	});
};

const cpuText = async () => {
	const data = await systemData.getSnapshot();
	const result = `$(pulse)${data.currentLoad.toLocaleString(undefined, {
		maximumSignificantDigits: 3,
		minimumSignificantDigits: 3,
	})}%`;
	_logger.debug(vscode.l10n.t("CPU load: {0}%", data.currentLoad.toFixed(2)));
	return result;
};

const memActiveText = async () => {
	const m = (await systemData.getSnapshot()).mem;
	_logger.debug(vscode.l10n.t("Memory - Total: {0}, Active: {1}, Used: {2}", m.total, m.active, m.used));
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

const memUsedText = async () => {
	const m = (await systemData.getSnapshot()).mem;
	let used, total;
	if (Number(pretty(m.total, { suffix: false })) < 100) {
		used = pretty(m.used, {
			minimumSignificantDigits: 3,
			maximumSignificantDigits: 3,
		});
		total = pretty(m.total, {
			minimumSignificantDigits: 3,
			maximumSignificantDigits: 3,
		});
	} else {
		used = pretty(m.used);
		total = pretty(m.total);
	}

	if (used.slice(-1) === total.slice(-1)) {
		return `$(server)${used.slice(0, -1)}/${total}`;
	}
	return `$(server)${used}/${total}`;
};

const netText = async () => {
	const ns = (await systemData.getSnapshot()).networkStats;
	const rawRx = ns?.[0]?.rx_sec;
	const rawTx = ns?.[0]?.tx_sec;
	const rx = rawRx || 0;
	const tx = rawTx || 0;
	_logger.debug(vscode.l10n.t("Network - RX: {0}/s, TX: {1}/s, Interface: {2}", rawRx, rawTx, ns?.[0]?.iface));
	return `$(cloud-download)${pretty(rx)}/s $(cloud-upload)${pretty(tx)}/s`;
};

const fsText = async () => {
	const fs = (await systemData.getSnapshot()).fsStats;
	_logger.debug(vscode.l10n.t("Filesystem - RX: {0}/s, WX: {1}/s, Total RX: {2}, Total WX: {3}, Interval: {4}ms",
		fs.rx_sec?.toString() ?? "null", fs.wx_sec?.toString() ?? "null", fs.rx, fs.wx, fs.ms));

	return `$(log-in)${pretty(fs.rx_sec || 0)}/s $(log-out)${pretty(
		fs.wx_sec || 0
	)}/s`;
};

const batteryText = async () => {
	const b = (await systemData.getSnapshot()).battery;
	_logger.debug(vscode.l10n.t("Battery - Has battery: {0}, Percent: {1}, Charging: {2}", b.hasBattery, b.percent, b.isCharging));
	if (!b.hasBattery) {
		return "";
	}
	const charging = b.isCharging ? vscode.l10n.t(" (Charging)") : "";
	return `$(plug)${b.percent}%${charging}`;
};

const cpuSpeedText = async () => {
	const cpuCurrentSpeed = (await systemData.getSnapshot()).cpuCurrentSpeed;
	_logger.debug(vscode.l10n.t("CPU Speed - Avg: {0}GHz, Min: {1}GHz, Max: {2}GHz", cpuCurrentSpeed.avg, cpuCurrentSpeed.min, cpuCurrentSpeed.max));
	if (!cpuCurrentSpeed.avg || cpuCurrentSpeed.avg === 0) {
		return "";
	}
	return `$(dashboard) ${cpuCurrentSpeed.avg}GHz`;
};

const cpuTempText = async () => {
	const cl = (await systemData.getSnapshot()).cpuTemperature;
	_logger.debug(vscode.l10n.t("CPU Temperature: {0}°C", cl.main?.toString() ?? vscode.l10n.t("N/A")));
	if (!cl.main) {
		return "";
	}
	return `$(thermometer)${cl.main}°C`;
};

const osDistroText = async () => {
	const osInfo = (await systemData.getSnapshot()).osInfo;
	return `${osInfo.distro}`;
};

const diskSpaceText = async () => {
	const fsSize = (await systemData.getSnapshot()).fsSize;
	const disksToShow = getDiskSpaceConfig();
	_logger.debug(vscode.l10n.t("Disk config: {0}, Found disks: {1}", JSON.stringify(disksToShow), fsSize.length));

	const formatDisk = (disk: { mount: string; size: number; used: number }) => {
		const total = disk.size;
		const used = disk.used;
		if (total === 0) {
			_logger.warn(vscode.l10n.t("Disk {0} has size=0, skipping", disk.mount));
			return null;
		}
		const usedPercentage = (used / total * 100).toFixed(1);
		return `$(database)${disk.mount} ${usedPercentage}% ${pretty(used)}/${pretty(total)}`;
	};

	if (disksToShow.includes('all') && fsSize.length > 0) {
		return fsSize.map(formatDisk).filter(Boolean).join(' | ');
	}
	return fsSize
		.filter(disk => disksToShow.includes(disk.mount))
		.map(formatDisk)
		.filter(Boolean)
		.join(' | ');
};

const uptimeText = async () => {
	const uptime = os.uptime();
	const days = Math.floor(uptime / (24 * 3600));
	const hours = Math.floor((uptime % (24 * 3600)) / 3600);
	const minutes = Math.floor((uptime % 3600) / 60);
	return `$(clock) ${days}d ${hours}h ${minutes}m`;
};

const metrics: MetricCtrProps[] = [
	{
		func: cpuText,
		section: "cpu",
	},
	{
		func: memActiveText,
		section: "memoryActive",
	},
	{
		func: memUsedText,
		section: "memoryUsed",
	},
	{
		func: netText,
		section: "network",
	},
	{
		func: fsText,
		section: "fileSystem",
	},
	{
		func: batteryText,
		section: "battery",
	},
	{
		func: cpuTempText,
		section: "cpuTemp",
	},
	{
		func: cpuSpeedText,
		section: "cpuSpeed",
	},
	{
		func: osDistroText,
		section: "osDistro",
	},
	{
		func: diskSpaceText,
		section: "diskSpace",
	},
	{
        func: uptimeText,
        section: "uptime",
    },
];

export default metrics;
