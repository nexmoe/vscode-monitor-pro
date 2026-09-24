import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const dir = "./l10n";

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const fp = join(dir, file);
  const obj = JSON.parse(readFileSync(fp, "utf8"));
  // Two-space indentation so the generated files match prettier's defaults and
  // "pnpm gen-l10n" does not fight "pnpm format:check".
  writeFileSync(fp, JSON.stringify(obj, Object.keys(obj).sort(), 2) + "\n");
}
