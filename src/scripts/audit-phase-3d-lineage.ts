/**
 * Phase 3D — counter audit + one-event lineage from Lab B disk.
 * Usage: pnpm exec tsx src/scripts/audit-phase-3d-lineage.ts [event_id]
 */
import { config } from "dotenv";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import { buildAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import { latestResearchBySource } from "@/domain/eval/data-intelligence/research/status";
import { computePipelineCounters3d } from "@/domain/eval/betmind-runtime/pipeline-counters";

config({ path: ".env.local" });
config({ path: ".env" });

function readJsonl(path: string): Record<string, unknown>[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l.replace(/^\uFEFF/, "")) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
}

function main() {
  const root = permanentRoot044();
  const preds = readJsonl(join(root, "predictions.jsonl"));
  const events = readJsonl(join(root, "events.jsonl"));
  const pipeline = computePipelineCounters3d(root);

  const byEvent = new Map<string, Record<string, unknown>>();
  for (const p of preds) {
    const id = String(p.event_id ?? "");
    if (!id) continue;
    const prev = byEvent.get(id);
    if (!prev || String(p.timestamp ?? "") >= String(prev.timestamp ?? "")) byEvent.set(id, p);
  }
  const latest = [...byEvent.values()];
  const withModel = latest.filter(
    (p) => p.probability_model && typeof p.probability_model === "object",
  );

  const preferred =
    process.argv[2] ??
    withModel[0]?.event_id ??
    latest.find((p) => String(p.event_id ?? "").length > 0)?.event_id;
  const eventId = String(preferred ?? "");

  const dossier = eventId ? buildAnalysisDossier(eventId, root) : null;
  const researchRows = eventId ? latestResearchBySource(eventId, root) : [];
  const eventRow = events.find((e) => e.event_id === eventId) ?? null;
  const pred = byEvent.get(eventId) ?? null;

  const snapPath = join(piRoot(root), "reasoning", "snapshots.jsonl");
  let reasoning: Record<string, unknown> | null = null;
  if (existsSync(snapPath) && eventId) {
    const lines = readFileSync(snapPath, "utf8").split(/\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const row = JSON.parse(lines[i]!) as Record<string, unknown>;
        if (row.event_id === eventId) {
          reasoning = row;
          break;
        }
      } catch {
        /* skip */
      }
    }
  }

  const report = {
    at: new Date().toISOString(),
    real_money: false as const,
    scrape_enters_model: false as const,
    odds_enter_model: false as const,
    counters: pipeline,
    answers: {
      q1_reached_independent_inference: pipeline.model_inferences,
      q2_insufficient_data: pipeline.insufficient_data,
      q3_no_independent_features: pipeline.no_independent_features,
      q3_note:
        "System uses NO_INDEPENDENT_MODEL (not NO_INDEPENDENT_FEATURES). NO_INDEPENDENT_MODEL count=" +
        pipeline.no_independent_model,
      q4_at_least_one_research_observation: pipeline.events_with_research,
      q5_multiple_independent_research_sources: pipeline.events_with_multi_research_sources,
      q6_persisted_prediction: pipeline.predictions_persisted_events,
      q7_analyzed_means: pipeline.legacy_analyzed_meaning,
    },
    lineage_event_id: eventId || null,
    lineage: eventId
      ? {
          event: eventRow
            ? {
                event_id: eventId,
                home: eventRow.home_or_a,
                away: eventRow.away_or_b,
                competition: eventRow.competition,
                kickoff_utc: eventRow.kickoff_utc,
                sport: eventRow.sport,
              }
            : null,
          source_fetches: researchRows,
          prediction: pred
            ? {
                prediction_id: pred.prediction_id,
                timestamp: pred.timestamp,
                model_version: pred.model_version,
                probability_model: pred.probability_model,
                probability_market: pred.probability_market,
                reason_codes: pred.reason_codes,
                confidence_score: pred.confidence_score,
                edge_absolute: pred.edge_absolute,
                odds_in_model: false,
              }
            : null,
          reasoning: reasoning
            ? {
                model_version: reasoning.model_version,
                feature_snapshot: reasoning.feature_snapshot,
                feature_data: reasoning.feature_data,
                model_probability: reasoning.model_probability,
                market_probability: reasoning.market_probability,
                feature_coverage: reasoning.feature_coverage,
                why: reasoning.why,
                at: reasoning.at,
              }
            : null,
          dossier_lineage: dossier?.lineage ?? null,
          dossier_summary: dossier
            ? {
                features_n: dossier.features.length,
                features_entered_model: dossier.features.filter((f) => f.entered_model).length,
                research_n: dossier.research.length,
                independent_note: dossier.independent_model.note,
              }
            : null,
        }
      : null,
  };

  const outDir = join(process.cwd(), "artifacts", "phase-3d");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "lineage-report.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.answers, null, 2));
  console.log(`\nWrote ${outPath}`);
  if (dossier?.lineage) {
    console.log("\nLineage Q&A:");
    console.log(JSON.stringify(dossier.lineage, null, 2));
  }
}

main();
