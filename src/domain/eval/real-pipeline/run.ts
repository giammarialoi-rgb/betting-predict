/**
 * ONE vertical slice: discover → collect → normalize → as-of → features →
 * model → decision → dossier → publish.
 * Wires existing modules. Does not invent probabilities or FT scores.
 */
import { NEON_IN_USE, storageBanner } from "@/domain/storage";
import { PI_MODEL_INDEPENDENT_ID } from "@/domain/eval/predictive-intelligence/config";
import { loadPiMatches, importFootballDataDataset } from "@/domain/eval/predictive-intelligence/dataset/loader";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  appendEvent044,
  loadStore044,
  type Store044,
} from "@/domain/eval/permanent-044/store";
import { analyzeAllLabB045 } from "@/domain/eval/factory-045/analyze";
import { runDecisionEngine048 } from "@/domain/eval/factory-048/engine";
import { runEventResearchBatch } from "@/domain/eval/data-intelligence/research/run-event-research";
import { loadResearchObservationsForEvent } from "@/domain/eval/data-intelligence/research/observations-store";
import {
  loadResearchQueue,
  saveResearchQueue,
} from "@/domain/eval/data-intelligence/research/queue";
import { buildAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import {
  discoverAndPickGoldenEvent,
  discoverGoldenCandidates,
  type DiscoveredCandidate,
} from "@/domain/eval/betmind-runtime/golden-e2e/discover";
import { mapCompetitionToPiDivision } from "@/domain/eval/predictive-intelligence/live-resolve";
import { auditExistingSources } from "@/domain/eval/betmind-runtime/golden-e2e/source-audit";
import {
  assertPreMatchData,
  buildAsOfSnapshot,
} from "@/domain/eval/real-pipeline/as-of-snapshot";
import { classifyConfiguredSource } from "@/domain/eval/real-pipeline/source-status";
import { sliceDecisionFrom048 } from "@/domain/eval/real-pipeline/decision-label";
import { publishAnalysis } from "@/domain/eval/real-pipeline/publish";
import type { RealPipelineReport, SourceResult } from "@/domain/eval/real-pipeline/types";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import type { DecisionRecord048 } from "@/domain/eval/factory-048/decision";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function emptyReport(at: string): RealPipelineReport {
  return {
    at,
    neon_in_use: false,
    event: null,
    source_coverage: [],
    feature_coverage: null,
    data_coverage: null,
    model: { version: PI_MODEL_INDEPENDENT_ID, ok: false, reason_codes: [] },
    probs: null,
    market: null,
    edge: null,
    decision: "INSUFFICIENT DATA",
    decision_raw: null,
    dossier_id: null,
    dossier_state: "missing",
    publish: {
      status: "DOSSIER_NOT_MIRRORED",
      local_verified: false,
      remote_verified: false,
      reason: null,
      backend: "none",
    },
    remote_board: "DOSSIER_NOT_MIRRORED",
    blocked_by: [],
    errors: [],
  };
}

function pickFutureOnly(
  candidates: DiscoveredCandidate[],
  nowMs: number,
  preferEventId?: string,
): DiscoveredCandidate | null {
  if (preferEventId) {
    const hit = candidates.find((c) => c.event.event_id === preferEventId);
    if (hit) return hit;
  }
  const upcoming = candidates
    .filter((c) => {
      if (c.finished || c.live) return false;
      if (c.event.status !== "UPCOMING") return false;
      const ko = Date.parse(c.event.kickoff_utc ?? "");
      return Number.isFinite(ko) && ko > nowMs && Boolean(c.event.home_or_a && c.event.away_or_b);
    })
    .sort((a, b) => Date.parse(a.event.kickoff_utc ?? "") - Date.parse(b.event.kickoff_utc ?? ""));
  const piUniverse = upcoming.filter((c) => mapCompetitionToPiDivision(c.event.competition));
  return piUniverse[0] ?? upcoming[0] ?? null;
}

function latestDecision(root: string, eventId: string): DecisionRecord048 | null {
  const p = join(root, "decisions.jsonl");
  if (!existsSync(p)) return null;
  let last: DecisionRecord048 | null = null;
  for (const line of readFileSync(p, "utf8").split(/\n/).filter(Boolean)) {
    try {
      const row = JSON.parse(line) as DecisionRecord048;
      if (row.event_id === eventId) last = row;
    } catch {
      /* skip */
    }
  }
  return last;
}

function latestPrediction(store: Store044, eventId: string) {
  return [...store.predictions]
    .filter((p) => p.event_id === eventId)
    .sort((a, b) => b.prediction_seq - a.prediction_seq)[0] ?? null;
}

export async function runRealAnalysisPipeline(opts?: {
  eventId?: string;
  labBRoot?: string;
  nowMs?: number;
  ensureHistoricalPriors?: boolean;
  /** Board-wide runs skip the catalog HTTP audit after the first event. */
  skipSourceCatalogAudit?: boolean;
}): Promise<RealPipelineReport> {
  const nowMs = opts?.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const root = opts?.labBRoot ?? permanentRoot044();
  const report = emptyReport(nowIso);
  report.blocked_by = [];

  if (NEON_IN_USE) {
    throw new Error("NEON_BANNED");
  }
  void storageBanner();

  const store = loadStore044(root);
  const sourceCoverage: SourceResult[] = [];

  const sourceAudit = opts?.skipSourceCatalogAudit ? [] : await auditExistingSources();
  for (const row of sourceAudit) {
    const envGuess =
      row.source_id === "the-odds-api" || row.source_id === "odds-api"
        ? "THE_ODDS_API_KEY"
        : row.source_id === "api-sports" || row.source_id === "api-football"
          ? "API_SPORTS_KEY"
          : row.source_id === "football-data-org"
            ? "FOOTBALL_DATA_ORG_TOKEN"
            : null;
    sourceCoverage.push(
      classifyConfiguredSource({
        source_id: row.source_id,
        env_var: row.key === "NOT_REQUIRED" ? null : envGuess,
        role:
          row.source_id === "the-odds-api" || row.source_id === "odds-api"
            ? "MARKET_COMPARE"
            : row.source_id === "clubelo" || row.source_id === "football-data-co-uk"
              ? "MODEL_FEATURE"
              : row.source_id === "espn" || row.source_id === "openligadb" || row.source_id === "thesportsdb"
                ? "IDENTITY"
                : "CONTEXT",
        fetched: row.probed,
        http_status: row.http_status ?? null,
        fields_extracted: row.extractable_fields ?? [],
        records: row.extractable_fields?.length ?? 0,
        reason: row.reason ?? row.status,
        acquisition: row.status === "WORKING" ? "OK" : row.status,
        blockedByPolicy: row.status === "BLOCKED",
        enters_independent_model:
          (row.source_id === "clubelo" || row.source_id === "football-data-co-uk") &&
          row.status === "WORKING",
      }),
    );
  }

  sourceCoverage.push(
    classifyConfiguredSource({
      source_id: "the-odds-api",
      env_var: "THE_ODDS_API_KEY",
      role: "MARKET_COMPARE",
      fetched: false,
      reason: process.env.THE_ODDS_API_KEY?.trim() ? "configured (not pulled on slice unless used)" : undefined,
    }),
  );
  sourceCoverage.push(
    classifyConfiguredSource({
      source_id: "api-sports",
      env_var: "API_SPORTS_KEY",
      role: "MODEL_FEATURE",
      fetched: false,
    }),
  );
  sourceCoverage.push(
    classifyConfiguredSource({
      source_id: "football-data-org",
      env_var: "FOOTBALL_DATA_ORG_TOKEN",
      role: "IDENTITY",
      fetched: false,
    }),
  );

  let event: PermanentEvent044 | null = null;
  if (opts?.eventId) {
    event = store.events.find((e) => e.event_id === opts.eventId) ?? null;
    if (!event) {
      const rediscovered = await discoverAndPickGoldenEvent(nowMs, opts.eventId);
      event = rediscovered.pick?.event ?? null;
    }
    if (!event) {
      report.errors.push("EVENT_NOT_FOUND");
      report.blocked_by.push({
        service: "discovery",
        code: "EVENT_NOT_FOUND",
        detail: `No event ${opts.eventId} in Lab B or free-source discovery`,
      });
      report.source_coverage = sourceCoverage;
      return report;
    }
  } else {
    const { candidates, probes } = await discoverGoldenCandidates(nowMs);
    for (const p of probes) {
      sourceCoverage.push(
        classifyConfiguredSource({
          source_id: p.source,
          env_var: null,
          role: "IDENTITY",
          fetched: p.status === 200,
          http_status: p.status,
          records: p.parsed,
          fields_extracted: p.parsed > 0 ? ["home", "away", "kickoff"] : [],
          acquisition: p.status === 200 ? (p.parsed > 0 ? "OK" : "NO_DATA") : "NETWORK_ERROR",
        }),
      );
    }
    const pick = pickFutureOnly(candidates, nowMs);
    if (!pick) {
      report.errors.push("NO_FUTURE_EVENT");
      report.blocked_by.push({
        service: "discovery",
        code: "NO_FUTURE_EVENT",
        detail: "OpenLigaDB/ESPN/TheSportsDB returned no upcoming identified match",
      });
      report.source_coverage = sourceCoverage;
      return report;
    }
    event = pick.event;
  }

  const kickoff = event.kickoff_utc;
  const kickMs = kickoff ? Date.parse(kickoff) : NaN;
  const future = Number.isFinite(kickMs) && kickMs > nowMs;
  report.event = {
    event_id: event.event_id,
    home: event.home_or_a,
    away: event.away_or_b,
    competition: event.competition,
    kickoff_utc: event.kickoff_utc,
    sport: event.sport,
    source: event.source,
    status: event.status,
    future,
  };

  appendEvent044(store, event);

  if (opts?.ensureHistoricalPriors !== false && loadPiMatches(root).length < 500) {
    try {
      const manifest = await importFootballDataDataset({ labBRoot: root });
      sourceCoverage.push(
        classifyConfiguredSource({
          source_id: "football-data-co-uk",
          env_var: null,
          role: "MODEL_FEATURE",
          fetched: true,
          records: manifest.total_rows,
          fields_extracted: manifest.total_rows > 0 ? ["matches"] : [],
          acquisition: manifest.total_rows >= 500 ? "OK" : "PARTIAL",
          reason: `imported ${manifest.total_rows} historical rows`,
          enters_independent_model: manifest.total_rows >= 500,
        }),
      );
      if (manifest.total_rows < 500) {
        report.blocked_by.push({
          service: "football-data.co.uk",
          code: "PI_DATASET_SPARSE",
          detail: `historical rows=${manifest.total_rows} (need ≥500 for soccer adapter)`,
        });
      }
    } catch (e) {
      sourceCoverage.push(
        classifyConfiguredSource({
          source_id: "football-data-co-uk",
          env_var: null,
          role: "MODEL_FEATURE",
          fetched: true,
          acquisition: "NETWORK_ERROR",
          reason: e instanceof Error ? e.message : String(e),
        }),
      );
      report.blocked_by.push({
        service: "football-data.co.uk",
        code: "PI_DATASET_UNAVAILABLE",
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  } else {
    const n = loadPiMatches(root).length;
    sourceCoverage.push(
      classifyConfiguredSource({
        source_id: "football-data-co-uk",
        env_var: null,
        role: "MODEL_FEATURE",
        fetched: n > 0,
        records: n,
        fields_extracted: n > 0 ? ["matches"] : [],
        acquisition: n >= 500 ? "OK" : n > 0 ? "PARTIAL" : "NO_DATA",
        enters_independent_model: n >= 500,
      }),
    );
  }

  const q = loadResearchQueue(root);
  const existing = q.items.find((i) => i.event_id === event.event_id);
  if (existing) {
    existing.state = existing.state === "DISCOVERED" ? "QUEUED" : existing.state;
    existing.last_attempt_at = nowIso;
  } else {
    q.items.push({
      event_id: event.event_id,
      home: event.home_or_a,
      away: event.away_or_b,
      competition: event.competition,
      kickoff_utc: event.kickoff_utc,
      state: "QUEUED",
      last_cycle: null,
      last_attempt_at: nowIso,
      attempts: 0,
    });
  }
  q.updated_at = nowIso;
  saveResearchQueue(q, root);

  const asOf = future || !Number.isFinite(kickMs) ? nowIso : new Date(kickMs).toISOString();

  const research = await runEventResearchBatch({
    events: [event],
    cycleNumber: null,
    nowIso,
    labBRoot: root,
    maxEvents: 1,
    asOf,
  });
  const q2 = loadResearchQueue(root);
  const item = q2.items.find((i) => i.event_id === event.event_id);
  if (item) {
    item.state = research.research_failures > 0 && research.observations_created === 0 ? "INSUFFICIENT" : "RESEARCHED";
    item.attempts += 1;
    item.last_attempt_at = nowIso;
    saveResearchQueue(q2, root);
  }
  for (const [sourceId, counts] of Object.entries(research.by_source)) {
    sourceCoverage.push(
      classifyConfiguredSource({
        source_id: sourceId,
        env_var: null,
        role: sourceId === "clubelo" ? "MODEL_FEATURE" : "CONTEXT",
        fetched: counts.ok + counts.fail + counts.denied > 0,
        records: counts.ok,
        fields_extracted: counts.ok > 0 ? ["observation"] : [],
        researchPhase: counts.ok > 0 ? "OK" : counts.denied > 0 ? "BLOCKED" : counts.fail > 0 ? "ERROR" : "PARTIAL",
        reason: `ok=${counts.ok} fail=${counts.fail} denied=${counts.denied}`,
      }),
    );
  }

  const observations = loadResearchObservationsForEvent(event.event_id, root);
  const snapshot = buildAsOfSnapshot({
    event,
    asOf,
    observations,
    quotes: store.quotes.filter((x) => x.event_id === event.event_id),
  });
  assertPreMatchData(snapshot, event.kickoff_utc ?? asOf);

  const reloaded = loadStore044(root);
  analyzeAllLabB045({ store: reloaded, nowIso, eventIds: [event.event_id] });
  runDecisionEngine048({ store: reloaded, nowIso, eventIds: [event.event_id] });

  const pred = latestPrediction(reloaded, event.event_id);
  const dec = latestDecision(root, event.event_id);
  report.probs = pred?.probability_model ?? null;
  report.market = pred?.probability_market ?? null;
  report.edge = pred?.edge_absolute ?? null;
  report.model = {
    version: pred?.model_version ?? PI_MODEL_INDEPENDENT_ID,
    ok: Boolean(pred?.probability_model),
    reason_codes: pred?.reason_codes ?? ["NO_PREDICTION"],
  };
  report.decision_raw = dec?.decision ?? (pred?.reason_codes.includes("INSUFFICIENT_DATA") ? "INSUFFICIENT_DATA" : "NO_BET");
  report.decision = sliceDecisionFrom048(report.decision_raw);

  const dossier = buildAnalysisDossier(event.event_id, root);
  report.feature_coverage = dossier?.independent_model.feature_coverage ?? pred?.data_quality_score ?? null;
  report.data_coverage = dossier?.independent_model.data_coverage ?? null;
  if (dossier?.independent_model.reason_codes?.length) {
    report.model.reason_codes = [...new Set([...report.model.reason_codes, ...dossier.independent_model.reason_codes])];
  }

  const published = await publishAnalysis({
    eventId: event.event_id,
    dossier,
    labBRoot: root,
    nowIso,
  });
  report.publish = {
    status: published.status,
    local_verified: published.local_verified,
    remote_verified: published.remote_verified,
    reason: published.reason,
    backend: published.backend,
  };
  report.remote_board = published.remote_board;
  report.dossier_id = published.dossier_id ?? dossier?.prediction_id ?? (dossier ? event.event_id : null);
  report.dossier_state = dossier
    ? published.remote_verified
      ? "ok"
      : "local_only"
    : "missing";

  if (!process.env.BLOB_READ_WRITE_TOKEN?.trim() && published.remote_board === "BLOB_NOT_CONFIGURED") {
    report.blocked_by.push({
      env_var: "BLOB_READ_WRITE_TOKEN",
      service: "vercel_blob",
      code: "BLOB_NOT_CONFIGURED",
      detail: "Remote board not mirrored. Local dossier is the SoT.",
    });
  }
  if (!process.env.THE_ODDS_API_KEY?.trim()) {
    report.blocked_by.push({
      env_var: "THE_ODDS_API_KEY",
      service: "the-odds-api",
      code: "NOT_CONFIGURED",
      detail: "Market compare unavailable. Odds never enter the independent model.",
    });
  }

  report.source_coverage = sourceCoverage;
  return report;
}

export function formatPipelineReport(report: RealPipelineReport): string {
  const ev = report.event;
  const lines = [
    "=== BetMind real analysis slice ===",
    `at=${report.at} neon_in_use=${report.neon_in_use}`,
    "",
    "EVENT",
    ev
      ? `  ${ev.home} vs ${ev.away} | ${ev.competition} | ${ev.kickoff_utc} | ${ev.event_id} | ${ev.source} | ${ev.status} | future=${ev.future}`
      : "  UNAVAILABLE",
    "",
    "SOURCE COVERAGE",
    ...report.source_coverage.map(
      (s) =>
        `  ${s.source_id} ${s.status} fetched=${s.fetched} records=${s.records} role=${s.role} ${s.reason}`,
    ),
    "",
    "FEATURE COVERAGE",
    `  feature_coverage=${report.feature_coverage ?? "n/a"} data_coverage=${report.data_coverage ?? "n/a"}`,
    "",
    "MODEL",
    `  version=${report.model.version} ok=${report.model.ok} codes=${report.model.reason_codes.join(",")}`,
    "",
    "PROBS",
    report.probs ? `  ${JSON.stringify(report.probs)}` : "  NO_PREDICTION / null (honest)",
    "",
    "MARKET",
    report.market ? `  ${JSON.stringify(report.market)}` : "  NOT_CONFIGURED or unavailable (compare-only)",
    "",
    "EDGE",
    `  ${report.edge ?? "n/a"}`,
    "",
    "DECISION",
    `  ${report.decision} (raw=${report.decision_raw ?? "n/a"})`,
    "",
    "DOSSIER",
    `  id=${report.dossier_id ?? "n/a"} state=${report.dossier_state}`,
    "",
    "PUBLISH",
    `  ${report.publish.status} local=${report.publish.local_verified} remote=${report.publish.remote_verified} backend=${report.publish.backend} ${report.publish.reason ?? ""}`,
    "",
    "REMOTE BOARD",
    `  ${report.remote_board}`,
  ];
  if (report.blocked_by.length) {
    lines.push("", "BLOCKED BY");
    for (const b of report.blocked_by) {
      lines.push(`  ${b.code} service=${b.service} env=${b.env_var ?? "—"} ${b.detail}`);
    }
  }
  if (report.errors.length) {
    lines.push("", "ERRORS", ...report.errors.map((e) => `  ${e}`));
  }
  return lines.join("\n");
}
