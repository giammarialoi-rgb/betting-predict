/**
 * Test-only helpers — keep settlement logic shared without exporting internals.
 */
import { createHash } from "node:crypto";
import { canonicalEventId044 } from "@/domain/eval/permanent-044/normalize";
import { sportKind044 } from "@/domain/eval/permanent-044/config";
import type { FreeFixtureCandidate } from "@/domain/eval/mega-pipeline/types";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { PredictionCaseStatus } from "@/domain/eval/mega-pipeline/types";

function sha(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function candidateToPermanentHarness(
  c: FreeFixtureCandidate,
  nowIso = "2026-09-11T12:00:00.000Z",
): PermanentEvent044 | null {
  if (!c.home || !c.away) return null;
  const sport = sportKind044(c.sport);
  const kickOk = Boolean(c.kickoff_utc && Number.isFinite(Date.parse(c.kickoff_utc)));
  const canonical = canonicalEventId044({
    sport,
    competition: c.competition,
    home: c.home,
    away: c.away,
    kickoff_utc: kickOk ? c.kickoff_utc : null,
  });
  const event_id = `mega_${sha(`${c.source}|${c.source_event_id}`).slice(0, 20)}`;
  const semantic =
    c.kickoff_precision === "exact" && kickOk
      ? "STRICT"
      : c.kickoff_precision === "date_only"
        ? "RESEARCH"
        : "PARTIAL";
  return {
    event_id,
    canonical_event_id: canonical,
    source: c.source,
    source_event_id: c.source_event_id,
    source_event_ids: [c.source_event_id],
    sport,
    competition: c.competition,
    country: null,
    home_or_a: c.home,
    away_or_b: c.away,
    kickoff_utc: kickOk ? c.kickoff_utc : null,
    collected_at_utc: nowIso,
    available_at_utc: null,
    semantic_level: semantic,
    data_quality: semantic === "STRICT" ? 0.7 : 0.45,
    fingerprint: sha(["event", c.source, c.source_event_id, canonical].join("|")),
    status: kickOk ? "OK" : "INVALID_KICKOFF",
    origin: "DISCOVERED_LIVE",
    first_seen_at: nowIso,
    last_seen_at: nowIso,
    canonicalization_status: "MATCH_EXACT",
  };
}

/** Mirror of settleMarket in prediction-cases.ts for unit tests. */
export function settleMarketForTest(
  market: string,
  selection: string,
  home: number,
  away: number,
): PredictionCaseStatus | null {
  const m = market.toUpperCase();
  const sel = selection.toUpperCase();
  const total = home + away;
  const oneX2 = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";

  if (m === "1X2" || m === "H2H" || m === "MATCH_ODDS") {
    if (sel === oneX2 || sel === (oneX2 === "HOME" ? "1" : oneX2 === "AWAY" ? "2" : "X")) return "WON";
    return "LOST";
  }
  if (m.includes("BTTS") || m === "BOTH_TEAMS_TO_SCORE") {
    const yes = home > 0 && away > 0;
    if (sel === "YES" || sel === "BTTS_YES") return yes ? "WON" : "LOST";
    if (sel === "NO" || sel === "BTTS_NO") return yes ? "LOST" : "WON";
  }
  if (m.includes("OVER") || m.includes("UNDER") || m.includes("TOTALS") || m.includes("OU")) {
    const lineMatch = `${m} ${sel}`.match(/(\d+(?:\.\d+)?)/);
    const line = lineMatch ? Number(lineMatch[1]) : NaN;
    if (!Number.isFinite(line)) return null;
    const isOver = /OVER|O\s/.test(`${m} ${sel}`);
    const isUnder = /UNDER|U\s/.test(`${m} ${sel}`);
    if (total === line) return "PUSH";
    if (isOver) return total > line ? "WON" : "LOST";
    if (isUnder) return total < line ? "WON" : "LOST";
  }
  if (m === "DNB" || m === "DRAW_NO_BET") {
    if (oneX2 === "DRAW") return "PUSH";
    if (sel === "HOME" || sel === "1") return oneX2 === "HOME" ? "WON" : "LOST";
    if (sel === "AWAY" || sel === "2") return oneX2 === "AWAY" ? "WON" : "LOST";
  }
  return null;
}
