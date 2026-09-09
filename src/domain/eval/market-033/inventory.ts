import { createHash } from "node:crypto";
import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { InventoryFile033 } from "@/domain/eval/market-033/types";

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  ".git",
  "terminals",
  "agent-transcripts",
]);

const EXT = new Set([
  ".csv",
  ".gz",
  ".zip",
  ".bz2",
  ".json",
  ".ndjson",
  ".txt",
  ".sql",
  ".parquet",
  ".xlsx",
  ".xls",
]);

function walk(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (SKIP_DIR.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.isFile()) {
      const lower = e.name.toLowerCase();
      const dot = lower.lastIndexOf(".");
      const ext = dot >= 0 ? lower.slice(dot) : "";
      if (EXT.has(ext) || lower.endsWith(".csv.gz")) out.push(p);
    }
  }
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const s = createReadStream(path);
    s.on("data", (c) => hash.update(c));
    s.on("end", () => resolve());
    s.on("error", reject);
  });
  return hash.digest("hex");
}

export async function inventoryFilesystem033(input: {
  root?: string;
  hashMaxBytes: number;
}): Promise<{ files: InventoryFile033[]; roots_missing: string[] }> {
  const root = input.root ?? process.cwd();
  const roots = ["artifacts", "audit", "data", "datasets", "downloads", "external", "tmp", "cache", "docs"];
  const missing: string[] = [];
  const paths: string[] = [];
  for (const r of roots) {
    const p = join(root, r);
    if (!existsSync(p)) missing.push(r);
    else walk(p, paths);
  }
  paths.sort();
  const files: InventoryFile033[] = [];
  for (const p of paths) {
    const st = statSync(p);
    const hashed = st.size <= input.hashMaxBytes;
    files.push({
      path: relative(root, p).replaceAll("\\", "/"),
      bytes: st.size,
      sha256: hashed ? await sha256File(p) : null,
      hashed,
    });
  }
  return { files, roots_missing: missing };
}
