import { HomeLayout } from 'fumadocs-ui/home-layout'
import Image from 'next/image'

export default function Home() {
	return (
		<HomeLayout>
			<div className="flex flex-col items-center">
				{/* Hero 部分 */}
				<section className="w-full py-12 md:py-24 lg:py-32 xl:py-48">
					<div className="container px-4 md:px-6">
						<div className="flex flex-col items-center space-y-4 text-center">
							<div className="space-y-2">
								<h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
									Monitor Pro
								</h1>
								<p className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400">
									为您的VS Code提供强大的系统监控能力,实时掌握资源使用情况。
								</p>
							</div>
							<div className="space-x-4">
								<a
									className="inline-flex h-9 items-center justify-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-gray-50 shadow transition-colors hover:bg-gray-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90 dark:focus-visible:ring-gray-300"
									href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro"
								>
									立即获取
								</a>
								<a
									className="inline-flex h-9 items-center justify-center rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:hover:bg-gray-800 dark:hover:text-gray-50 dark:focus-visible:ring-gray-300"
									href="#features"
								>
									了解更多
								</a>
							</div>
						</div>
					</div>
				</section>

				{/* 支持的监控资源部分 */}
				<section className="w-full py-12 md:py-24 lg:py-32 bg-gradient-to-b from-white to-gray-100 dark:from-gray-900 dark:to-gray-800">
					<div className="container px-4 md:px-6 mx-auto">
						<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-300">
							支持的监控资源
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
							<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
								<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
									CPU
								</h3>
								<ul className="space-y-2 text-gray-600 dark:text-gray-400">
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										CPU 使用率
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										CPU 频率
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										CPU 温度 (如可用)
									</li>
								</ul>
							</div>
							<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
								<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
									内存
								</h3>
								<ul className="space-y-2 text-gray-600 dark:text-gray-400">
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										内存使用情况
									</li>
								</ul>
							</div>
							<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
								<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
									网络
								</h3>
								<ul className="space-y-2 text-gray-600 dark:text-gray-400">
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										网络使用情况
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										传入/传出数据速率
									</li>
								</ul>
							</div>
							<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
								<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
									文件系统
								</h3>
								<ul className="space-y-2 text-gray-600 dark:text-gray-400">
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										文件系统使用情况 (Linux, macOS)
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										磁盘读写速率
									</li>
								</ul>
							</div>
							<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
								<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
									电池
								</h3>
								<ul className="space-y-2 text-gray-600 dark:text-gray-400">
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										电池百分比
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										充电状态
									</li>
								</ul>
							</div>
							<div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700">
								<h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
									其他
								</h3>
								<ul className="space-y-2 text-gray-600 dark:text-gray-400">
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										操作系统信息
									</li>
									<li className="flex items-center">
										<svg
											className="w-4 h-4 mr-2 text-green-500"
											fill="currentColor"
											viewBox="0 0 20 20"
										>
											<path
												fillRule="evenodd"
												d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
												clipRule="evenodd"
											></path>
										</svg>
										远程 SSH 资源监控
									</li>
								</ul>
							</div>
						</div>
					</div>
				</section>

				{/* 主要特性部分 */}
				<section
					id="features"
					className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800"
				>
					<div className="container px-4 md:px-6">
						<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center">
							强大功能,一目了然
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
							<div className="flex flex-col items-center text-center">
								<svg
									className="w-12 h-12 mb-4 text-gray-900 dark:text-gray-100"
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
								<h3 className="text-xl font-semibold mb-2">实时监控</h3>
								<p className="text-gray-600 dark:text-gray-400">
									CPU、内存、网络等系统资源的实时监控
								</p>
							</div>
							<div className="flex flex-col items-center text-center">
								<svg
									className="w-12 h-12 mb-4 text-gray-900 dark:text-gray-100"
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
								<h3 className="text-xl font-semibold mb-2">自定义布局</h3>
								<p className="text-gray-600 dark:text-gray-400">
									根据个人需求调整监控项目顺序
								</p>
							</div>
							<div className="flex flex-col items-center text-center">
								<svg
									className="w-12 h-12 mb-4 text-gray-900 dark:text-gray-100"
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
								<h3 className="text-xl font-semibold mb-2">多语言支持</h3>
								<p className="text-gray-600 dark:text-gray-400">
									支持多种语言,满足全球用户需求
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* 产品展示部分 */}
				<section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
					<div className="container px-4 md:px-6">
						<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center">
							简洁优雅,一键掌控
						</h2>
						<div className="rounded-lg overflow-hidden shadow-xl">
							<Image
								src="./screenshot0.png"
								alt="Monitor Pro 截图"
								width={1200}
								height={675}
								className="w-full"
							/>
						</div>
					</div>
				</section>

				{/* 使用步骤部分 */}
				<section className="w-full py-12 md:py-24 lg:py-32">
					<div className="container px-4 md:px-6">
						<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center">
							简单四步,轻松上手
						</h2>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
							<div className="flex flex-col items-center text-center">
								<div className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
									1
								</div>
								<h3 className="text-lg font-semibold mb-2">安装插件</h3>
								<p className="text-gray-600 dark:text-gray-400">
									在VS Code扩展市场搜索"Monitor Pro"并安装
								</p>
							</div>
							<div className="flex flex-col items-center text-center">
								<div className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
									2
								</div>
								<h3 className="text-lg font-semibold mb-2">激活插件</h3>
								<p className="text-gray-600 dark:text-gray-400">安装完成后,插件会自动激活</p>
							</div>
							<div className="flex flex-col items-center text-center">
								<div className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
									3
								</div>
								<h3 className="text-lg font-semibold mb-2">查看监控</h3>
								<p className="text-gray-600 dark:text-gray-400">
									在VS Code底部状态栏查看系统资源使用情况
								</p>
							</div>
							<div className="flex flex-col items-center text-center">
								<div className="bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900 rounded-full w-12 h-12 flex items-center justify-center mb-4 text-xl font-bold">
									4
								</div>
								<h3 className="text-lg font-semibold mb-2">自定义设置</h3>
								<p className="text-gray-600 dark:text-gray-400">
									根据需要调整监控项目和刷新间隔
								</p>
							</div>
						</div>
					</div>
				</section>

				{/* CTA 部分 */}
				<section className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
					<div className="container px-4 md:px-6 text-center">
						<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-4">
							准备好提升您的开发体验了吗?
						</h2>
						<p className="mb-8 text-xl text-gray-500 dark:text-gray-400">
							立即安装 Monitor Pro,开启智能资源监控之旅!
						</p>
						<a
							href="https://marketplace.visualstudio.com/items?itemName=nexmoe.monitor-pro"
							className="inline-flex h-11 items-center justify-center rounded-md bg-gray-900 px-8 text-sm font-medium text-gray-50 shadow transition-colors hover:bg-gray-900/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-950 disabled:pointer-events-none disabled:opacity-50 dark:bg-gray-50 dark:text-gray-900 dark:hover:bg-gray-50/90 dark:focus-visible:ring-gray-300"
						>
							获取 Monitor Pro
						</a>
					</div>
				</section>
			</div>
		</HomeLayout>
	)
}
