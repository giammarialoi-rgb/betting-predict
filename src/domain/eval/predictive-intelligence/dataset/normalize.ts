import {
  parseCsv,
  parseFootballDataCoUkDate,
} from "@/providers/football-data-co-uk/parser";
import { resolveFootballDataCoUkTeamId } from "@/providers/football-data-co-uk/team-aliases";
import type { PiLabel, PiMatchRow, PiOddsTriple } from "@/domain/eval/predictive-intelligence/types";
import { sha256Hex } from "@/domain/eval/predictive-intelligence/config";

function num(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function oddsTriple(h?: string, d?: string, a?: string): PiOddsTriple {
  const home = num(h);
  const draw = num(d);
  const away = num(a);
  return {
    home: home != null && home > 1 ? home : null,
    draw: draw != null && draw > 1 ? draw : null,
    away: away != null && away > 1 ? away : null,
  };
}

function ftrLabel(raw: string, hg: number, ag: number): PiLabel | null {
  const t = raw.trim().toUpperCase();
  if (t === "H") return "HOME";
  if (t === "D") return "DRAW";
  if (t === "A") return "AWAY";
  if (hg > ag) return "HOME";
  if (hg < ag) return "AWAY";
  if (Number.isFinite(hg) && Number.isFinite(ag)) return "DRAW";
  return null;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Build match rows from Football-Data CSV — keeps results even without odds. */
export function normalizeFootballDataCsv(input: {
  csvText: string;
  season: string;
  league: string;
}): { matches: PiMatchRow[]; rejected: number; reasons: Record<string, number> } {
  const table = parseCsv(input.csvText);
  const matches: PiMatchRow[] = [];
  const reasons: Record<string, number> = {};
  let rejected = 0;

  const bump = (r: string) => {
    reasons[r] = (reasons[r] ?? 0) + 1;
  };

  for (const row of table.rows) {
    if (!row.Date && !row.HomeTeam) continue;
    const matchDate = parseFootballDataCoUkDate(row.Date ?? "", input.season);
    if (!matchDate) {
      rejected += 1;
      bump("invalid_date");
      continue;
    }
    const homeRaw = (row.HomeTeam ?? "").trim();
    const awayRaw = (row.AwayTeam ?? "").trim();
    if (!homeRaw || !awayRaw || homeRaw === awayRaw) {
      rejected += 1;
      bump("bad_teams");
      continue;
    }
    const homeId = resolveFootballDataCoUkTeamId(homeRaw) ?? `raw:${homeRaw.toLowerCase()}`;
    const awayId = resolveFootballDataCoUkTeamId(awayRaw) ?? `raw:${awayRaw.toLowerCase()}`;
    const fthg = num(row.FTHG);
    const ftag = num(row.FTAG);
    if (fthg == null || ftag == null) {
      rejected += 1;
      bump("missing_ft_goals");
      continue;
    }
    const ftr = ftrLabel(row.FTR ?? "", fthg, ftag);
    if (!ftr) {
      rejected += 1;
      bump("missing_ftr");
      continue;
    }

    const day = toIsoDate(matchDate);
    let eventTime = `${day}T12:00:00.000Z`;
    const timeRaw = (row.Time ?? "").trim();
    const tm = timeRaw.match(/^(\d{1,2}):(\d{2})$/);
    if (tm) {
      const hh = Number(tm[1]);
      const mm = Number(tm[2]);
      if (hh >= 0 && hh < 24 && mm >= 0 && mm < 60) {
        eventTime = new Date(Date.UTC(matchDate.getUTCFullYear(), matchDate.getUTCMonth(), matchDate.getUTCDate(), hh, mm)).toISOString();
      }
    }

    // DATE_ONLY: result treated available at start of next UTC day (never same-row as features)
    const resultAvailable = new Date(Date.parse(day + "T00:00:00.000Z") + 86400000).toISOString();

    const canonical_id = sha256Hex(
      `fdcuk|${input.league}|${input.season}|${day}|${homeId}|${awayId}`,
    ).slice(0, 32);

    matches.push({
      canonical_id,
      source: "football-data-co-uk",
      season: input.season,
      league: input.league,
      match_date: day,
      event_time: eventTime,
      home_team: homeRaw,
      away_team: awayRaw,
      home_team_id: homeId,
      away_team_id: awayId,
      fthg,
      ftag,
      ftr,
      hthg: num(row.HTHG),
      htag: num(row.HTAG),
      htr: ftrLabel(row.HTR ?? "", num(row.HTHG) ?? 0, num(row.HTAG) ?? 0),
      hs: num(row.HS),
      as: num(row.AS),
      hst: num(row.HST),
      ast: num(row.AST),
      hc: num(row.HC),
      ac: num(row.AC),
      hy: num(row.HY),
      ay: num(row.AY),
      hr: num(row.HR),
      ar: num(row.AR),
      // Football-Data pubblica xG solo dalla stagione corrente: per lo storico
      // arrivano dall'overlay Understat in build-expanded-dataset.
      hxg: num(row.HxG),
      axg: num(row.AxG),
      odds_open: {
        B365: oddsTriple(row.B365H, row.B365D, row.B365A),
        PS: oddsTriple(row.PSH, row.PSD, row.PSA),
        Avg: oddsTriple(row.AvgH, row.AvgD, row.AvgA),
      },
      research_odds_close: {
        B365C: oddsTriple(row.B365CH, row.B365CD, row.B365CA),
        PSC: oddsTriple(row.PSCH, row.PSCD, row.PSCA),
      },
      label_time: resultAvailable,
      result_available_at: resultAvailable,
    });
  }

  return { matches, rejected, reasons };
}
