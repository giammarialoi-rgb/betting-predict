/**
 * Data-yield metrics: observations collected, not request counts.
 * SUCCESS = event-related observations, never HTTP 200 alone.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

export type DataYieldSummary = {
  total_observations: number;
  real_event_observations: number;
  historical_observations: number;
  derived_observations: number;
  context_observations: number;
  market_observations: number;
  model_eligible_observations: number;
  events_with_real_event_data: number;
  events_with_historical_data: number;
  by_source: Record<string, number>;
  by_category: Record<string, number>;
  data_yield: number;
};

function categoryOf(key: string): string {
  const k = key.toLowerCase();
  if (k.includes("elo")) return "forza";
  if (k.includes("h2h")) return "h2h";
  if (k.includes("xg")) return "xg";
  if (k.includes("injur") || k.includes("infortun")) return "infortunii";
  if (k.includes("lineup") || k.includes("xi")) return "formazioni";
  if (k.includes("ref") || k.includes("arbit")) return "arbitro";
  if (k.includes("temp") || k.includes("precip") || k.includes("wind") || k.includes("humid") || k.includes("weather"))
    return "meteo";
  if (k.includes("rss") || k.includes("news")) return "news";
  if (/_l(3|5|10)$/.test(k) || k.includes("form")) return "forma";
  if (k.includes("shot") || k.includes("sot") || k.includes("gf") || k.includes("attack")) return "attacco";
  if (k.includes("ga") || k.includes("cs") || k.includes("defense")) return "difesa";
  if (k.includes("corner") || k.includes("card")) return "set_pieces";
  return "altro";
}

export function summarizeObservations(
  obs: ResearchObservation[],
  attempts = 0,
): DataYieldSummary {
  const by_source: Record<string, number> = {};
  const by_category: Record<string, number> = {};
  const eventsReal = new Set<string>();
  const eventsHist = new Set<string>();
  let real_event = 0;
  let historical = 0;
  let derived = 0;
  let context = 0;
  let market = 0;
  let model_eligible = 0;
  for (const o of obs) {
    by_source[o.source] = (by_source[o.source] ?? 0) + 1;
    const cat = categoryOf(o.feature_key);
    by_category[cat] = (by_category[cat] ?? 0) + 1;
    if (o.enters_independent_model) model_eligible += 1;
    if (o.kind === "MARKET" || o.source === "the-odds-api") {
      market += 1;
      continue;
    }
    if (o.kind === "EVENT_RESEARCH") {
      real_event += 1;
      eventsReal.add(o.event_id);
    } else if (o.kind === "HISTORICAL_PRIOR") {
      historical += 1;
      eventsHist.add(o.event_id);
    } else if (o.kind === "DERIVED") {
      derived += 1;
      eventsHist.add(o.event_id);
    } else if (o.status === "CONTEXT" || o.kind === "CONTEXT") {
      context += 1;
      if (o.source === "open-meteo" || o.source === "ansa" || o.source === "sky-sports") {
        real_event += 1;
        eventsReal.add(o.event_id);
      }
    } else if (o.status === "REAL") {
      historical += 1;
      eventsHist.add(o.event_id);
    }
  }
  return {
    total_observations: obs.length,
    real_event_observations: real_event,
    historical_observations: historical,
    derived_observations: derived,
    context_observations: context,
    market_observations: market,
    model_eligible_observations: model_eligible,
    events_with_real_event_data: eventsReal.size,
    events_with_historical_data: eventsHist.size,
    by_source,
    by_category,
    data_yield: attempts > 0 ? Math.round((obs.length / attempts) * 1000) / 1000 : obs.length,
  };
}

export function loadAllResearchObservations(root = permanentRoot044(), limit = 20000): ResearchObservation[] {
  const p = join(root, "research-observations.jsonl");
  if (!existsSync(p)) return [];
  const lines = readFileSync(p, "utf8").split(/\n/).filter(Boolean);
  const slice = lines.slice(Math.max(0, lines.length - limit));
  const out: ResearchObservation[] = [];
  for (const line of slice) {
    try {
      out.push(JSON.parse(line.replace(/^\uFEFF/, "")) as ResearchObservation);
    } catch {
      /* skip */
    }
  }
  return out;
}
