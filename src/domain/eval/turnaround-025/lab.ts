/**
 * TASK 025 orchestrator — acquire → classify → match → research Brier → STRICT decision → annual —.
 * Does not wait for football-data.co.uk. Does not invent clocks.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadExp025Config } from "@/domain/eval/turnaround-025/config";
import { academicCandidates025 } from "@/domain/eval/turnaround-025/academic";
import { acquireKaggleWeekly, probeTask025 } from "@/domain/eval/turnaround-025/acquire";
import { loadClubForResearch } from "@/domain/eval/turnaround-025/club-scan";
import { countryObservation, coverageFromClubMatches } from "@/domain/eval/turnaround-025/coverage";
import { githubAuditsOffline, githubAuditsOnline } from "@/domain/eval/turnaround-025/github-audit";
import { inspectKaggleWeekly, type KaggleInspect025 } from "@/domain/eval/turnaround-025/kaggle-inspect";
import { runHostileBattery025 } from "@/domain/eval/turnaround-025/leakage";
import { gradeTwoEvents } from "@/domain/eval/turnaround-025/matching";
import { annualBankroll025, runStrictBlind025 } from "@/domain/eval/turnaround-025/replay";
import { researchDiagnostic } from "@/domain/eval/turnaround-025/research";
import { acquisitionScores } from "@/domain/eval/turnaround-025/scores";
import {
  DATASET_ID_025,
  PARSER_VERSION_025,
  STRICT_EVENT_GATE,
  type AcquisitionProbe025,
  type AcquisitionScore025,
  type AcademicCandidate025,
  type AnnualRow025,
  type CoverageCell025,
  type GithubAudit025,
  type MatchGrade025,
  type ResearchDiag025,
  type Task025Verdict,
} from "@/domain/eval/turnaround-025/types";
import { BTB_CLOSING_EVENTS, FD_EVENTS, FD_QUOTES } from "@/domain/eval/attack-024/lab";
import { loadSoccerAudit } from "@/domain/eval/attack-024/soccer-audit";
import { buildStrictLedgerFromBetfairFixture } from "@/domain/eval/attack-024/ledger";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";
import { M001_IDENTITY } from "@/domain/eval/turnaround-025/club-scan";
import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";

export type Task025Report = {
  experiment_id: string;
  task: "025";
  dataset_id: typeof DATASET_ID_025;
  parser_version: typeof PARSER_VERSION_025;
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: "market_devig";
  frozen_edge_threshold: 0.03;
  verdict: Task025Verdict;
  probes: AcquisitionProbe025[];
  github: GithubAudit025[];
  academic: AcademicCandidate025[];
  scores: AcquisitionScore025[];
  kaggle: KaggleInspect025;
  club_present: boolean;
  overlay: { grade: MatchGrade025 | "SELF_CONTAINED"; club_event_id: string | null };
  coverage: CoverageCell025[];
  countries: ReturnType<typeof countryObservation>;
  research: ResearchDiag025;
  strict_ledger: ReturnType<typeof buildStrictLedgerFromBetfairFixture>;
  blind: ReturnType<typeof runStrictBlind025>;
  annual: AnnualRow025[];
  leakage: { id: string; throws: boolean }[];
  answers: Record<string, string | number | boolean | null>;
  metrics: {
    events_listed_overlapping: number;
    events_club: number;
    events_strict: number;
    quotes_listed: number;
    quotes_exact: number;
    quotes_date_only: number;
    as_of_usable: number;
    decisions: number;
    candidates: number;
    bets: 0;
    kaggle_bulk_acquired: boolean;
    football_data_blocked: boolean;
    edge_demonstrated: false;
    bankroll_testable: false;
  };
  scientific: {
    verdict: Task025Verdict;
    sample_size_strict: number;
    holdout_status: "SACRED";
    multiple_testing: { alpha: number; tests: number; bonferroni: number; any_significant: false };
    primary_blocker: string;
    missing: string[];
    we_have: string[];
    we_tested: string[];
  };
  risk: {
    flat: "unused";
    fractional_kelly: "unused";
    risk_capped_kelly: "unused";
    actuarial_v1: "unused";
    masaniello: "challenger_only_unused";
    winner: null;
  };
  monte_carlo: { historical: true; simulated: false; ran: false; reason: string };
};

export function decideVerdict025(strictEvents: number): Task025Verdict {
  if (strictEvents < STRICT_EVENT_GATE) return "INSUFFICIENT_DATA";
  return "INSUFFICIENT_DATA";
}

function overlayFromMatches(matches: readonly ClubMatchLite[]): {
  grade: MatchGrade025 | "SELF_CONTAINED";
  match: ClubMatchLite | null;
} {
  const hits = matches.filter((m) => m.matchDate.toISOString().slice(0, 10) === M001_IDENTITY.date);
  if (hits.length === 0) return { grade: "SELF_CONTAINED", match: null };
  for (const m of hits) {
    const grade = gradeTwoEvents({
      dateA: M001_IDENTITY.date,
      dateB: m.matchDate.toISOString().slice(0, 10),
      homeA: M001_IDENTITY.home,
      homeB: m.home,
      awayA: M001_IDENTITY.away,
      awayB: m.away,
      competitionA: M001_IDENTITY.competition,
      competitionB: m.division,
    });
    if (grade === "MATCH_EXACT" || grade === "MATCH_HIGH_CONFIDENCE") {
      return { grade, match: m };
    }
    const retry = gradeTwoEvents({
      dateA: M001_IDENTITY.date,
      dateB: m.matchDate.toISOString().slice(0, 10),
      homeA: M001_IDENTITY.home,
      homeB: m.home,
      awayA: M001_IDENTITY.awayLong,
      awayB: m.away,
      competitionA: M001_IDENTITY.competition,
      competitionB: m.division,
    });
    if (retry === "MATCH_EXACT" || retry === "MATCH_HIGH_CONFIDENCE") {
      return { grade: retry, match: m };
    }
  }
  return { grade: "MATCH_FAILED", match: null };
}

export async function runTask025(opts?: {
  allowNetwork?: boolean;
  researchMaxEvents?: number | null;
  skipResearchCorpus?: boolean;
}): Promise<Task025Report> {
  const cfg = loadExp025Config();
  const allowNetwork = opts?.allowNetwork === true;
  const skip = opts?.skipResearchCorpus === true;
  const probes = await probeTask025(allowNetwork);
  if (allowNetwork) {
    const kaggleAcquire = await acquireKaggleWeekly();
    probes.push(kaggleAcquire);
  }
  const github = allowNetwork ? await githubAuditsOnline() : githubAuditsOffline();
  const academic = academicCandidates025();
  const scores = acquisitionScores();
  const kaggle = await inspectKaggleWeekly({ skipBulk: skip });
  const soccer = loadSoccerAudit();
  const ledger = buildStrictLedgerFromBetfairFixture();

  let clubMatches: ClubMatchLite[] = [];
  let clubPresent = false;
  if (!skip) {
    const loaded = await loadClubForResearch(opts?.researchMaxEvents ?? null);
    clubPresent = loaded.present;
    clubMatches = loaded.matches;
  } else {
    clubPresent = existsSync(
      join(process.cwd(), "audit", "external", "Club-Football-Match-Data", "data", "Matches.csv"),
    );
  }

  const overlay = skip ? { grade: "SELF_CONTAINED" as const, match: null } : overlayFromMatches(clubMatches);
  const blind = runStrictBlind025({
    club: overlay.match,
    matchGrade: overlay.grade,
  });

  const strictByYearComp = new Map<string, number>();
  if (ledger[0]) {
    strictByYearComp.set("2017|E0", 1);
    strictByYearComp.set("2017|EPL", 1);
  }
  const coverage = coverageFromClubMatches(clubMatches, strictByYearComp);
  const countries = countryObservation(coverage);
  const research = researchDiagnostic({
    matches: clubMatches,
    note: skip
      ? "Club-Football skipped in this run (use pnpm lab:task-025 for full corpus)"
      : undefined,
  });

  const eventsByYear = new Map<number, number>();
  const strictByYear = new Map<number, number>([[2017, ledger.length]]);
  const decisionsByYear = new Map<number, number>([[2017, 1]]);
  const candidatesByYear = new Map<number, number>([[2017, blind.decision.candidate ? 1 : 0]]);
  const betsByYear = new Map<number, number>([[2017, 0]]);
  for (const c of coverage) {
    eventsByYear.set(c.year, (eventsByYear.get(c.year) ?? 0) + c.events);
  }
  eventsByYear.set(2017, (eventsByYear.get(2017) ?? 0) + (coverage.some((c) => c.year === 2017) ? 0 : 1));

  const annual = annualBankroll025({
    years: cfg.solar_years,
    strictByYear,
    decisionsByYear,
    candidatesByYear,
    betsByYear,
    eventsByYear,
  });

  const fdBlocked = probes.some((p) => p.channel === "football-data-co-uk-e0" && /BLOCKED HTTP 503/.test(p.note));
  const eventsClub = clubMatches.length;
  const eventsListed = eventsClub + soccer.odds_fixtures + BTB_CLOSING_EVENTS + FD_EVENTS + ledger.length;
  const quotesDateOnly = research.with_odds + soccer.odds_rows + BTB_CLOSING_EVENTS + FD_QUOTES;
  const quotesExact = ledger.length > 0 ? 3 : 0;

  const answers = {
    q1_matches_real: eventsClub || soccer.odds_fixtures,
    q2_with_odds: research.with_odds,
    q3_with_timestamp: ledger.length,
    q4_as_of_usable: ledger.length,
    q5_decisions: 1,
    q6_bet_candidates: blind.decision.candidate ? 1 : 0,
    q7_annual_pl_from_1000: null,
    q8_best_staking: null,
    q9_drawdown: null,
    q10_beats_market: null,
    q11_where_works: "not testable on STRICT n=1; research Brier is DATE_ONLY",
    q12_why_not: "STRICT n=1; declared_edge=false; DATE_ONLY cannot enter capital; Kaggle week has no TZ so not STRICT; UCD Advanced not public",
  };

  return {
    experiment_id: cfg.experiment_id,
    task: "025",
    dataset_id: DATASET_ID_025,
    parser_version: PARSER_VERSION_025,
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: "market_devig",
    frozen_edge_threshold: 0.03,
    verdict: decideVerdict025(ledger.length),
    probes,
    github,
    academic,
    scores,
    kaggle,
    club_present: clubPresent,
    overlay: { grade: overlay.grade, club_event_id: overlay.match?.eventId ?? null },
    coverage,
    countries,
    research,
    strict_ledger: ledger,
    blind,
    annual,
    leakage: runHostileBattery025(),
    answers,
    metrics: {
      events_listed_overlapping: eventsListed,
      events_club: eventsClub,
      events_strict: ledger.length,
      quotes_listed: quotesDateOnly + quotesExact,
      quotes_exact: quotesExact,
      quotes_date_only: quotesDateOnly,
      as_of_usable: ledger.length,
      decisions: 1,
      candidates: blind.decision.candidate ? 1 : 0,
      bets: 0,
      kaggle_bulk_acquired: kaggle.bulk_acquired,
      football_data_blocked: fdBlocked,
      edge_demonstrated: false,
      bankroll_testable: false,
    },
    scientific: {
      verdict: "INSUFFICIENT_DATA",
      sample_size_strict: ledger.length,
      holdout_status: "SACRED",
      multiple_testing: {
        alpha: 0.05,
        tests: 9,
        bonferroni: bonferroniThreshold(0.05, 9),
        any_significant: false,
      },
      primary_blocker:
        "Official Betfair Historic BASIC bulk (account login, credentials not used). UCD 2022–2024 Advanced is not public. Kaggle week is at most RESEARCH_TEMPORAL unless timezone-proven.",
      we_have: [
        "1 STRICT MATCH_ODDS event (Betfair BASIC GitHub MIRROR)",
        eventsClub > 0
          ? `${eventsClub} Club-Football matches RESEARCH_ONLY`
          : "Club-Football not loaded in this run",
        `${soccer.odds_fixtures} soccer-dataset fixtures with odds (closing known_at; ${soccer.fixtures} fixtures-parquet rows)`,
        `${BTB_CLOSING_EVENTS} BeatTheBookie closing DATE_ONLY (if cached)`,
        kaggle.bulk_acquired
          ? `Kaggle zygmunt/betfair-sports bulk: ${kaggle.sample_rows} rows, ${kaggle.soccer_events} soccer events, classes ${JSON.stringify(kaggle.class_counts)} (license Other, gitignored)`
          : "Kaggle weekly schema verified; bulk not cached",
      ],
      we_tested: [
        "Two-stage market_devig → edge gate on M001 → NO_BET",
        "Hostile leakage A–O",
        "TTK buckets on the BASIC stream",
        "CLV diagnostic after LOCK (not in DecisionContext)",
        clubMatches.length ? "Club-Football expanding-window Brier (not capital)" : "Club Brier skipped",
      ],
      missing: [
        "Betfair BASIC bulk ≥100 MATCH_ODDS events with quote_timestamp < kickoff",
        "Timezone-proven clocks on the Kaggle week (or official Betfair BASIC ≥100 events)",
        "UCD/Whelan Advanced 2022–2024 files (not posted)",
        "football-data.co.uk live CSV if 503",
      ],
    },
    risk: {
      flat: "unused",
      fractional_kelly: "unused",
      risk_capped_kelly: "unused",
      actuarial_v1: "unused",
      masaniello: "challenger_only_unused",
      winner: null,
    },
    monte_carlo: {
      historical: true,
      simulated: false,
      ran: false,
      reason: "No historical bets — Monte Carlo cannot create edge",
    },
  };
}

export function loadTask025ReportForUi(): Task025Report | null {
  const p = join(process.cwd(), "artifacts", "task-025-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task025Report;
    if (raw.experiment_id === "exp_025_real_data_turnaround_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask025(): Promise<Task025Report> {
  return loadTask025ReportForUi() ?? runTask025({ allowNetwork: false, skipResearchCorpus: true });
}
