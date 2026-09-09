import { normalizeProb3 } from "@/domain/eval/predictive-intelligence/models/normalize-probs";
import type { PiMatchRow, PiOddsTriple, PiProb3 } from "@/domain/eval/predictive-intelligence/types";

function devig(t: PiOddsTriple): PiProb3 | null {
  if (t.home == null || t.draw == null || t.away == null) return null;
  if (t.home <= 1 || t.draw <= 1 || t.away <= 1) return null;
  const ih = 1 / t.home;
  const id = 1 / t.draw;
  const ia = 1 / t.away;
  return normalizeProb3(ih, id, ia);
}

/** Market baseline from OPEN / DATE_ONLY odds only — never closing. */
export function marketBaselineFromOpenOdds(m: PiMatchRow): PiProb3 | null {
  return (
    devig(m.odds_open.B365) ??
    devig(m.odds_open.PS) ??
    devig(m.odds_open.Avg) ??
    null
  );
}

/** CLV helper — closing for evaluation only, never training features. */
export function researchCloseMarket(m: PiMatchRow): PiProb3 | null {
  return devig(m.research_odds_close.B365C) ?? devig(m.research_odds_close.PSC) ?? null;
}
