import { createHash } from "node:crypto";
import { brier3, logLoss3 } from "@/domain/eval/capital-020/models";
import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import type { Store039 } from "@/domain/eval/live-039/store";
import type { Decision039, Outcome039 } from "@/domain/eval/live-039/types";

export type ScoredRow041 = {
  event_id: string;
  kickoff: string;
  actual: 0 | 1 | 2;
  market: [number, number, number];
};

function outcomeIdx(o: Exclude<Outcome039, "UNSETTLED">): 0 | 1 | 2 {
  if (o === "HOME") return 0;
  if (o === "DRAW") return 1;
  return 2;
}

export function buildScoredRows041(store: Store039): ScoredRow041[] {
  const rows: ScoredRow041[] = [];
  for (const s of store.settlements) {
    if (s.outcome === "UNSETTLED") continue;
    const dec = store.decisions.find((d) => d.event_id === s.event_id);
    const ev = store.events.find((e) => e.event_id === s.event_id);
    if (!dec || !ev?.commence_time) continue;
    rows.push({
      event_id: s.event_id,
      kickoff: ev.commence_time,
      actual: outcomeIdx(s.outcome),
      market: [dec.home_devig, dec.draw_devig, dec.away_devig],
    });
  }
  return rows.sort((a, b) => (parseExactUtcMs(a.kickoff)! - parseExactUtcMs(b.kickoff)!));
}

export function temporalSplit041(rows: ScoredRow041[]): {
  train: ScoredRow041[];
  val: ScoredRow041[];
  test: ScoredRow041[];
  holdout: ScoredRow041[];
  holdout2020Plus: ScoredRow041[];
} {
  const n = rows.length;
  if (n < 100) {
    return { train: [], val: [], test: [], holdout: [], holdout2020Plus: [] };
  }
  const trainN = Math.floor(n * 0.5);
  const valN = Math.floor(n * 0.2);
  const testN = Math.floor(n * 0.15);
  const train = rows.slice(0, trainN);
  const val = rows.slice(trainN, trainN + valN);
  const test = rows.slice(trainN + valN, trainN + valN + testN);
  const holdout = rows.slice(trainN + valN + testN);
  const holdout2020Plus = holdout.filter((r) => new Date(parseExactUtcMs(r.kickoff)!).getUTCFullYear() >= 2020);
  return { train, val, test, holdout, holdout2020Plus };
}

export function meanBrierLogLoss041(rows: ScoredRow041[]): { brier: number | null; logloss: number | null; n: number } {
  if (!rows.length) return { brier: null, logloss: null, n: 0 };
  let b = 0;
  let l = 0;
  for (const r of rows) {
    b += brier3(r.market, r.actual);
    l += logLoss3(r.market, r.actual);
  }
  return { brier: b / rows.length, logloss: l / rows.length, n: rows.length };
}

export function corpusFingerprint041(store: Store039): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        events: store.events.map((e) => [e.event_id, e.commence_time]),
        decisions: store.decisions.map((d) => [d.decision_id, d.decision_context_hash]),
        settlements: store.settlements
          .filter((s) => s.outcome !== "UNSETTLED")
          .map((s) => [s.event_id, s.outcome, s.home_score, s.away_score]),
        quotes: store.quotes.length,
      }),
    )
    .digest("hex");
}

export function assertDecisionIsolated041(dec: Decision039): void {
  const keys = Object.keys(dec);
  for (const bad of ["home_score", "away_score", "FT", "HT", "settled_at", "outcome"]) {
    if (keys.includes(bad)) throw new Error(`leak ${bad}`);
  }
}
