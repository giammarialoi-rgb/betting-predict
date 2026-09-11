/**
 * Aggiorna eventi: attach cache + recomputa analisi light dai dati già presenti.
 * Il cervello completo (Lab B) non gira su Vercel — non fingiamo ONLINE.
 */
import { runAcquisitionJob } from "@/domain/eval/acquisition-engine/engine";
import { labEventsForAcquisition } from "@/domain/eval/acquisition-engine/lab-events";
import type { AcquisitionJob } from "@/domain/eval/acquisition-engine/types";
import { listCalendarEvents, todayCalendarDay } from "@/domain/eval/betmind-runtime/calendar";
import { loadBoardEventsFromNeon } from "@/domain/eval/betmind-runtime/remote-status";
import { localLabStorePresent } from "@/domain/eval/betmind-runtime/production-mirror";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { computeLightAnalysis, lightHasEstimableMarket } from "@/domain/eval/light-analysis/compute";
import { loadLightHistory } from "@/domain/eval/light-analysis/fetch-history";
import { persistLightAnalysis } from "@/domain/eval/light-analysis/persist";
import type { RefreshEventsReport } from "@/domain/eval/light-analysis/types";

const REFRESH_ACQUIRE_MS = 14_000;

const REFRESH_JOBS: AcquisitionJob[] = [
  {
    source_id: "espn",
    kind: "fixtures",
    url: "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard",
    label: "espn:scoreboard",
  },
  {
    source_id: "openligadb",
    kind: "fixtures",
    url: "https://api.openligadb.de/getmatchdata/bl1",
    label: "openligadb:bl1",
  },
  {
    source_id: "thesportsdb",
    kind: "fixtures",
    url: "https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=TODAY&s=Soccer",
    label: "thesportsdb:eventsday",
  },
  {
    source_id: "club-football-match-data",
    kind: "research_dataset",
    url: "https://github.com/club-football-match-data",
    label: "club-football-match-data:local",
  },
];

function text(v: unknown): string {
  return String(v ?? "").trim();
}

function splitLabel(label: string): { home: string; away: string } {
  const parts = label.split(/\s+vs\s+/i);
  if (parts.length >= 2) return { home: parts[0]!.trim(), away: parts.slice(1).join(" vs ").trim() };
  return { home: "", away: "" };
}

export type TodayEventLite = {
  event_id: string;
  home: string;
  away: string;
  competition: string | null;
  kickoff_utc: string | null;
  sport: string;
  status: string | null;
  score_home: number | null;
  score_away: number | null;
  strong_available: boolean;
};

function scoreFromResult(result: unknown): { home: number | null; away: number | null } {
  const m = String(result ?? "").match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!m) return { home: null, away: null };
  return { home: Number(m[1]), away: Number(m[2]) };
}

export function todayEventFromBoard(row: Record<string, unknown>): TodayEventLite | null {
  const event_id = text(row.event_id);
  if (!event_id) return null;
  const fromLabel = splitLabel(text(row.label));
  const home = text(row.home_or_a) || fromLabel.home;
  const away = text(row.away_or_b) || fromLabel.away;
  if (!home || !away) return null;
  const score = scoreFromResult(row.result ?? row.score);
  const model = row.probability_model;
  const strong_available = Boolean(
    model && typeof model === "object" && Object.keys(model as object).length > 0,
  );
  return {
    event_id,
    home,
    away,
    competition: text(row.competition) || null,
    kickoff_utc: text(row.kickoff_utc) || null,
    sport: text(row.sport) || "FOOTBALL",
    status: text(row.status) || null,
    score_home: typeof row.score_home === "number" ? row.score_home : score.home,
    score_away: typeof row.score_away === "number" ? row.score_away : score.away,
    strong_available,
  };
}

export async function listTodayEvents(input?: {
  date?: string;
  cwd?: string;
}): Promise<TodayEventLite[]> {
  const date = input?.date ?? todayCalendarDay();
  const root = permanentRoot044();
  const byId = new Map<string, TodayEventLite>();

  if (localLabStorePresent(root)) {
    const cal = listCalendarEvents({ root, date, sport: "ALL" });
    for (const ev of cal.events as Array<Record<string, unknown>>) {
      const lite = todayEventFromBoard(ev);
      if (lite) byId.set(lite.event_id, lite);
    }
  }

  const board = await loadBoardEventsFromNeon({ date, sport: "ALL" });
  for (const ev of (board?.events ?? []) as Array<Record<string, unknown>>) {
    const lite = todayEventFromBoard(ev);
    if (!lite) continue;
    const prev = byId.get(lite.event_id);
    if (!prev) byId.set(lite.event_id, lite);
    else if (lite.strong_available && !prev.strong_available) byId.set(lite.event_id, { ...prev, strong_available: true });
  }

  return [...byId.values()];
}

async function boundedAcquisition(nowIso: string, cwd: string): Promise<{
  attempted: boolean;
  timed_out: boolean;
  sources_ok: string[];
  sources_failed: string[];
  note_it: string;
}> {
  const lab = labEventsForAcquisition(40);
  const run = (async () => {
    const ok: string[] = [];
    const failed: string[] = [];
    for (const job of REFRESH_JOBS) {
      try {
        const lane = await runAcquisitionJob(job, {
          nowIso,
          cwd,
          persistNeon: Boolean(process.env.DATABASE_URL),
          persistLabB: lab.persistLabB,
          labBRoot: lab.labBRoot,
          labEvents: lab.labEvents,
          maxRetries: 0,
        });
        if (lane.ok) ok.push(job.source_id);
        else failed.push(job.source_id);
      } catch {
        failed.push(job.source_id);
      }
    }
    return { ok, failed };
  })();

  const raced = await Promise.race([
    run.then((r) => ({ ...r, timed_out: false as const })),
    new Promise<{ ok: string[]; failed: string[]; timed_out: true }>((resolve) => {
      setTimeout(() => resolve({ ok: [], failed: [], timed_out: true }), REFRESH_ACQUIRE_MS);
    }),
  ]);

  if (raced.timed_out) {
    return {
      attempted: true,
      timed_out: true,
      sources_ok: [],
      sources_failed: [],
      note_it: "Calendario: aggiornamento fonti interrotto per tempo. Lo storico risultati è a parte.",
    };
  }
  return {
    attempted: true,
    timed_out: false,
    sources_ok: raced.ok,
    sources_failed: raced.failed,
    note_it:
      raced.ok.length > 0
        ? "Calendario aggiornato."
        : "Calendario invariato. Analisi ricalcolata dallo storico risultati.",
  };
}

export async function refreshTodayEvents(input?: {
  date?: string;
  cwd?: string;
  acquire?: boolean;
  invalidateSnapshot?: () => void;
}): Promise<RefreshEventsReport> {
  const cwd = input?.cwd ?? process.cwd();
  const date = input?.date ?? todayCalendarDay();
  const nowIso = new Date().toISOString();
  const errors: string[] = [];

  let acquisition: RefreshEventsReport["acquisition"] = {
    attempted: false,
    timed_out: false,
    sources_ok: [],
    sources_failed: [],
    note_it: "Solo ricalcolo analisi.",
  };

  if (input?.acquire !== false) {
    try {
      acquisition = await boundedAcquisition(nowIso, cwd);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(msg);
      acquisition = {
        attempted: true,
        timed_out: false,
        sources_ok: [],
        sources_failed: [],
        note_it: `Calendario non aggiornato (${msg}).`,
      };
    }
  }

  const events = await listTodayEvents({ date, cwd });
  const historyReport = await loadLightHistory({
    cwd,
    force: input?.acquire !== false,
    dayIso: date,
    persistNeon: Boolean(process.env.DATABASE_URL),
  });
  const history = historyReport.rows;
  let light_ok = 0;
  let light_insufficient = 0;
  let attach_hits = 0;
  const event_ids: string[] = [];

  for (const ev of events) {
    try {
      const analysis = computeLightAnalysis({
        event_id: ev.event_id,
        home: ev.home,
        away: ev.away,
        competition: ev.competition,
        kickoff_utc: ev.kickoff_utc,
        sport: ev.sport,
        status: ev.status,
        score_home: ev.score_home,
        score_away: ev.score_away,
        cwd,
        nowIso,
        history,
        strong_available: ev.strong_available,
        skipAttach: true,
      });
      attach_hits += analysis.attach.filter((a) => a.ok).length;
      if (lightHasEstimableMarket(analysis) || analysis.strong_available) light_ok += 1;
      else light_insufficient += 1;
      await persistLightAnalysis(analysis, cwd);
      event_ids.push(ev.event_id);
    } catch (e) {
      errors.push(`${ev.event_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  let snapshot_invalidated = false;
  try {
    input?.invalidateSnapshot?.();
    snapshot_invalidated = true;
  } catch {
    snapshot_invalidated = false;
  }

  const progress_it =
    events.length === 0
      ? "Nessuna partita di oggi in elenco."
      : `Aggiornate ${event_ids.length} partite · ${light_ok} con percentuali.`;

  return {
    ok: errors.length === 0,
    at: nowIso,
    date,
    progress_it,
    events_seen: events.length,
    light_ok,
    light_insufficient,
    attach_hits,
    acquisition,
    history: {
      rows: historyReport.rows.length,
      cache: historyReport.cache,
      from_cache: historyReport.from_cache,
      note_it: historyReport.note_it,
    },
    brain_ran: false,
    snapshot_invalidated,
    errors,
    event_ids,
  };
}
