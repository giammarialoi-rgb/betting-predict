/**
 * Free-source settlement — OpenLigaDB finished scores + ESPN completed when available.
 * Never invents scores. Temporal firewall: results never enter pre-match MODEL.
 */
import { join } from "node:path";
import {
  ESPN_SCOREBOARDS,
  OPENLIGA_LEAGUES,
  espnScoreboardUrl,
  openLigaMatchUrl,
} from "@/domain/eval/acquisition-engine/catalog";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { parseEspnScoreboard } from "@/domain/eval/acquisition-engine/sources/espn";
import {
  parseOpenLigaMatches,
  type OpenLigaMatch,
} from "@/domain/eval/acquisition-engine/sources/openligadb";
import { matchEventPair, pickUniqueDatedPair } from "@/domain/eval/data-intelligence/research/identity-match";
import { ensurePermanentDirs044, permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  appendAutopsy044,
  appendJournal044,
  appendJsonl044,
  appendLearning044,
  appendSettlement044,
  loadModelRegistry044,
  loadStore044,
} from "@/domain/eval/permanent-044/store";
import type { PermanentSettlement044 } from "@/domain/eval/permanent-044/types";
import {
  appendLearningCase044,
  expandedAutopsy044,
  learningCaseFromExpanded044,
  learningFromAutopsy044,
} from "@/domain/eval/permanent-044/learning-expanded";
import { upsertLiveState, upsertPredictionCase, upsertResearchJob } from "@/domain/eval/mega-pipeline/neon-runtime";
import type { FreeSettleResult } from "@/domain/eval/mega-pipeline/types";
import { settleOpenPredictionCases } from "@/domain/eval/mega-pipeline/prediction-cases";

function kickoffIso(m: OpenLigaMatch): string | null {
  const raw = m.matchDateTimeUTC || m.matchDateTime;
  if (!raw) return null;
  const t = Date.parse(raw.endsWith("Z") || raw.includes("+") ? raw : `${raw}Z`);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function finalScore(m: OpenLigaMatch): { home: number; away: number } | null {
  const results = m.matchResults ?? [];
  const end = results.find((r) => r.resultTypeID === 2) ?? results[results.length - 1];
  if (!end || typeof end.pointsTeam1 !== "number" || typeof end.pointsTeam2 !== "number") return null;
  return { home: end.pointsTeam1, away: end.pointsTeam2 };
}

function htScore(m: OpenLigaMatch): string | null {
  const ht = (m.matchResults ?? []).find((r) => r.resultTypeID === 1);
  if (!ht || typeof ht.pointsTeam1 !== "number" || typeof ht.pointsTeam2 !== "number") return null;
  return `${ht.pointsTeam1}-${ht.pointsTeam2}`;
}

export async function runFreeSettle(input: {
  labBRoot?: string;
  nowIso?: string;
  fetchImpl?: typeof fetch;
  persistNeon?: boolean;
} = {}): Promise<FreeSettleResult> {
  const labB = input.labBRoot ?? permanentRoot044();
  ensurePermanentDirs044(labB);
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const store = loadStore044(labB);
  const reg = loadModelRegistry044(labB);

  const needSettle = store.events.filter((e) => {
    if (!e.kickoff_utc) return false;
    if (store.settlementEventIds.has(e.event_id)) return false;
    const k = Date.parse(e.kickoff_utc);
    return Number.isFinite(k) && k < nowMs;
  });

  const by_source: Record<string, number> = {};
  const sources_tried: string[] = [];
  let settled = 0;
  let prediction_cases_updated = 0;
  let learning_cases = 0;

  // --- OpenLigaDB ---
  sources_tried.push("openligadb");
  const olMatches: OpenLigaMatch[] = [];
  let olUrl = openLigaMatchUrl("bl1");
  for (const league of OPENLIGA_LEAGUES) {
    const url = openLigaMatchUrl(league.shortcut);
    const got = await acquisitionGet({
      url,
      sourceId: "openligadb",
      minIntervalMs: input.fetchImpl ? 0 : 800,
      fetchImpl: input.fetchImpl,
      maxRetries: 1,
    });
    if (!got.ok) continue;
    olUrl = got.url;
    olMatches.push(...parseOpenLigaMatches(got.text).filter((m) => m.matchIsFinished));
  }

  for (const ev of needSettle) {
    const hits = olMatches.filter((m) => {
      const h = m.team1?.teamName;
      const a = m.team2?.teamName;
      if (!h || !a) return false;
      return matchEventPair(ev.home_or_a, ev.away_or_b, h, a).matched;
    });
    const picked = pickUniqueDatedPair(hits, (row) => kickoffIso(row), ev.kickoff_utc);
    if (!picked) continue;
    const score = finalScore(picked);
    if (!score) continue;

    const resultLabel = `${score.home}-${score.away}`;
    const oneX2 = score.home > score.away ? "HOME" : score.home < score.away ? "AWAY" : "DRAW";
    const sett: PermanentSettlement044 = {
      event_id: ev.event_id,
      result: `${resultLabel}|${oneX2}`,
      market: "1X2",
      selection: null,
      outcome: "UNSETTLED",
      settled_at: nowIso,
      source: "openligadb",
      source_confidence: 0.85,
    };
    if (appendSettlement044(store, sett) !== "ok") continue;
    settled += 1;
    by_source.openligadb = (by_source.openligadb ?? 0) + 1;

    const latestPred = [...store.predictions]
      .filter((p) => p.event_id === ev.event_id)
      .sort((a, b) => b.prediction_seq - a.prediction_seq)[0];
    if (latestPred) {
      const fakeSettlement039 = {
        event_id: ev.event_id,
        result_source: "openligadb",
        settled_at: nowIso,
        home_score: score.home,
        away_score: score.away,
        outcome: oneX2 as "HOME" | "DRAW" | "AWAY",
      };
      const lock = store.locks.find((l) => l.event_id === ev.event_id) ?? null;
      const expanded = expandedAutopsy044({
        prediction: latestPred,
        settlement: fakeSettlement039,
        lockTime: lock?.lock_timestamp ?? null,
      });
      if (appendAutopsy044(store, expanded as never) === "ok") {
        const learn = learningFromAutopsy044(expanded);
        if (learn) appendLearning044(store, learn);
        appendLearningCase044(labB, learningCaseFromExpanded044(expanded, reg.current_version));
        learning_cases += 1;
      }
    }

    const caseUpdates = await settleOpenPredictionCases({
      event_id: ev.event_id,
      home_score: score.home,
      away_score: score.away,
      result_label: resultLabel,
      one_x2: oneX2,
      settled_at: nowIso,
      source: "openligadb",
      persistNeon: input.persistNeon !== false,
    });
    prediction_cases_updated += caseUpdates;

    if (input.persistNeon !== false) {
      await upsertLiveState({
        event_id: ev.event_id,
        status: "FINISHED",
        minute: null,
        home_score: score.home,
        away_score: score.away,
        halftime: htScore(picked),
        fulltime: resultLabel,
        source: "openligadb",
        source_url: olUrl,
        observed_at: nowIso,
      });
      await upsertResearchJob({
        event_id: ev.event_id,
        status: "SETTLED",
        discovered_at: nowIso,
        payload: { result: resultLabel, source: "openligadb" },
      });
    }

    appendJsonl044(join(labB, "source-health.jsonl"), {
      kind: "FREE_SETTLE",
      at: nowIso,
      event_id: ev.event_id,
      source: "openligadb",
      result: resultLabel,
    });
  }

  // --- ESPN fallback for remaining unsettled (if not blocked) ---
  sources_tried.push("espn");
  const stillNeed = needSettle.filter((e) => !store.settlementEventIds.has(e.event_id));
  if (stillNeed.length) {
    for (const board of ESPN_SCOREBOARDS.slice(0, 6)) {
      const got = await acquisitionGet({
        url: espnScoreboardUrl(board),
        sourceId: "espn",
        minIntervalMs: input.fetchImpl ? 0 : 1_000,
        fetchImpl: input.fetchImpl,
        maxRetries: 0,
      });
      if (!got.ok || got.status === 403) continue;
      const events = parseEspnScoreboard(got.text, board.slug).filter((e) => e.completed);
      for (const ev of stillNeed) {
        if (store.settlementEventIds.has(ev.event_id)) continue;
        const hits = events.filter(
          (e) => e.home && e.away && matchEventPair(ev.home_or_a, ev.away_or_b, e.home, e.away).matched,
        );
        if (hits.length !== 1) continue;
        // ESPN parse does not always expose scores — skip inventing
        // Only mark FINISHED live state without settlement if score unknown
        if (input.persistNeon !== false) {
          await upsertLiveState({
            event_id: ev.event_id,
            status: "FINISHED",
            minute: null,
            home_score: null,
            away_score: null,
            halftime: null,
            fulltime: null,
            source: "espn",
            source_url: got.url,
            observed_at: nowIso,
            payload: { note: "completed_flag_without_score" },
          });
        }
      }
    }
  }

  appendJournal044(labB, {
    kind: "FREE_SETTLE",
    at: nowIso,
    settled,
    candidates: needSettle.length,
    by_source,
  });

  return {
    sources_tried,
    candidates: needSettle.length,
    settled,
    prediction_cases_updated,
    learning_cases,
    by_source,
    unresolved: Math.max(0, needSettle.length - settled),
  };
}

/** Update live states for in-play / upcoming OpenLigaDB matches. */
export async function runFreeLiveMonitor(input: {
  labBRoot?: string;
  nowIso?: string;
  fetchImpl?: typeof fetch;
  persistNeon?: boolean;
} = {}): Promise<{ updated: number; finished: number; live: number }> {
  const labB = input.labBRoot ?? permanentRoot044();
  const nowIso = input.nowIso ?? new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const store = loadStore044(labB);
  let updated = 0;
  let finished = 0;
  let live = 0;

  const matches: OpenLigaMatch[] = [];
  let url = openLigaMatchUrl("bl1");
  for (const league of OPENLIGA_LEAGUES) {
    const got = await acquisitionGet({
      url: openLigaMatchUrl(league.shortcut),
      sourceId: "openligadb",
      minIntervalMs: input.fetchImpl ? 0 : 800,
      fetchImpl: input.fetchImpl,
      maxRetries: 1,
    });
    if (!got.ok) continue;
    url = got.url;
    matches.push(...parseOpenLigaMatches(got.text));
  }

  for (const ev of store.events) {
    if (!ev.kickoff_utc) continue;
    const k = Date.parse(ev.kickoff_utc);
    if (!Number.isFinite(k)) continue;
    // Window: from kickoff-15m to kickoff+3h or finished
    if (k > nowMs + 15 * 60_000) continue;
    if (k < nowMs - 4 * 3600_000 && store.settlementEventIds.has(ev.event_id)) continue;

    const hits = matches.filter((m) => {
      const h = m.team1?.teamName;
      const a = m.team2?.teamName;
      if (!h || !a) return false;
      return matchEventPair(ev.home_or_a, ev.away_or_b, h, a).matched;
    });
    const picked = pickUniqueDatedPair(hits, (row) => kickoffIso(row), ev.kickoff_utc);
    if (!picked) continue;
    const score = finalScore(picked);
    const isFinished = Boolean(picked.matchIsFinished);
    const status = isFinished ? "FINISHED" : k <= nowMs ? "LIVE" : "SCHEDULED";
    if (status === "LIVE") live += 1;
    if (status === "FINISHED") finished += 1;

    if (input.persistNeon !== false) {
      await upsertLiveState({
        event_id: ev.event_id,
        status,
        minute: null,
        home_score: score?.home ?? null,
        away_score: score?.away ?? null,
        halftime: htScore(picked),
        fulltime: isFinished && score ? `${score.home}-${score.away}` : null,
        source: "openligadb",
        source_url: url,
        observed_at: nowIso,
      });
      if (status === "LIVE" || status === "FINISHED") {
        await upsertResearchJob({
          event_id: ev.event_id,
          status: status === "FINISHED" ? "FINISHED" : "LIVE",
          discovered_at: nowIso,
        });
        for (const pred of store.predictions.filter((p) => p.event_id === ev.event_id)) {
          await upsertPredictionCase({
            prediction_id: pred.prediction_id,
            event_id: pred.event_id,
            market: pred.market,
            selection: pred.selection ?? "UNKNOWN",
            prediction_probability:
              pred.probability_model && typeof pred.probability_model === "object"
                ? Number(
                    pred.probability_model[pred.selection ?? ""] ??
                      Object.values(pred.probability_model)[0] ??
                      NaN,
                  ) || null
                : null,
            odds_at_prediction: null,
            model_version: pred.model_version,
            prediction_timestamp: pred.timestamp,
            as_of: pred.timestamp,
            status: status === "FINISHED" ? "OPEN" : "LIVE",
          });
        }
      }
    }
    updated += 1;
  }

  return { updated, finished, live };
}
