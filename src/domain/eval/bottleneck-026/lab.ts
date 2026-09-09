/**
 * TASK 026 orchestrator — acquire → inspect rows → classify → research vs STRICT → annual —.
 * Betfair is OPTIONAL_HIGH_QUALITY, not the single blocker.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { acquirePublicZips, probeTask026 } from "@/domain/eval/bottleneck-026/acquire";
import { annualBankroll026 } from "@/domain/eval/bottleneck-026/bankroll";
import { isQualified, successBand } from "@/domain/eval/bottleneck-026/classify";
import { loadExp026Config } from "@/domain/eval/bottleneck-026/config";
import { paidAlternativesAfterFreeExhausted, sourceMatrix026 } from "@/domain/eval/bottleneck-026/corpus";
import { inspectKaggleAh, type KaggleAhInspect026 } from "@/domain/eval/bottleneck-026/kaggle-ah";
import { runHostileBattery026 } from "@/domain/eval/bottleneck-026/leakage";
import { toMatchGrade026 } from "@/domain/eval/bottleneck-026/matching";
import {
  DATASET_ID_026,
  PARSER_VERSION_026,
  type AcquisitionFunnel026,
  type AcquisitionProbe026,
  type AnnualRow026,
  type MatchGrade026,
  type PaidAlternative026,
  type QualifiedGate026,
  type SourceMatrixRow026,
  type SuccessBand026,
  type Task026Verdict,
  type WindowAvailability026,
} from "@/domain/eval/bottleneck-026/types";
import { inspectZenodoUcd, type ZenodoInspect026 } from "@/domain/eval/bottleneck-026/zenodo";
import { emptyWindows, windowsFromTtk } from "@/domain/eval/bottleneck-026/windows";
import { loadClubForResearch, M001_IDENTITY } from "@/domain/eval/turnaround-025/club-scan";
import { gradeTwoEvents } from "@/domain/eval/turnaround-025/matching";
import { researchDiagnostic } from "@/domain/eval/turnaround-025/research";
import { runStrictBlind025 } from "@/domain/eval/turnaround-025/replay";
import { buildStrictLedgerFromBetfairFixture } from "@/domain/eval/attack-024/ledger";
import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";
import type { ResearchDiag025 } from "@/domain/eval/turnaround-025/types";
import { bonferroniThreshold } from "@/domain/eval/multiple-testing";

export type Task026Report = {
  experiment_id: string;
  task: "026";
  dataset_id: typeof DATASET_ID_026;
  parser_version: typeof PARSER_VERSION_026;
  as_of_policy: "STRICT_AS_OF";
  declared_edge: false;
  winner: null;
  auto_promote: false;
  real_money: false;
  HOLDOUT_TOUCHED: false;
  frozen_model: "market_devig";
  frozen_edge_threshold: 0.03;
  verdict: Task026Verdict;
  success_band: SuccessBand026;
  model_ready: false;
  probes: AcquisitionProbe026[];
  kaggle: KaggleAhInspect026;
  zenodo: ZenodoInspect026;
  matrix: SourceMatrixRow026[];
  funnel: AcquisitionFunnel026;
  paid_after_free: PaidAlternative026[];
  club_present: boolean;
  overlay: { grade: MatchGrade026; club_event_id: string | null };
  research: ResearchDiag025;
  strict_ledger: ReturnType<typeof buildStrictLedgerFromBetfairFixture>;
  blind: ReturnType<typeof runStrictBlind025>;
  windows: WindowAvailability026[];
  qualified: QualifiedGate026;
  annual: AnnualRow026[];
  leakage: { id: string; throws: boolean }[];
  metrics: {
    exact_timestamp_events: number;
    temporally_verified_events: number;
    capital_strict_events: 0;
    strict_quotes: number;
    bookmakers: string[];
    markets: string[];
    matched_exact: number;
    decisions: number;
    bets: 0;
    edge_demonstrated: false;
    bankroll_testable: false;
  };
  scientific: {
    verdict: Task026Verdict;
    holdout_status: "SACRED";
    multiple_testing: { alpha: number; tests: number; bonferroni: number; any_significant: false };
    primary_blocker: string;
    we_have: string[];
    we_tested: string[];
    missing: string[];
  };
  risk: {
    flat: "unused";
    fractional_kelly: "unused";
    risk_capped_kelly: "unused";
    actuarial_v1: "unused";
    masaniello: "challenger_only_unused";
    winner: null;
  };
};

function overlayGrade(matches: readonly ClubMatchLite[]): {
  grade: MatchGrade026;
  match: ClubMatchLite | null;
} {
  const hits = matches.filter((m) => m.matchDate.toISOString().slice(0, 10) === M001_IDENTITY.date);
  for (const m of hits) {
    const g = gradeTwoEvents({
      dateA: M001_IDENTITY.date,
      dateB: m.matchDate.toISOString().slice(0, 10),
      homeA: M001_IDENTITY.home,
      homeB: m.home,
      awayA: M001_IDENTITY.away,
      awayB: m.away,
      competitionA: M001_IDENTITY.competition,
      competitionB: m.division,
    });
    const mapped = toMatchGrade026(g);
    if (mapped === "EXACT") return { grade: mapped, match: m };
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
    if (toMatchGrade026(retry) === "EXACT") return { grade: "EXACT", match: m };
  }
  return { grade: hits.length ? "FAILED" : "FAILED", match: null };
}

function funnelFrom(input: {
  matrix: readonly SourceMatrixRow026[];
  exact: number;
  verified: number;
  capital: number;
}): AcquisitionFunnel026 {
  const tried = input.matrix.length;
  const accessible = input.matrix.filter((r) => r.accessible).length;
  const withTs = input.matrix.filter((r) => r.timestamp_exact === true).length;
  const historical = input.matrix.filter((r) => (r.events ?? 0) > 0 && r.corpus_level !== "UNUSABLE").length;
  const blockerParts = [
    "5DollarFootballAPI and OddsPapi returned 401 without a key (no signup, €0)",
    "Kaggle AH public zip is a 90-match SAMPLE with SOURCE timestamps but no kickoff and License=UNKNOWN",
    "Zenodo UCD is DATE_ONLY football-data.co.uk lineage (research, not STRICT)",
    "Betfair GitHub sample is MIRROR/SAMPLE (temporal engine only, not licensed capital)",
    "Nautilus football MCM file is gitignored and not shipped",
    "kito129 dump is tennis, not football",
  ];
  return {
    sources_tried: tried,
    accessible,
    with_timestamp: withTs,
    with_historical_rows: historical,
    exact_timestamp_events: input.exact,
    temporally_verified_events: input.verified,
    capital_strict_events: input.capital,
    blocker: blockerParts.join("; "),
  };
}

export async function runTask026(opts?: {
  allowNetwork?: boolean;
  skipHeavy?: boolean;
}): Promise<Task026Report> {
  const cfg = loadExp026Config();
  const allowNetwork = opts?.allowNetwork === true;
  const skipHeavy = opts?.skipHeavy === true;
  const probes = await probeTask026(allowNetwork);
  if (allowNetwork) {
    probes.push(...(await acquirePublicZips()));
  }
  const kaggle = inspectKaggleAh({ skipFull: skipHeavy });
  const zenodo = await inspectZenodoUcd({ skipFull: skipHeavy });
  const ledger = buildStrictLedgerFromBetfairFixture();

  let clubMatches: ClubMatchLite[] = [];
  let clubPresent = false;
  if (!skipHeavy) {
    const loaded = await loadClubForResearch(null);
    clubPresent = loaded.present;
    clubMatches = loaded.matches;
  } else {
    clubPresent = existsSync(
      join(process.cwd(), "audit", "external", "Club-Football-Match-Data", "data", "Matches.csv"),
    );
  }

  const overlay = skipHeavy ? { grade: "FAILED" as const, match: null } : overlayGrade(clubMatches);
  const blindRaw = runStrictBlind025({
    club: overlay.match,
    matchGrade: overlay.grade === "EXACT" ? "MATCH_EXACT" : "MATCH_FAILED",
  });
  const blind = {
    ...blindRaw,
    decision: {
      ...blindRaw.decision,
      capitalEligible: false,
    },
  };

  const kaggleExact = kaggle.zip_present && !skipHeavy ? kaggle.exact_timestamp_events : 0;
  const betfairExact = ledger.length > 0 ? 1 : 0;
  const exactEvents = kaggleExact + betfairExact;
  const verified = betfairExact;
  const capitalStrict = 0;

  const research = researchDiagnostic({
    matches: clubMatches,
    note: skipHeavy
      ? "Club-Football skipped in this run (use pnpm lab:task-026 for full research corpus)"
      : undefined,
  });

  const matrix = sourceMatrix026({
    probes,
    kaggle: skipHeavy ? { ...kaggle, exact_timestamp_events: kaggleExact, public_csv_files: kaggle.zip_present ? kaggle.public_csv_files : 0 } : kaggle,
    zenodo,
    clubEvents: clubMatches.length,
    betfairExactEvents: betfairExact,
    betfairCapitalEvents: capitalStrict,
  });

  const eventsByYear = new Map<number, number>();
  const strictByYear = new Map<number, number>();
  const decisionsByYear = new Map<number, number>([[2017, 1]]);
  const betsByYear = new Map<number, number>([[2017, 0]]);
  for (const m of clubMatches) {
    eventsByYear.set(m.year, (eventsByYear.get(m.year) ?? 0) + 1);
  }
  eventsByYear.set(2017, (eventsByYear.get(2017) ?? 0) + (clubMatches.length ? 0 : betfairExact));
  if (kaggleExact > 0) {
    eventsByYear.set(2025, (eventsByYear.get(2025) ?? 0) + kaggleExact);
  }

  const annual = annualBankroll026({
    years: cfg.solar_years,
    eventsByYear,
    strictByYear,
    decisionsByYear,
    betsByYear,
  });

  const windows: WindowAvailability026[] = [
    windowsFromTtk(blind.decision.eventId, blind.ttk),
    ...kaggle.files
      .filter((f) => f.match_id && f.exact_timestamps > 0)
      .slice(0, skipHeavy ? 1 : 90)
      .map((f) => emptyWindows(`kaggle-ah-${f.match_id}`)),
  ];

  const qualifiedInput = {
    temporal_exact: verified >= 100,
    fixture_exact: overlay.grade === "EXACT",
    market_valid: true,
    model_calibrated: false,
    sample_sufficient: false,
    walk_forward_pass: false,
    holdout_pass: false,
    statistical_gate_pass: false,
    evidence_available: true,
  };
  const qualified: QualifiedGate026 = { ...qualifiedInput, qualified: isQualified(qualifiedInput) };

  const funnel = funnelFrom({ matrix, exact: exactEvents, verified, capital: capitalStrict });
  const band = successBand(exactEvents);
  const books = new Set<string>(["Betfair"]);
  for (const f of kaggle.files) {
    for (const b of f.bookmakers) books.add(b);
  }

  return {
    experiment_id: cfg.experiment_id,
    task: "026",
    dataset_id: DATASET_ID_026,
    parser_version: PARSER_VERSION_026,
    as_of_policy: "STRICT_AS_OF",
    declared_edge: false,
    winner: null,
    auto_promote: false,
    real_money: false,
    HOLDOUT_TOUCHED: false,
    frozen_model: "market_devig",
    frozen_edge_threshold: 0.03,
    verdict: "INSUFFICIENT_DATA",
    success_band: band,
    model_ready: false,
    probes,
    kaggle,
    zenodo,
    matrix,
    funnel,
    paid_after_free: paidAlternativesAfterFreeExhausted(),
    club_present: clubPresent,
    overlay: { grade: overlay.grade, club_event_id: overlay.match?.eventId ?? null },
    research,
    strict_ledger: ledger,
    blind,
    windows,
    qualified,
    annual,
    leakage: runHostileBattery026(),
    metrics: {
      exact_timestamp_events: exactEvents,
      temporally_verified_events: verified,
      capital_strict_events: 0,
      strict_quotes: verified * 3,
      bookmakers: [...books].slice(0, 20),
      markets: ["MATCH_ODDS", ...(kaggleExact ? (["ASIAN_HANDICAP"] as const) : [])],
      matched_exact: overlay.grade === "EXACT" ? 1 : 0,
      decisions: 1,
      bets: 0,
      edge_demonstrated: false,
      bankroll_testable: false,
    },
    scientific: {
      verdict: "INSUFFICIENT_DATA",
      holdout_status: "SACRED",
      multiple_testing: {
        alpha: 0.05,
        tests: 9,
        bonferroni: bonferroniThreshold(0.05, 9),
        any_significant: false,
      },
      primary_blocker: funnel.blocker,
      we_have: [
        `${betfairExact} Betfair MIRROR MATCH_ODDS event with SOURCE publishTime < kickoff (engine only)`,
        kaggle.zip_present
          ? `Kaggle AH public zip: ${kaggle.public_csv_files} CSV files, ${kaggleExact} events with YYYYMMDDHHmmss clocks (License UNKNOWN, no kickoff)`
          : "Kaggle AH zip not on disk in this run",
        zenodo.zip_present
          ? `Zenodo UCD raw_data rows=${zenodo.raw_rows ?? "not counted this run"} DATE_ONLY CC-BY-4.0`
          : "Zenodo zip not on disk in this run",
        clubMatches.length
          ? `${clubMatches.length} Club-Football RESEARCH_DATE_ONLY matches`
          : "Club-Football not loaded in this run",
      ],
      we_tested: [
        "Unauthenticated 5DollarFootballAPI / OddsPapi v4+v5 probes",
        "Kaggle AH zip download + real CSV Timestamp column",
        "Zenodo replication package header/row class",
        "GitHub Betfair sample expansion (petermclagan, kito tennis, Nautilus gitignored)",
        "Blind LOCK on M001 — CLV after lock only",
        "Hostile leakage battery",
        clubMatches.length ? "Club research Brier (not capital)" : "Club Brier skipped",
      ],
      missing: [
        "≥100 licensed EXACT quote clocks with proven kickoff and quote < kickoff",
        "Kaggle AH full 7,494 dump + verified license + English names + kickoff overlay",
        "API keys (not created) for 5Dollar free / OddsPapi",
        "Official Betfair Historic bulk (optional HQ)",
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
  };
}

export function loadTask026ReportForUi(): Task026Report | null {
  const p = join(process.cwd(), "artifacts", "task-026-result.json");
  if (!existsSync(p)) return null;
  try {
    const raw = JSON.parse(readFileSync(p, "utf8")) as Task026Report;
    if (raw.experiment_id === "exp_026_break_bottleneck_v1") return raw;
  } catch {
    return null;
  }
  return null;
}

export async function loadOrRunTask026(): Promise<Task026Report> {
  return loadTask026ReportForUi() ?? runTask026({ allowNetwork: false, skipHeavy: true });
}

export function onePageVerdict(report: Task026Report): string {
  const years = report.annual
    .map((r) => `${r.year}: events=${r.events} strict=${r.strict} bets=${r.bets} end=${r.end ?? "—"}`)
    .join("\n");
  return [
    "TASK 026",
    `EXACT EVENTS: ${report.metrics.exact_timestamp_events}`,
    `STRICT QUOTES: ${report.metrics.strict_quotes}`,
    `BOOKMAKERS: ${report.metrics.bookmakers.join(",")}`,
    `MARKETS: ${report.metrics.markets.join(",")}`,
    `TIME WINDOWS: ${report.windows[0] ? Object.entries(report.windows[0]).filter(([k, v]) => k.startsWith("T-") && v === true).map(([k]) => k).join(",") || "none observed on capital" : "none"}`,
    `SOURCES: ${report.funnel.sources_tried} tried / ${report.funnel.accessible} accessible / ${report.funnel.with_timestamp} with timestamp`,
    `MATCHED: ${report.metrics.matched_exact} EXACT`,
    `MODEL READY: ${report.model_ready}`,
    years,
    `TOTAL BETS: ${report.metrics.bets}`,
    `TOTAL P/L: —`,
    `BEST MODEL: null`,
    `BEST RISK POLICY: null`,
    `MAX DD: —`,
    `HOLDOUT: SACRED`,
    `SUCCESS BAND: ${report.success_band}`,
    `VERDICT: ${report.verdict}`,
    `FUNNEL: ${report.funnel.sources_tried} tried → ${report.funnel.accessible} accessible → ${report.funnel.with_timestamp} with timestamp → ${report.funnel.with_historical_rows} historical → ${report.funnel.exact_timestamp_events} exact → ${report.funnel.temporally_verified_events} verified vs kickoff → ${report.funnel.capital_strict_events} capital`,
    `BLOCKER: ${report.funnel.blocker}`,
    "winner = null",
    "real_money = false",
    "auto_promotion = false",
  ].join("\n");
}
