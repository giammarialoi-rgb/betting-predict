import { loadStore039 } from "@/domain/eval/live-039/store";
import type { Store039 } from "@/domain/eval/live-039/store";
import { settledVerified039 } from "@/domain/eval/live-039/health";
import { t1hCutoffMs039 } from "@/domain/eval/live-039/asof";
import { runCollectorCycle042 } from "@/domain/eval/collector-042/cycle";
import { loadCreditState042, remainingCredits042 } from "@/domain/eval/collector-042/credit";
import { syncCatalogFrom039 } from "@/domain/eval/live-043/catalog";
import {
  artifactStore043,
  loadExp043Config,
  sourceStore043,
} from "@/domain/eval/live-043/config";
import { buildFeatureSnapshot043, dataQualityScore043 } from "@/domain/eval/live-043/features";
import { buildSnapshotsForEvent043 } from "@/domain/eval/live-043/snapshots";
import {
  candidateGate043,
  deltaProb043,
  marketProbFromTri043,
  modelProbFromMarket043,
} from "@/domain/eval/live-043/predict";
import { triangulateMarket043 } from "@/domain/eval/live-043/triangulation";
import { runAutopsy043 } from "@/domain/eval/live-043/autopsy";
import { registerLearningCandidate043 } from "@/domain/eval/live-043/learning";
import {
  appendAutopsy043,
  loadModelRegistry043,
  loadStore043,
  upsertPrediction043,
  upsertTriangulation043,
} from "@/domain/eval/live-043/store";
import type { PredictionRecord043, PredictionStatus043 } from "@/domain/eval/live-043/types";
import { writeDailyReport043 } from "@/domain/eval/live-043/daily-report";

export type CycleResult043 = {
  catalogInserted: number;
  analyzed: number;
  partial: number;
  lockedFormal: number;
  candidates: number;
  strong: number;
  snapshotsWritten: number;
  triangulations: number;
  autopsies: number;
  learningCandidates: number;
  settled: number;
  tennisEvents: number;
  soccerEvents: number;
  creditsRemaining: number | null;
  modelVersion: string;
  collector042: Awaited<ReturnType<typeof runCollectorCycle042>> | null;
};

function predictionStatus(input: {
  locked: boolean;
  settled: boolean;
  autopsyDone: boolean;
  hasMarket: boolean;
  candidate: string;
}): PredictionStatus043 {
  if (input.autopsyDone) return "AUTOPSY_DONE";
  if (input.settled) return "AUTOPSY_PENDING";
  if (input.locked) return "LOCKED";
  if (input.candidate === "CANDIDATE" || input.candidate === "STRONG_CANDIDATE") return "CANDIDATE";
  if (!input.hasMarket) return "PARTIAL_DATA";
  if (input.candidate === "NO_SIGNAL") return "NO_EDGE";
  return "ANALYZED";
}

export async function runLive043Cycle(input: {
  sourceRoot?: string;
  artifactRoot?: string;
  runCollector042?: boolean;
  forceDiscovery?: boolean;
  fetchImpl?: typeof fetch;
  nowIso?: string;
}): Promise<CycleResult043> {
  loadExp043Config();
  const srcRoot = sourceStore043(input.sourceRoot);
  const artRoot = input.artifactRoot ?? artifactStore043();
  const nowIso = input.nowIso ?? new Date().toISOString();

  let collector042: CycleResult043["collector042"] = null;
  if (input.runCollector042) {
    collector042 = await runCollectorCycle042({
      storeRoot: srcRoot,
      forceDiscovery: input.forceDiscovery,
      fetchImpl: input.fetchImpl,
    });
  }

  const store039: Store039 = loadStore039(srcRoot);
  const store043 = loadStore043(artRoot);
  const reg = loadModelRegistry043(artRoot);
  const modelVersion = reg.current_version;

  const cat = syncCatalogFrom039(store043, store039.events, nowIso);

  let analyzed = 0;
  let partial = 0;
  let lockedFormal = 0;
  let candidates = 0;
  let strong = 0;
  let snapshotsWritten = 0;
  let triangulations = 0;
  let autopsies = 0;
  let learningCandidates = 0;

  const quotesByEvent = new Map<string, typeof store039.quotes>();
  for (const q of store039.quotes) {
    const arr = quotesByEvent.get(q.event_id) ?? [];
    arr.push(q);
    quotesByEvent.set(q.event_id, arr);
  }

  for (const ev of store039.events) {
    const qs = quotesByEvent.get(ev.event_id) ?? [];
    const markets = [...new Set(qs.map((q) => q.market))];
    const decision = store039.decisions.find((d) => d.event_id === ev.event_id) ?? null;
    const settlement = store039.settlements.find((s) => s.event_id === ev.event_id) ?? null;

    const cutoffMs = ev.commence_time ? t1hCutoffMs039(ev.commence_time) : null;
    const asOf =
      decision?.decision_timestamp_utc ??
      (cutoffMs != null
        ? new Date(cutoffMs).toISOString()
        : qs.map((q) => q.available_at).filter(Boolean).sort().at(-1) ?? null);

    let tri = null;
    if (asOf) {
      for (const market of markets) {
        tri = triangulateMarket043({
          eventId: ev.event_id,
          market,
          sportKey: ev.sport_key,
          quotes: qs,
          asOf,
        });
        upsertTriangulation043(store043, tri);
        triangulations += 1;
      }
    }

    const marketP = decision
      ? { HOME: decision.home_devig, DRAW: decision.draw_devig, AWAY: decision.away_devig }
      : marketProbFromTri043(tri);
    const modelP = modelProbFromMarket043(tri, decision);
    const delta = deltaProb043(modelP, marketP);
    const features = buildFeatureSnapshot043({
      asOf: asOf ?? nowIso,
      marketDispersion: tri?.dispersion ?? null,
      nBooks: tri?.n_books ?? 0,
      sport: ev.sport_key.startsWith("tennis_") ? "tennis" : "soccer",
    });
    const dq = dataQualityScore043(features);
    const gate = candidateGate043({
      model: modelP,
      market: marketP,
      delta,
      dataQuality: dq,
      modelConfidence: modelP ? 0.5 : 0.1,
      marketOnly: true,
    });
    if (gate.class === "CANDIDATE") candidates += 1;
    if (gate.class === "STRONG_CANDIDATE") strong += 1;

    const locked = Boolean(decision);
    if (locked) lockedFormal += 1;
    const settled = Boolean(settlement && settlement.outcome !== "UNSETTLED");
    const autopsyDone = store043.autopsies.some((a) => a.event_id === ev.event_id);

    const status = predictionStatus({
      locked,
      settled,
      autopsyDone,
      hasMarket: Boolean(marketP),
      candidate: gate.class,
    });
    if (status === "PARTIAL_DATA") partial += 1;
    else analyzed += 1;

    const pred: PredictionRecord043 = {
      event_id: ev.event_id,
      sport: ev.sport_key,
      status,
      candidate_class: gate.class,
      model_version: modelVersion,
      model_probability: modelP,
      market_probability: marketP,
      delta_probability: delta,
      edge_candidate: gate.edgeCandidate,
      data_quality: dq,
      model_confidence: modelP ? 0.5 : 0.1,
      uncertainty: 1 - dq,
      as_of: asOf,
      locked,
      formal_scientific: locked,
      created_at: nowIso,
      updated_at: nowIso,
    };
    upsertPrediction043(store043, pred);

    const snaps = buildSnapshotsForEvent043({
      store043,
      event: ev,
      quotes: qs,
      modelVersion,
      marketSnapshot: { triangulation: tri },
      modelSnapshot: { model_probability: modelP, version: modelVersion },
      featuresSnapshot: features,
    });
    snapshotsWritten += snaps.written;

    if (settled && !autopsyDone && decision) {
      const autopsy = runAutopsy043({ prediction: pred, decision, settlement: settlement! });
      appendAutopsy043(store043, autopsy);
      autopsies += 1;
      const learn = registerLearningCandidate043(autopsy, artRoot);
      if (learn.registered) learningCandidates += 1;
      upsertPrediction043(store043, { ...pred, status: "AUTOPSY_DONE", updated_at: nowIso });
    }
  }

  writeDailyReport043({
    store039,
    store043,
    modelVersion,
    creditsRemaining: remainingCredits042(loadCreditState042(srcRoot)),
    date: nowIso.slice(0, 10),
  });

  const soccerEvents = store043.catalog.filter((c) => c.sport === "soccer").length;
  const tennisEvents = store043.catalog.filter((c) => c.sport === "tennis").length;

  return {
    catalogInserted: cat.inserted,
    analyzed,
    partial,
    lockedFormal,
    candidates,
    strong,
    snapshotsWritten,
    triangulations,
    autopsies,
    learningCandidates,
    settled: settledVerified039(store039),
    tennisEvents,
    soccerEvents,
    creditsRemaining: remainingCredits042(loadCreditState042(srcRoot)),
    modelVersion,
    collector042,
  };
}
