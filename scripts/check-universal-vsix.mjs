import { readFileSync } from "fs";

/**
 * Universal .vsix guard.
 *
 * The Go backend is only used on Windows (see shouldUseGoBackend() in
 * src/extension.ts), so the universal package -- the one macOS and Linux users
 * install -- must never carry go-backend/bin/monitor.exe. A stale binary left
 * in the working tree by an earlier win32 build is the realistic way that
 * regresses: `pnpm run package:vsix:universal` clears go-backend/bin first and
 * this script proves the produced archive is actually clean.
 *
 * The .vsix is a zip, and the entry names live in its central directory, so the
 * archive can be inspected with Node built-ins alone: no unzip binary, no extra
 * dependency, and the same result on the ubuntu runner as on a dev machine.
 *
 * Usage: node scripts/check-universal-vsix.mjs <path-to-universal.vsix>
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const EOCD_MIN_SIZE = 22;
// The EOCD record is followed by an optional zip comment of at most 64 KiB.
const MAX_COMMENT_SIZE = 0xffff;

/** Windows-only payload that must not appear in a universal package. */
const FORBIDDEN = [
  {
    label: "Go backend binary directory",
    test: (name) => /(^|\/)go-backend\/bin\//i.test(name),
  },
  {
    label: "Windows executable",
    test: (name) => /(^|\/)monitor\.exe$/i.test(name),
  },
];

/**
 * Read every entry name from a zip central directory.
 *
 * Only the central directory is parsed, so entry payloads are never
 * decompressed -- checking a multi-megabyte vsix stays cheap.
 */
function listZipEntries(buffer) {
  const searchFrom = Math.max(
    0,
    buffer.length - EOCD_MIN_SIZE - MAX_COMMENT_SIZE,
  );
  let eocd = -1;
  for (let i = buffer.length - EOCD_MIN_SIZE; i >= searchFrom; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error("not a zip archive (no end-of-central-directory record)");
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);

  if (
    directoryOffset === 0xffffffff ||
    directorySize === 0xffffffff ||
    entryCount === 0xffff
  ) {
    throw new Error("zip64 archives are not supported by this check");
  }
  if (directoryOffset + directorySize > buffer.length) {
    throw new Error("central directory is truncated");
  }

  const names = [];
  let cursor = directoryOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(cursor) !== CENTRAL_SIGNATURE) {
      throw new Error(`malformed central directory entry at offset ${cursor}`);
    }
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    names.push(buffer.toString("utf8", cursor + 46, cursor + 46 + nameLength));
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

// pnpm forwards the `--` separator to the script, so drop it before reading the
// archive path (`pnpm run check:universal-vsix -- file.vsix` and
// `node scripts/check-universal-vsix.mjs file.vsix` both work).
const target = process.argv.slice(2).find((arg) => arg !== "--");
if (!target) {
  console.error(
    "usage: node scripts/check-universal-vsix.mjs <path-to-universal.vsix>",
  );
  process.exit(1);
}

let entries;
try {
  entries = listZipEntries(readFileSync(target));
} catch (error) {
  console.error(`${target}: cannot inspect archive: ${error.message}`);
  process.exit(1);
}

// A universal package that lost its manifest is broken for other reasons; say
// so rather than reporting a clean pass on an empty or wrong archive.
if (!entries.includes("extension/package.json")) {
  console.error(
    `${target}: does not look like a built .vsix (missing extension/package.json)`,
  );
  process.exit(1);
}

const violations = [];
for (const entry of entries) {
  for (const { label, test } of FORBIDDEN) {
    if (test(entry)) violations.push(`${label}: ${entry}`);
  }
}

if (violations.length) {
  console.error(
    `${target}: universal package must not contain Windows binaries, found ${violations.length}:`,
  );
  for (const violation of violations) console.error(`  ${violation}`);
  console.error(
    "  Run `pnpm run clean:go-bin` (the universal packaging script does this itself) and repackage.",
  );
  process.exit(1);
}

console.log(
  `universal vsix OK (${entries.length} entries, no go-backend/bin payload)`,
);
