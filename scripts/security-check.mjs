import { readdir, readFile, stat } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "dist",
  "build",
  "artifacts",
  "cache",
  "typechain-types",
  "docs",
  "examples",
]);

const PATTERNS = [/PRIVATE_KEY/, /0x[0-9a-fA-F]{64}/];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024;

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      files.push(...(await walk(fullPath)));
      continue;
    }
    files.push(fullPath);
  }
  return files;
}

function isExcludedFile(filePath) {
  const normalized = filePath.replaceAll(path.sep, "/");
  if (normalized.includes("/docs/")) return true;
  if (normalized.includes("/examples/")) return true;
  if (normalized.endsWith(".md")) return true;
  return false;
}

async function scanFile(filePath) {
  if (isExcludedFile(filePath)) return [];
  const info = await stat(filePath);
  if (!info.isFile() || info.size > MAX_FILE_SIZE_BYTES) return [];
  const content = await readFile(filePath, "utf8");
  const matches = [];
  for (const pattern of PATTERNS) {
    if (pattern.test(content)) {
      matches.push(pattern);
    }
  }
  return matches.length > 0 ? matches : [];
}

const files = await walk(ROOT);
const findings = [];
for (const file of files) {
  const matches = await scanFile(file);
  if (matches.length > 0) {
    findings.push({ file, matches: matches.map((pattern) => pattern.toString()) });
  }
}

if (findings.length > 0) {
  console.error("Potential secret patterns found:");
  for (const finding of findings) {
    console.error(`- ${finding.file} => ${finding.matches.join(", ")}`);
  }
  process.exit(1);
}

console.log("security-check: ok");
