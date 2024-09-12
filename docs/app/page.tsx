import { HomeLayout } from 'fumadocs-ui/home-layout'
import { baseOptions } from './layout.config'
import ShimmerButton from '@/components/magicui/shimmer-button'

import { Metadata } from 'next'
import Footer from '@/components/footer'
import MonitoredResourcesSection from '@/components/MonitoredResourcesSection'
import FeaturesSection from '@/components/FeaturesSection'
export const metadata = {
	title: 'Monitor Pro',
	description:
		'Monitor Pro is a VS Code extension that provides powerful system monitoring capabilities, allowing you to easily monitor CPU, memory, network, and disk usage.',
} satisfies Metadata

function CTA() {
	return (
		<section className="w-full py-16 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-900">
			<div className="container px-4 md:px-6 flex items-center justify-center flex-col">
				<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4 text-gray-900 dark:text-white">
					准备好提升您的开发体验了吗?
				</h2>
				<p className="mb-8 text-xl text-gray-700 dark:text-gray-300">
					立即安装 Monitor Pro，开启智能资源监控之旅!
				</p>
				<a href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro" target='_blank'>
					<ShimmerButton className="shadow-2xl">
						<span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 lg:text-lg">
							获取 Monitor Pro
						</span>
					</ShimmerButton>
				</a>
			</div>
		</section>
	)
}

function StepsSection() {
	return (
		<section className="w-full py-16 md:py-24 lg:py-32 bg-gradient-to-b from-white to-gray-100 dark:from-black dark:to-gray-900">
			<div className="container px-4 md:px-6 space-y-16">
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
							为您的 VS Code 提供强大的系统监控能力，实时掌握本地和 Remote SSH 连接的资源使用情况。
						</p>
					</div>
					<div className="space-x-4">
						<a href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro" target='_blank'>
							<ShimmerButton className="shadow-2xl">
								<span className="whitespace-pre-wrap text-center text-sm font-medium leading-none tracking-tight text-white dark:from-white dark:to-slate-900/10 lg:text-lg">
									获取 Monitor Pro
								</span>
							</ShimmerButton>
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
						width="1835"
						height="425"
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



export default function Home() {
	return (
		<HomeLayout {...baseOptions}>
			<div className="flex flex-col items-center bg-gradient-to-b from-gray-900 via-black to-gray-900 text-white">
				<HeroSection />
				<FeaturesSection />
				<MonitoredResourcesSection />
				<StepsSection />
				<CTA />
				<Footer />
			</div>
		</HomeLayout>
	)
}
