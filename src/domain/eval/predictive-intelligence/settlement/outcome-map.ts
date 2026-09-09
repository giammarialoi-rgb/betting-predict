/**
 * Map settlement result string + bet selection → won/lost/push for paper P&L.
 * Lab B settlements encode `result` as `H-A|HOME|DRAW|AWAY`.
 */

export function parseSettlementOneX2(result: string | null | undefined): "HOME" | "DRAW" | "AWAY" | null {
  if (!result) return null;
  const parts = result.split("|");
  const tag = (parts[1] ?? "").trim().toUpperCase();
  if (tag === "HOME" || tag === "DRAW" || tag === "AWAY") return tag;
  // fallback scoreline
  const m = (parts[0] ?? result).match(/^(\d+)\s*-\s*(\d+)/);
  if (!m) return null;
  const h = Number(m[1]);
  const a = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(a)) return null;
  if (h > a) return "HOME";
  if (h < a) return "AWAY";
  return "DRAW";
}

export function mapBetOutcome053(input: {
  result: string | null | undefined;
  selection: string | null | undefined;
}): "won" | "lost" | "push" | "void" | "UNSETTLED" {
  const actual = parseSettlementOneX2(input.result);
  if (!actual) return "UNSETTLED";
  const sel = (input.selection ?? "").trim().toUpperCase();
  if (!sel) return "UNSETTLED";
  // Normalize common aliases
  const norm =
    sel === "H" || sel === "1" || sel === "HOME"
      ? "HOME"
      : sel === "D" || sel === "X" || sel === "DRAW"
        ? "DRAW"
        : sel === "A" || sel === "2" || sel === "AWAY"
          ? "AWAY"
          : sel;
  if (norm !== "HOME" && norm !== "DRAW" && norm !== "AWAY") return "void";
  return norm === actual ? "won" : "lost";
}
