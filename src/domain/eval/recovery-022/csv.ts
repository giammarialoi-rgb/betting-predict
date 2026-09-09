export function splitCsvLine(line: string): string[] {
  const parts: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') {
      q = !q;
      continue;
    }
    if (ch === "," && !q) {
      parts.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  parts.push(cur);
  return parts;
}

export function parseNumberOrNull(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || t.toLowerCase() === "nan") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
