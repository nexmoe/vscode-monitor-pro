import { HomeLayout } from 'fumadocs-ui/home-layout';
import { motion } from 'framer-motion';

function CTA() {
	return (
		<section className="w-full py-16 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-900">
			<div className="container px-4 md:px-6 text-center">
				<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4 text-gray-900 dark:text-white">
					准备好提升您的开发体验了吗?
				</h2>
				<p className="mb-8 text-xl text-gray-700 dark:text-gray-300">
					立即安装 Monitor Pro,开启智能资源监控之旅!
				</p>
				<a
					href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro"
					className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-2 text-sm font-medium shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
				>
					获取 Monitor Pro
				</a>
			</div>
		</section>
	);
}

function StepsSection() {
	return (
		<section className="w-full py-16 md:py-24 lg:py-32 bg-gradient-to-b from-white to-gray-100 dark:from-black dark:to-gray-900">
			<div className="container px-4 md:px-6">
				<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center text-gray-900 dark:text-white">
					简单四步,轻松上手
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
					<div className="flex flex-col items-center text-center">
						<div className="bg-gray-900 text-white dark:bg-white dark:text-black rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
							1
						</div>
						<h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">安装插件</h3>
						<p className="text-gray-600 dark:text-gray-400">
							在VS Code扩展市场搜索"Monitor Pro"并安装
						</p>
					</div>
					<div className="flex flex-col items-center text-center">
						<div className="bg-gray-900 text-white dark:bg-white dark:text-black rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
							2
						</div>
						<h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">激活插件</h3>
						<p className="text-gray-600 dark:text-gray-400">安装完成后,插件会自动激活</p>
					</div>
					<div className="flex flex-col items-center text-center">
						<div className="bg-gray-900 text-white dark:bg-white dark:text-black rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
							3
						</div>
						<h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">查看监控</h3>
						<p className="text-gray-600 dark:text-gray-400">
							在VS Code底部状态栏查看系统资源使用情况
						</p>
					</div>
					<div className="flex flex-col items-center text-center">
						<div className="bg-gray-900 text-white dark:bg-white dark:text-black rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
							4
						</div>
						<h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
							自定义设置
						</h3>
						<p className="text-gray-600 dark:text-gray-400">根据需要调整监控项目和刷新间隔</p>
					</div>
				</div>
			</div>
		</section>
	);
}

function HeroSection() {
	return (
		<section className="w-full py-24 md:py-32 lg:py-48 bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-black text-gray-900 dark:text-white overflow-hidden">
			<div className="container px-4 md:px-6 relative z-10">
				<div className="flex flex-col items-center space-y-4 text-center">
					<div className="space-y-2">
						<h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
							Monitor Pro
						</h1>
						<p className="mx-auto max-w-[700px] text-gray-700 dark:text-gray-300 md:text-xl">
							为您的VS Code提供强大的系统监控能力,实时掌握资源使用情况。
						</p>
					</div>
					<div className="space-x-4">
						<a
							className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white px-8 py-2 text-sm font-medium shadow-lg transition-all hover:from-blue-600 hover:to-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
							href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro"
						>
							立即获取
						</a>
						<a
							className="inline-flex h-12 items-center justify-center rounded-full border border-gray-900 dark:border-white bg-transparent px-8 py-2 text-sm font-medium shadow-lg transition-colors hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white"
							href="#features"
						>
							了解更多
						</a>
					</div>
				</div>
			</div>
			<div className="absolute inset-0 bg-[url('/path-to-your-image.jpg')] bg-cover bg-center opacity-10"></div>
		</section>
	);
}

function FeaturesSection() {
	return (
		<section id="features" className="w-full py-24 md:py-32 bg-white dark:bg-black">
			<div className="container px-4 md:px-6">
				<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center text-gray-900 dark:text-white">
					强大功能,一目了然
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
					<div className="flex flex-col items-center text-center">
						<svg
							className="w-12 h-12 mb-4 text-gray-900 dark:text-white"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
							/>
						</svg>
						<h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">实时监控</h3>
						<p className="text-gray-600 dark:text-gray-400">
							CPU、内存、网络等系统资源的实时监控
						</p>
					</div>
					<div className="flex flex-col items-center text-center">
						<svg
							className="w-12 h-12 mb-4 text-gray-900 dark:text-white"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
							/>
						</svg>
						<h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
							自定义布局
						</h3>
						<p className="text-gray-600 dark:text-gray-400">根据个人需求调整监控项目顺序</p>
					</div>
					<div className="flex flex-col items-center text-center">
						<svg
							className="w-12 h-12 mb-4 text-gray-900 dark:text-white"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
							/>
						</svg>
						<h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
							多语言支持
						</h3>
						<p className="text-gray-600 dark:text-gray-400">支持多种语言,满足全球用户需求</p>
					</div>
				</div>
			</div>
		</section>
	);
}

function MonitoredResourcesSection() {
	return (
		<section className="w-full py-24 md:py-32 bg-white dark:bg-black">
			<div className="container px-4 md:px-6">
				<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center text-gray-900 dark:text-white">
					支持监控的资源
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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
	);
}

function ResourceItem({ icon, title, description }) {
	return (
		<div className="flex flex-col items-center text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
			<svg
				className="w-12 h-12 mb-4 text-blue-500"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				xmlns="http://www.w3.org/2000/svg"
			>
				<use xlinkHref={`/icons.svg#${icon}`} />
			</svg>
			<h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{title}</h3>
			<p className="text-gray-600 dark:text-gray-400">{description}</p>
		</div>
	);
}

export default function Home() {
	return (
		<HomeLayout>
			<div className="flex flex-col items-center bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white">
				<HeroSection />
				<FeaturesSection />
				<MonitoredResourcesSection />
				<StepsSection />
				<CTA />
			</div>
		</HomeLayout>
	);
}
