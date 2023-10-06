export const orderConfigurationKeys = <const>[
	"monitor-pro.order.cpu",
	"monitor-pro.order.memory",
	"monitor-pro.order.network",
	"monitor-pro.order.fileSystem",
	"monitor-pro.order.battery",
	"monitor-pro.order.cpuTemp",
	"monitor-pro.order.cpuSpeed",
	"monitor-pro.order.os",
];

export type OrderConfigurationKey = (typeof orderConfigurationKeys)[number];

export interface MetricCtrProps {
	func: () => Promise<string>;
	name: string;
	section: OrderConfigurationKey;
}
