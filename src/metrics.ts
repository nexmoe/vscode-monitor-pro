import * as SI from "systeminformation";
import byteFormat from "./byteFormat";
import { MetricCtrProps } from "./constants";
import { getDiskSpaceConfig } from "./configuration";

/**
 * Converts a byte value into a nicely formatted string.
 * @param bytes The number of bytes to format.
 * @param option An optional options object to customize formatting behavior. By default, it uses binary units, no space,
 * a single unit suffix, and sets the minimum and maximum significant digits to 1 and 4. This object can override these defaults.
 * @returns The formatted byte size as a string.
 */
const pretty = (bytes: number, option: any = {}): string => {
	// Format the bytes using the byteFormat function, merging default options with user-provided ones
	return byteFormat(bytes, {
		binary: true, // Use binary units
		space: false, // Do not add a space before the unit
		single: true, // Use a single unit, e.g., don't display both KB and MB
		minimumFractionDigits: 1, // Minimum fraction digits
		minimumIntegerDigits: 1, // Minimum integer digits
		minimumSignificantDigits: 4, // Minimum significant digits
		maximumSignificantDigits: 4, // Maximum significant digits
		...option, // Override default options with user-provided ones
	});
};

const cpuText = async () => {
	const cl = await SI.currentLoad();
	return `$(pulse)${cl.currentLoad.toLocaleString(undefined, {
		maximumSignificantDigits: 3,
		minimumSignificantDigits: 3,
	})}%`;
};

const memActiveText = async () => {
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

const memUsedText = async () => {
	const m = await SI.mem();
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
	const ns = await SI.networkStats();
	return `$(cloud-download)${pretty(
		ns?.[0]?.rx_sec ?? 0
	)}/s $(cloud-upload)${pretty(ns?.[0]?.tx_sec ?? 0)}/s`;
};

/**
 * Retrieves and formats the file system read and write rate information.
 * No parameters.
 * @returns {Promise<string>} A promise that resolves to a formatted string of read and write rates, or an empty string if the data is unavailable or invalid.
 */
const fsText = async () => {
    // Fetches file system statistics
	const fs = await SI.fsStats();

    // Formats and returns the read and write rate information
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

const diskSpaceText = async () => {
    const fsSize = await SI.fsSize();
	const disksToShow = getDiskSpaceConfig();

    if (disksToShow.includes('all') && fsSize.length > 0) {
        return fsSize.map(disk => {
            const total = disk.size;
            const used = disk.used;
            const usedPercentage = (used / total * 100).toFixed(1);
            return `$(database)${disk.mount} ${usedPercentage}% ${pretty(used)}/${pretty(total)}`;
        }).join(' | ');
    }
    return fsSize
        .filter(disk => disksToShow.includes(disk.mount))
        .map(disk => {
            const total = disk.size;
            const used = disk.used;
            const usedPercentage = (used / total * 100).toFixed(1);
            return `$(database)${disk.mount} ${usedPercentage}% ${pretty(used)}/${pretty(total)}`;
        }).join(' | ');
};

const uptimeText = async () => {
	const uptime = await SI.time();
	const days = Math.floor(uptime.uptime / (24 * 3600));
	const hours = Math.floor((uptime.uptime % (24 * 3600)) / 3600);
	const minutes = Math.floor((uptime.uptime % 3600) / 60);
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