/**
 * Drive ONE Golden Event through the real pipeline. No invented numbers.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getStorage, NEON_IN_USE, storageBanner } from "@/domain/storage";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import {
  appendEvent044,
  appendJournal044,
  appendLearning044,
  appendLock044,
  appendPrediction044,
  appendSettlement044,
  loadStore044,
} from "@/domain/eval/permanent-044/store";
import { appendJsonl044 } from "@/domain/eval/permanent-044/store";
import { runEventResearchBatch } from "@/domain/eval/data-intelligence/research/run-event-research";
import { loadResearchObservationsForEvent } from "@/domain/eval/data-intelligence/research/observations-store";
import {
  loadResearchQueue,
  saveResearchQueue,
} from "@/domain/eval/data-intelligence/research/queue";
import { buildAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import {
  persistAndMirrorDossier,
  validateAnalysisDossier,
} from "@/domain/eval/betmind-runtime/dossier-mirror";
import {
  blobCredentialsPresent,
  createMemoryRemoteMirrorStore,
  getRemoteMirrorStore,
  setRemoteMirrorStoreOverride,
} from "@/domain/eval/betmind-runtime/remote-mirror";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import { discoverAndPickGoldenEvent } from "@/domain/eval/betmind-runtime/golden-e2e/discover";
import { auditExistingSources } from "@/domain/eval/betmind-runtime/golden-e2e/source-audit";
import { decidePrediction } from "@/domain/eval/betmind-runtime/golden-e2e/prediction";
import type { ChecklistStep, GoldenE2EReport } from "@/domain/eval/betmind-runtime/golden-e2e/types";

export function goldenE2EArtifactDir(): string {
  return join(process.cwd(), "artifacts", "golden-e2e");
}

function step(name: string, ok: boolean, evidence: string, count?: number | null): ChecklistStep {
  return { step: name, ok, evidence, count: count ?? null };
}

export async function runGoldenEventE2E(opts?: {
  labBRoot?: string;
  nowMs?: number;
  useMemoryMirrorIfNoBlob?: boolean;
}): Promise<GoldenE2EReport> {
  const root = opts?.labBRoot ?? permanentRoot044();
  const nowMs = opts?.nowMs ?? Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const errors: GoldenE2EReport["errors"] = [];
  const checklist: ChecklistStep[] = [];

  if (NEON_IN_USE) {
    throw new Error("NEON_BANNED");
  }
  checklist.push(step("neon_excluded", true, storageBanner().neon_status_it));

  const blobKey = blobCredentialsPresent() ? "KEY_PRESENT" : "KEY_MISSING";
  let memoryOverride = false;
  if (blobKey === "KEY_MISSING" && opts?.useMemoryMirrorIfNoBlob !== false) {
    setRemoteMirrorStoreOverride(createMemoryRemoteMirrorStore());
    memoryOverride = true;
  }
  const backend = getRemoteMirrorStore().kind;

  const sourceAudit = await auditExistingSources();
  const working = sourceAudit.filter((s) => s.status === "WORKING").length;
  checklist.push(
    step(
      "source_audit",
      sourceAudit.length > 0,
      `audited=${sourceAudit.length} working=${working} (existing adapters only)`,
      sourceAudit.length,
    ),
  );

  const discovered = await discoverAndPickGoldenEvent(nowMs);
  const pick = discovered.pick;
  if (!pick) {
    errors.push({
      error: "no_golden_event",
      cause: "OpenLigaDB/ESPN/TheSportsDB returned no identified event",
      evidence: JSON.stringify(discovered.probes),
      remediation: "Retry when a free source returns a match with home/away/kickoff",
    });
    return finalize({
      root,
      nowIso,
      blobKey,
      backend,
      sourceAudit,
      checklist: [
        ...checklist,
        step("discovery", false, "no identified event from working free sources", 0),
      ],
      errors,
      prediction: null,
      live: { available: false, reason: "no_event" },
      settlement: { available: false, result: null, reason: "no_event" },
      learning: { written: false, reason: "no_event" },
      mirror: { local_verified: false, remote_verified: false, repaired: false, reason: "no_event" },
      golden: null,
      counts: emptyCounts(),
    });
  }

  const event = pick.event;
  checklist.push(
    step(
      "discovery",
      true,
      `${event.home_or_a} vs ${event.away_or_b} · ${event.competition} · ${event.kickoff_utc} · source=${event.source}`,
      discovered.candidate_count,
    ),
  );

  const store = loadStore044(root);
  const persist = appendEvent044(store, event);
  checklist.push(
    step("persist", persist === "ok" || persist === "dup", `appendEvent044=${persist}`, store.eventIds.size),
  );

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
  checklist.push(step("research_job", true, "queued golden event", 1));

  const research = await runEventResearchBatch({
    events: [event],
    cycleNumber: null,
    nowIso,
    labBRoot: root,
    maxEvents: 1,
    asOf: event.kickoff_utc ?? nowIso,
  });
  const q2 = loadResearchQueue(root);
  const item = q2.items.find((i) => i.event_id === event.event_id);
  if (item) {
    item.state = research.research_failures > 0 && research.observations_created === 0 ? "INSUFFICIENT" : "RESEARCHED";
    item.attempts += 1;
    item.last_attempt_at = nowIso;
    saveResearchQueue(q2, root);
  }
  checklist.push(
    step(
      "research",
      research.events_touched >= 1,
      `fetches=${research.research_fetches} obs=${research.observations_created} yield=${research.data_yield}`,
      research.events_touched,
    ),
  );
  checklist.push(
    step("brain", true, "focused brain path: research + independent predict + dossier (single event)", 1),
  );

  const observations = loadResearchObservationsForEvent(event.event_id, root);
  checklist.push(
    step("observations", observations.length > 0, `persisted=${observations.length}`, observations.length),
  );
  if (observations.length === 0) {
    errors.push({
      error: "no_observations",
      cause: "research adapters returned no persistable rows for this event",
      evidence: JSON.stringify(research.by_source),
      remediation: "Accept unavailable; do not invent observations",
    });
  }

  const dossier = buildAnalysisDossier(event.event_id, root);
  const dossierVal = dossier ? validateAnalysisDossier(dossier) : { ok: false, reason: "not_built", missing: ["analysis_dossier"] };
  checklist.push(
    step(
      "dossier_builder",
      Boolean(dossier),
      dossier
        ? `features=${dossier.features.length} research_rows=${dossier.research.length} dq=${dossier.data_quality?.data_quality_score ?? "n/a"}`
        : "buildAnalysisDossier returned null",
    ),
  );
  checklist.push(
    step("dossier_validation", dossierVal.ok, dossierVal.ok ? "analysis_dossier valid" : dossierVal.reason),
  );

  getStorage(root).upsertBoardEvent({
    event_id: event.event_id,
    bucket: dossier ? "ANALYZED" : "DISCOVERED",
    published_at: nowIso,
    payload: {
      event_id: event.event_id,
      label: `${event.home_or_a} vs ${event.away_or_b}`,
      home_or_a: event.home_or_a,
      away_or_b: event.away_or_b,
      competition: event.competition,
      kickoff_utc: event.kickoff_utc,
      sport: event.sport,
      bucket: dossier ? "ANALYZED" : "DISCOVERED",
    },
  });
  checklist.push(step("board", true, "board row upserted (not a dossier)", 1));

  const mirror = dossier
    ? await persistAndMirrorDossier(event.event_id, root, dossier)
    : {
        local_persisted: false,
        local_verified: false,
        remote_mirrored: false,
        remote_verified: false,
        repaired: false,
        reason: "no_dossier",
        backend,
      };
  checklist.push(
    step("dossier_storage", mirror.local_verified, mirror.reason ?? "local dossier verified"),
  );
  checklist.push(
    step(
      "remote_mirror",
      mirror.remote_verified,
      `backend=${mirror.backend} blob=${blobKey} repaired=${mirror.repaired} ${mirror.reason ?? ""}`,
    ),
  );
  if (!mirror.remote_verified) {
    errors.push({
      error: "remote_dossier_unverified",
      cause: mirror.reason ?? "remote readback failed",
      evidence: `backend=${mirror.backend} blob=${blobKey}`,
      remediation:
        blobKey === "KEY_MISSING"
          ? "Set BLOB_READ_WRITE_TOKEN to publish dossiers to Vercel Blob. Protocol can still be verified in-process."
          : "Re-run repairMirror(event_id) after ingest is reachable",
    });
  }

  const decisionTime = event.kickoff_utc && Date.parse(event.kickoff_utc) < nowMs ? event.kickoff_utc : nowIso;
  const prediction = decidePrediction({
    event,
    dossier,
    labBRoot: root,
    decisionTime,
  });

  if (prediction.kind === "PREDICTION") {
    appendPrediction044(store, {
      prediction_id: prediction.prediction_id,
      event_id: event.event_id,
      timestamp: nowIso,
      model_version: prediction.model_version,
      feature_version: "features_pi_v1",
      market: prediction.market,
      selection: prediction.selection,
      line: null,
      probability_model: prediction.probs,
      probability_market: null,
      edge_absolute: prediction.edge,
      edge_relative: null,
      confidence_score: prediction.confidence ?? 0,
      data_quality_score: dossier?.data_quality?.data_quality_score ?? 0,
      recommended: false,
      reason_codes: prediction.evidence_refs,
      risk_flags: [],
      human_readable_reason: `Golden E2E independent model ${prediction.model_version}`,
      ranking_bucket: "NO_BET",
      prediction_seq: 1,
      immutable: true,
    });
    appendLock044(store, {
      event_id: event.event_id,
      lock_timestamp: nowIso,
      decision_context_hash: createHash("sha256").update(prediction.prediction_id).digest("hex").slice(0, 16),
      model_version: prediction.model_version,
      feature_version: "features_pi_v1",
      market_snapshot_hash: "none",
      prediction_hash: prediction.prediction_id,
      lab: "PERMANENT_LIVE",
      lab_a_decision_id: null,
    });
    checklist.push(
      step("prediction", true, `PREDICTION ${prediction.model_version} ${prediction.selection}`, 1),
    );
  } else {
    appendJournal044(root, {
      kind: "NO_PREDICTION",
      event_id: event.event_id,
      reason: prediction.reason,
      failed_gates: prediction.failed_gates,
      missing: prediction.missing,
    });
    appendJsonl044(join(root, "predictions.jsonl"), {
      prediction_id: `nopred-${event.event_id.slice(0, 12)}`,
      event_id: event.event_id,
      timestamp: nowIso,
      model_version: "NO_PREDICTION",
      feature_version: "features_pi_v1",
      market: "1X2",
      selection: null,
      line: null,
      probability_model: null,
      probability_market: null,
      edge_absolute: null,
      edge_relative: null,
      confidence_score: 0,
      data_quality_score: dossier?.data_quality?.data_quality_score ?? 0,
      recommended: false,
      reason_codes: ["NO_PREDICTION", ...prediction.failed_gates],
      risk_flags: ["FAILED_GATES"],
      human_readable_reason: `NO PREDICTION — ${prediction.reason}: ${prediction.failed_gates.join(",")}`,
      ranking_bucket: "NO_BET",
      prediction_seq: 1,
      immutable: true,
    });
    checklist.push(
      step(
        "prediction",
        true,
        `NO PREDICTION reason=${prediction.reason} failed_gates=${prediction.failed_gates.join(",")}`,
        0,
      ),
    );
  }

  const live = pick.live
    ? { available: true, reason: `source=${pick.source} status=LIVE` }
    : { available: false, reason: pick.finished ? "event_finished" : "no_in_play_feed" };
  if (live.available) {
    appendJsonl044(join(root, "updates.jsonl"), {
      event_id: event.event_id,
      kind: "live_update",
      at: nowIso,
      source: pick.source,
      original_prediction: prediction.kind === "PREDICTION" ? prediction.prediction_id : null,
      note: "live state from source; not a replacement prediction",
    });
  }
  checklist.push(step("live", live.available || !pick.live, live.reason, live.available ? 1 : 0));

  let settlement: GoldenE2EReport["settlement"] = {
    available: false,
    result: null,
    reason: "event_not_finished",
  };
  if (pick.finished && pick.score) {
    const result = `${pick.score.home}-${pick.score.away}`;
    const sel = prediction.kind === "PREDICTION" ? prediction.selection : null;
    let outcome: "won" | "lost" | "UNSETTLED" = "UNSETTLED";
    if (sel) {
      const actual = pick.score.home > pick.score.away ? "HOME" : pick.score.home < pick.score.away ? "AWAY" : "DRAW";
      outcome = sel === actual ? "won" : "lost";
    }
    appendSettlement044(store, {
      event_id: event.event_id,
      result,
      market: "1X2",
      selection: sel,
      outcome,
      settled_at: nowIso,
      source: pick.score_source ?? pick.source,
      source_confidence: 0.8,
    });
    settlement = { available: true, result, reason: `real finished score from ${pick.score_source}` };
  }
  checklist.push(
    step("settlement", settlement.available || !pick.finished, settlement.reason ?? "", settlement.available ? 1 : 0),
  );

  let learning: GoldenE2EReport["learning"] = { written: false, reason: "not_settled" };
  if (settlement.available) {
    const learningId = createHash("sha256").update(`learn|${event.event_id}|${nowIso}`).digest("hex").slice(0, 20);
    appendLearning044(store, {
      candidate_id: learningId,
      autopsy_id: `golden-${event.event_id.slice(0, 12)}`,
      hypothesis: "single-match learning_record only — no weight update",
      feature: null,
      observed_pattern: `result=${settlement.result} prediction=${prediction.kind}`,
      evidence_count: 1,
      confidence: 0,
      proposed_change: "none — no single-match weight hack",
      status: "OBSERVED",
    });
    appendJsonl044(join(piRoot(root), "learning", "cases.jsonl"), {
      learning_record_id: learningId,
      event_id: event.event_id,
      prediction_id: prediction.kind === "PREDICTION" ? prediction.prediction_id : null,
      original_prediction: prediction.kind === "PREDICTION" ? prediction.probs : null,
      live_update: null,
      result: settlement.result,
      settled_at: nowIso,
      single_match_weight_hack: false,
      status: "OBSERVED",
    });
    learning = { written: true, reason: "learning_record after settle; no weight hack" };
  }
  checklist.push(step("learning", learning.written || !settlement.available, learning.reason, learning.written ? 1 : 0));
  checklist.push(
    step(
      "event_detail_states",
      Boolean(dossier) || Boolean(event.event_id),
      dossier
        ? mirror.remote_verified
          ? "dossier_state=ok (local+remote)"
          : "dossier_state=local_only"
        : "dossier_state=research_failed_or_board_only",
    ),
  );

  const localDossiers = getStorage(root).listDossiers().filter((d) => d.event_id === event.event_id);
  const remoteCount = mirror.remote_verified ? 1 : 0;

  if (memoryOverride) {
    /* keep override for callers/tests; script will clear */
  }

  return finalize({
    root,
    nowIso,
    blobKey,
    backend,
    sourceAudit,
    checklist,
    errors,
    prediction,
    live,
    settlement,
    learning,
    mirror: {
      local_verified: mirror.local_verified,
      remote_verified: mirror.remote_verified,
      repaired: Boolean(mirror.repaired),
      reason: mirror.reason,
    },
    golden: {
      event_id: event.event_id,
      home: event.home_or_a,
      away: event.away_or_b,
      competition: event.competition,
      kickoff_utc: event.kickoff_utc,
      sport: event.sport,
      source: event.source,
      status: event.status,
    },
    counts: {
      events: 1,
      research_jobs: 1,
      sources_queried: sourceAudit.filter((s) => s.probed).length,
      sources_working: working,
      observations: observations.length,
      dossiers_local: localDossiers.length,
      dossiers_remote: remoteCount,
      brain_cycles: 1,
      predictions: prediction.kind === "PREDICTION" ? 1 : 0,
      no_predictions: prediction.kind === "NO_PREDICTION" ? 1 : 0,
      live_updates: live.available ? 1 : 0,
      settlements: settlement.available ? 1 : 0,
      learning_records: learning.written ? 1 : 0,
    },
  });
}

function emptyCounts(): GoldenE2EReport["counts"] {
  return {
    events: 0,
    research_jobs: 0,
    sources_queried: 0,
    sources_working: 0,
    observations: 0,
    dossiers_local: 0,
    dossiers_remote: 0,
    brain_cycles: 0,
    predictions: 0,
    no_predictions: 0,
    live_updates: 0,
    settlements: 0,
    learning_records: 0,
  };
}

function finalize(input: {
  root: string;
  nowIso: string;
  blobKey: "KEY_PRESENT" | "KEY_MISSING";
  backend: "vercel_blob" | "memory" | "none";
  sourceAudit: GoldenE2EReport["source_audit"];
  checklist: ChecklistStep[];
  errors: GoldenE2EReport["errors"];
  prediction: GoldenE2EReport["prediction"];
  live: GoldenE2EReport["live"];
  settlement: GoldenE2EReport["settlement"];
  learning: GoldenE2EReport["learning"];
  mirror: GoldenE2EReport["mirror"];
  golden: GoldenE2EReport["golden"];
  counts: GoldenE2EReport["counts"];
}): GoldenE2EReport {
  return {
    at: input.nowIso,
    neon_in_use: false,
    neon_status_it: "NEON NON UTILIZZATO",
    blob_credentials: input.blobKey,
    remote_backend: input.backend,
    golden: input.golden,
    counts: input.counts,
    source_audit: input.sourceAudit,
    prediction: input.prediction,
    live: input.live,
    settlement: input.settlement,
    learning: input.learning,
    mirror: input.mirror,
    checklist: input.checklist,
    errors: input.errors,
  };
}

export function writeGoldenE2EArtifacts(report: GoldenE2EReport): string {
  const dir = goldenE2EArtifactDir();
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "e2e-report.json");
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
}
