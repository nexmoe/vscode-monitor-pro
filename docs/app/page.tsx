import { HomeLayout } from 'fumadocs-ui/home-layout'
import { Button } from '@/components/ui/button'
import { baseOptions } from './layout.config'
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
				<a href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro">
					<Button className="inline-flex h-12 items-center justify-center rounded-full px-8 py-2 text-sm font-medium shadow-lg transition-all">
						获取 Monitor Pro
					</Button>
				</a>
			</div>
		</section>
	)
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
	)
}

function HeroSection() {
	return (
		<section className="w-full py-24 md:py-32 lg:py-48 bg-gradient-to-b from-gray-100 to-white dark:from-gray-900 dark:to-black text-gray-900 dark:text-white overflow-hidden">
			<div className="container px-4 md:px-6 relative z-10">
				<div className="flex flex-col items-center space-y-12 text-center">
					<div className="space-y-6">
						<h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl/none bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500">
							Monitor Pro
						</h1>
						<p className="mx-auto max-w-[700px] text-gray-700 dark:text-gray-300 md:text-xl">
							为您的 VS Code 提供强大的系统监控能力,实时掌握资源使用情况。
						</p>
					</div>
					<div className="space-x-4">
						<a href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro">
							<Button className="inline-flex h-12 items-center justify-center rounded-full px-8 py-2 text-sm font-medium shadow-lg">
								立即获取
							</Button>
						</a>
						{/* <Button
							variant="outline"
							className="inline-flex h-12 items-center justify-center rounded-full border border-gray-900 dark:border-white bg-transparent px-8 py-2 text-sm font-medium shadow-lg transition-colors hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 dark:focus-visible:ring-white"
						>
							了解更多
						</Button> */}
					</div>
				</div>
				<div className="mt-16 flex justify-center">
					<img
						src="https://github.com/nexmoe/vscode-monitor-pro/raw/main/assets/screenshot0.png"
						alt="Monitor Pro 界面预览"
						className="rounded-2xl shadow-2xl w-full h-auto"
					/>
				</div>
			</div>
			<div className="absolute inset-0 bg-[url('/path-to-your-image.jpg')] bg-cover bg-center opacity-10"></div>
		</section>
	)
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
	)
}

function MonitoredResourcesSection() {
	return (
		<section className="w-full py-24 md:py-32 bg-white dark:bg-black">
			<div className="container px-4 md:px-6 mx-auto">
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

function ResourceItem({ icon, title, description }) {
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

function getIconPath(icon) {
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

export default function Home() {
	return (
		<HomeLayout {...baseOptions}>
			<div className="flex flex-col items-center bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white">
				<HeroSection />
				<FeaturesSection />
				<MonitoredResourcesSection />
				<StepsSection />
				<CTA />
			</div>
		</HomeLayout>
	)
}
