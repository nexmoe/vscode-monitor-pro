export default function MonitoredResourcesSection() {
	return (
		<section className="w-full py-24 md:py-32 bg-white dark:bg-black">
			<div className="container px-4 md:px-6 space-y-16 mx-auto">
				<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center text-gray-900 dark:text-white">
					支持监控的资源
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
					<ResourceItem icon="cpu" title="CPU 使用率" description="实时监控 CPU 使用情况" />
					<ResourceItem icon="activity" title="CPU 频率" description="跟踪 CPU 当前运行频率" />
					<ResourceItem icon="thermometer" title="CPU 温度" description="监控 CPU 温度变化" />
					<ResourceItem icon="database" title="内存使用" description="追踪系统内存消耗情况" />
					<ResourceItem icon="wifi" title="网络使用" description="监控网络流量和带宽使用" />
					<ResourceItem icon="hard-drive" title="磁盘使用" description="查看磁盘空间和读写速率" />
					<ResourceItem
						icon="battery-charging"
						title="电池状态"
						description="显示电池电量和充电状态"
					/>
					<ResourceItem icon="server" title="操作系统" description="显示当前操作系统信息" />
					<ResourceItem icon="clock" title="系统运行时间" description="记录系统持续运行的时间" />
				</div>
			</div>
		</section>
	)
}

function ResourceItem({ icon, title, description }: { icon: string; title: string; description: string }) {
	return (
		<div className="flex flex-col items-center text-center p-12 border border-gray-300 bg-white backdrop-blur-sm hover:bg-gray-100 rounded-3xl shadow-lg transition-all hover:shadow-xl hover:scale-105 ease-in-out dark:border-gray-700  dark:bg-gray-800/50 dark:hover:bg-gray-800/80">
			<div className="w-20 h-20 mb-6 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
				<svg
					className="w-12 h-12 text-white"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
					xmlns="http://www.w3.org/2000/svg"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth={2}
						d={getIconPath(icon)}
					/>
				</svg>
			</div>
			<h3 className="text-2xl font-semibold mb-3 text-gray-900 dark:text-white">{title}</h3>
			<p className="text-gray-600 dark:text-gray-400">{description}</p>
		</div>
	)
}

function getIconPath(icon: string) {
	switch (icon) {
		case 'cpu':
			return 'M4 4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 2h16v12H4V6zm2 3h12M6 12h12m-9 3h6'
		case 'activity':
			return 'M22 12h-4l-3 9L9 3l-3 9H2'
		case 'thermometer':
			return 'M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z'
		case 'database':
			return 'M12 2a8 8 0 0 0-8 8v12a8 8 0 0 0 16 0V10a8 8 0 0 0-8-8zm0 4a4 4 0 0 1 4 4v12a4 4 0 0 1-8 0V10a4 4 0 0 1 4-4z'
		case 'wifi':
			return 'M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01'
		case 'hard-drive':
			return 'M22 12H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01'
		case 'battery-charging':
			return 'M5 18H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3.19M15 6h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-3.19M23 13v-2M11 6l-4 6h6l-4 6'
		case 'server':
			return 'M22 12H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zM6 16h.01M10 16h.01'
		case 'clock':
			return 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20zm0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16zm1-8.59V7a1 1 0 0 0-2 0v5a1 1 0 0 0 .29.71l3 3a1 1 0 0 0 1.42-1.42L13 11.41z'
		default:
			return ''
	}
}