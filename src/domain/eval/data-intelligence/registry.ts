import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SourceEntry } from "@/domain/eval/data-intelligence/types";

/** Honest static registry — scrape sources always on for ordinary GET (never MODEL). */
export function buildSourceRegistry(input?: {
  footballDataRows?: number;
  clubeloCachePresent?: boolean;
  oddsApiConfigured?: boolean;
  apiSportsConfigured?: boolean;
  openMeteoOk?: boolean;
  /** Ignored — scrape lane is always on. Kept for call-site compatibility. */
  testScrapeEnabled?: boolean;
}): SourceEntry[] {
  const fdRows = input?.footballDataRows ?? 0;
  const meteo = input?.openMeteoOk !== false;
  void input?.clubeloCachePresent;
  void input?.oddsApiConfigured;
  void input?.apiSportsConfigured;

  return [
    {
      id: "football-data-co-uk",
      title: "Football-Data.co.uk",
      priority: "high",
      role: "MODEL_FEATURE",
      temporal_precision: "DATE_ONLY",
      status: fdRows >= 500 ? "ACTIVE" : fdRows > 0 ? "TEMPORALLY_CAUTIOUS" : "UNAVAILABLE",
      reason:
        fdRows >= 500
          ? `PI historical rows=${fdRows}; result_available_at DATE_ONLY`
          : fdRows > 0
            ? `Dataset present but below ACTIVE threshold (${fdRows})`
            : "No matches.jsonl imported",
      enters_independent_model: true,
      legal_status: "public",
    },
    {
      id: "open-meteo",
      title: "Open-Meteo",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "STRICT_AS_OF",
      status: meteo ? "ACTIVE" : "UNAVAILABLE",
      reason: "Official archive API; CONTEXT weather; not MODEL input in this phase",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "openligadb",
      title: "OpenLigaDB",
      priority: "high",
      role: "CONTEXT",
      temporal_precision: "STRICT_AS_OF",
      status: "FOUNDATION",
      reason: "API gratuita tedesca (Bundesliga / 2.BL / 3.Liga / DFB). Identità fail-closed. Non inventa partite.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "thesportsdb",
      title: "TheSportsDB",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "Chiave test gratuita. EPL/Serie A/La Liga/Bundesliga/Ligue 1. Solo meta/contesto.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "statsbomb",
      title: "StatsBomb Open Data",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "TEMPORALLY_CAUTIOUS",
      reason: "Pacchetti storici open. Non live. available_at sconosciuto → escluso dal modello pre-match.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "espn",
      title: "ESPN Scoreboard (non ufficiale)",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "STRICT_AS_OF",
      status: "RESEARCH_TEST",
      reason: "JSON site.api non ufficiale/instabile. Consentito solo dopo HTTP 200 senza CAPTCHA. Nessun bypass.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "openfootball",
      title: "OpenFootball football.json",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "DATE_ONLY",
      status: "TEMPORALLY_CAUTIOUS",
      reason: "JSON stagionale GitHub. Storico DATE_ONLY. Non live. Non entra nel modello indipendente.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "bbc-sport",
      title: "BBC Sport Calcio RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico. Solo contesto; nessun infortunio inventato dai titoli.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "guardian-football",
      title: "The Guardian Football RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico. Solo contesto; nessun infortunio inventato dai titoli.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "gazzetta",
      title: "Gazzetta dello Sport RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico. Solo contesto; nessun infortunio inventato dai titoli.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "ansa",
      title: "ANSA Calcio RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico ANSA calcio. Solo contesto; nessun infortunio inventato dai titoli.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "understat",
      title: "Understat",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "getLeagueData pubblico (XHR). xG L5 solo contesto; available_at sconosciuto.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "sky-sports",
      title: "Sky Sports Calcio RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico Sky Sports UK. Solo contesto; nessun infortunio inventato dai titoli.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "espn-soccer-news",
      title: "ESPN Soccer News RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico ESPN soccer. Solo contesto.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "corriere-sport",
      title: "Corriere dello Sport RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico Corriere dello Sport. Solo contesto.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "tuttosport",
      title: "Tuttosport RSS",
      priority: "low",
      role: "CONTEXT",
      temporal_precision: "UNKNOWN",
      status: "FOUNDATION",
      reason: "RSS pubblico Tuttosport. Solo contesto.",
      enters_independent_model: false,
      legal_status: "public",
    },
    {
      id: "club-football-match-data",
      title: "Club-Football-Match-Data",
      priority: "medium",
      role: "CONTEXT",
      temporal_precision: "DATE_ONLY",
      status: "TEMPORALLY_CAUTIOUS",
      reason: "Corpus locale CACHE_ONLY. DATE_ONLY. Quote solo mercato/UI. NO_DATA se il clone manca.",
      enters_independent_model: false,
      legal_status: "public",
    },
  ];
}

export function findClubEloCachePaths(cwd = process.cwd()): string[] {
  const candidates = [
    join(cwd, "data", "clubelo"),
    join(cwd, "artifacts", "clubelo"),
    join(cwd, "audit", "external", "task-044", "predictive-intelligence", "clubelo"),
  ];
  const out: string[] = [];
  for (const dir of candidates) {
    if (!existsSync(dir)) continue;
    try {
      for (const name of readdirSync(dir)) {
        if (name.toLowerCase().endsWith(".csv")) out.push(join(dir, name));
      }
    } catch {
      /* ignore */
    }
  }
  const single = join(cwd, "data", "clubelo.csv");
  if (existsSync(single)) out.push(single);
  return out;
}

export function clubEloCachePresent(cwd = process.cwd()): boolean {
  return findClubEloCachePaths(cwd).length > 0;
}
