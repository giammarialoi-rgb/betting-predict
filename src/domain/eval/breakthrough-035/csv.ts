export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (q && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else q = !q;
    } else if (c === "," && !q) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !q) {
      if (c === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((x) => x.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export function hasUtcOffset(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return /Z$/i.test(raw.trim()) || /[+-]\d{2}:\d{2}$/.test(raw.trim()) || /[+-]\d{4}$/.test(raw.trim());
}

export function parseIsoMs(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isFinite(t) ? t : null;
}
