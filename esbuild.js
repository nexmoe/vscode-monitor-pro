const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',
	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const extCtx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode', 'osx-temperature-sensor'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	const workerCtx = await esbuild.context({
		entryPoints: [
			'src/collector.worker.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/collector.worker.js',
		external: ['systeminformation'],
		logLevel: 'silent',
	});

	if (watch) {
		await Promise.all([extCtx.watch(), workerCtx.watch()]);
	} else {
		await Promise.all([extCtx.rebuild(), workerCtx.rebuild()]);
		await Promise.all([extCtx.dispose(), workerCtx.dispose()]);
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
