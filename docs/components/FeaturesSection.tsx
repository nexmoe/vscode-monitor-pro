export default function FeaturesSection() {
	return (
		<section id="features" className="w-full py-24 md:py-32 bg-white dark:bg-black">
			<div className="container px-4 md:px-6 space-y-16">
				<h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-12 text-center text-gray-900 dark:text-white">
					强大功能,一目了然
				</h2>
				<div className="grid grid-cols-1 md:grid-cols-4 gap-16">
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
								d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
							/>
						</svg>
						<h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
							远程 SSH 监控
						</h3>
						<p className="text-gray-600 dark:text-gray-400">
							轻松监控远程 SSH 连接的服务器资源,无需额外配置
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
