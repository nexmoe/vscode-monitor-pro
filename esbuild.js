const esbuild = require("esbuild");

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`[ERROR] ${text}`);
        if (location) {
          console.error(
            `    ${location.file}:${location.line}:${location.column}:`,
          );
        }
      });
      // logLevel is "silent" below, so warnings would vanish entirely
      // unless the plugin prints them.
      result.warnings.forEach(({ text, location }) => {
        console.warn(`[WARN] ${text}`);
        if (location) {
          console.warn(
            `    ${location.file}:${location.line}:${location.column}:`,
          );
        }
      });
      console.log("build finished");
    });
  },
};

async function main() {
  // Options shared by both bundles; the contexts below only add the entry
  // point, the output file and their own vscode-handling rule.
  const common = {
    bundle: true,
    format: "cjs",
    minify: production,
    // The .js.map files ship in the .vsix on purpose (do not add
    // dist/*.map to .vscodeignore): activate() installs source-map-support,
    // and logger.ts prefixes every log line with the caller's position
    // parsed from the remapped stack frame, so the packaged extension needs
    // the maps to log readable src/*.ts locations instead of minified
    // dist/extension.js offsets. sourcesContent stays false because
    // position remapping only needs the map's mappings — the source files
    // themselves are not shipped, so embedding their text would just bloat
    // every package.
    sourcemap: true,
    sourcesContent: false,
    platform: "node",
    logLevel: "silent",
  };

  const extCtx = await esbuild.context({
    ...common,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    // "vscode" is injected by the extension host at runtime, so it must be
    // kept external instead of bundled.
    external: ["vscode"],
    plugins: [esbuildProblemMatcherPlugin],
  });

  const workerCtx = await esbuild.context({
    ...common,
    entryPoints: ["src/collector.worker.ts"],
    outfile: "dist/collector.worker.js",
    // Deliberately no "external: vscode" here: the vscode API only exists
    // in the extension host thread, so a vscode import in the worker is a
    // design error that should fail loudly at build time rather than crash
    // at runtime.
    plugins: [esbuildProblemMatcherPlugin],
  });

  if (watch) {
    await Promise.all([extCtx.watch(), workerCtx.watch()]);
  } else {
    await Promise.all([extCtx.rebuild(), workerCtx.rebuild()]);
    await Promise.all([extCtx.dispose(), workerCtx.dispose()]);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
