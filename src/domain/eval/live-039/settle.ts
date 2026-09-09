import { parseExactUtcMs } from "@/domain/eval/prospective-036/clocks";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { appendSettlement039, type Store039 } from "@/domain/eval/live-039/store";
import { pullScores039, type ScoreRow039 } from "@/domain/eval/live-039/sources";
import type { Outcome039 } from "@/domain/eval/live-039/types";

export function outcomeFromScores039(home: number, away: number): Exclude<Outcome039, "UNSETTLED"> {
  if (home > away) return "HOME";
  if (home < away) return "AWAY";
  return "DRAW";
}

export function assertRevealAfterLock039(locked: boolean): void {
  if (!locked) throw new ExperimentIntegrityError("REVEAL_BEFORE_LOCK");
}

export function applyScores039(
  store: Store039,
  scores: readonly ScoreRow039[],
  settledAt: string,
  resultSource: string,
): { settled: number; unsettled: number } {
  let settled = 0;
  let unsettled = 0;
  for (const ev of store.events) {
    if (!ev.commence_time) continue;
    const kick = parseExactUtcMs(ev.commence_time);
    const now = parseExactUtcMs(settledAt);
    if (kick == null || now == null || now <= kick) continue;
    const existing = store.settlements.find((s) => s.event_id === ev.event_id);
    if (existing && existing.outcome !== "UNSETTLED") continue;
    const hit = scores.find((s) => s.source_event_id === ev.source_event_id && s.completed);
    if (!hit || hit.home_score == null || hit.away_score == null) {
      if (existing) {
        unsettled += 1;
        continue;
      }
      appendSettlement039(store, {
        event_id: ev.event_id,
        result_source: resultSource,
        settled_at: settledAt,
        home_score: null,
        away_score: null,
        outcome: "UNSETTLED",
      });
      unsettled += 1;
      continue;
    }
    const locked = store.decisions.some((d) => d.event_id === ev.event_id);
    if (locked) assertRevealAfterLock039(true);
    appendSettlement039(store, {
      event_id: ev.event_id,
      result_source: resultSource,
      settled_at: settledAt,
      home_score: hit.home_score,
      away_score: hit.away_score,
      outcome: outcomeFromScores039(hit.home_score, hit.away_score),
    });
    settled += 1;
  }
  return { settled, unsettled };
}

export async function revealOnce039(input: {
  store: Store039;
  fetch?: typeof fetch;
  key?: string;
  clock?: { now(): Date };
}): Promise<{ settled: number; unsettled: number; status: string }> {
  const now = (input.clock ?? { now: () => new Date() }).now().toISOString();
  const pull = await pullScores039({ fetch: input.fetch, key: input.key, requestedAtUtc: now });
  if (pull.status !== "ok") return { settled: 0, unsettled: 0, status: pull.status };
  const counts = applyScores039(input.store, pull.scores, now, "the-odds-api-scores");
  return { ...counts, status: "ok" };
}
