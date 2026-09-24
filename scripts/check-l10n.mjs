import { readFileSync } from "fs";

/**
 * l10n parity guard.
 *
 * Two independent checks run here, both of which CI enforces:
 *
 * 1. Every locale file must expose the exact same key set as the English
 *    source, for both the runtime bundles (l10n/bundle.l10n*.json) and the
 *    manifest strings (package.nls*.json). This catches a new string that was
 *    translated in only some languages, or a stale key left behind in others.
 * 2. package.nls.json must be exactly the set of `%key%` placeholders used by
 *    package.json. This catches both a placeholder with no translation and a
 *    leftover translation nothing references (the kind of dead key that built
 *    up silently before).
 *
 * The English runtime bundle is not checked against source here: that is the
 * job of `pnpm run l10n:check`, which runs the exporter and fails on any diff.
 */

const LOCALES = ["", ".ja", ".zh-cn", ".zh-tw"];
const BUNDLE = (locale) => `l10n/bundle.l10n${locale}.json`;
const NLS = (locale) => `package.nls${locale}.json`;

const keysOf = (file) =>
  new Set(Object.keys(JSON.parse(readFileSync(file, "utf8"))));

function sameKeys(label, files) {
  const base = keysOf(files[0]);
  const baseName = files[0];
  let ok = true;
  for (const file of files.slice(1)) {
    const keys = keysOf(file);
    const missing = [...base].filter((k) => !keys.has(k));
    const extra = [...keys].filter((k) => !base.has(k));
    if (missing.length || extra.length) {
      ok = false;
      console.error(`${label}: ${file} does not match ${baseName}`);
      if (missing.length)
        console.error(`  missing keys: ${missing.join(", ")}`);
      if (extra.length) console.error(`  extra keys: ${extra.join(", ")}`);
    }
  }
  return ok;
}

function nlsMatchesManifest() {
  const manifest = readFileSync("package.json", "utf8");
  const refs = new Set([...manifest.matchAll(/%([^%]+)%/g)].map((m) => m[1]));
  const nls = keysOf(NLS(""));

  const missing = [...refs].filter((k) => !nls.has(k));
  const dead = [...nls].filter((k) => !refs.has(k));

  if (missing.length) {
    console.error(
      `package.nls.json is missing keys referenced by package.json: ${missing.join(", ")}`,
    );
  }
  if (dead.length) {
    console.error(
      `package.nls.json has keys not referenced by package.json: ${dead.join(", ")}`,
    );
  }
  return { ok: !missing.length && !dead.length, count: nls.size };
}

const bundleOk = sameKeys("runtime bundle", LOCALES.map(BUNDLE));
const nlsOk = sameKeys("manifest nls", LOCALES.map(NLS));
const { ok: refOk, count } = nlsMatchesManifest();

if (bundleOk && nlsOk && refOk) {
  console.log(
    `l10n parity OK (runtime bundle: ${keysOf(BUNDLE("")).size} keys, manifest nls: ${count} keys)`,
  );
  process.exit(0);
}
process.exit(1);
