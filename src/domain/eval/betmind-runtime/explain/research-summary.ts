/**
 * Structured research summary — text is generated FROM this object.
 * Never treat a prose blob as source of truth.
 */
import { catalogueById } from "@/domain/eval/data-intelligence/research/source-catalogue";
import {
  FEATURE_GROUPS,
  classifyFeatureQuality,
  featureGroupOf,
  featureLabelIt,
  type FeatureGroupId,
  type FeatureQualityKind,
} from "@/domain/eval/betmind-runtime/explain/feature-dictionary";
import {
  classifyHumanSourceStatus,
  sourceFailureReasonIt,
  sourceTitleIt,
  type HumanSourceStatus,
  type ResearchLike,
} from "@/domain/eval/betmind-runtime/explain/source-status";

export type FeatureLike = {
  name: string;
  value: number | string | null;
  source: string;
  status: string;
  entered_model: boolean;
  available_at?: string | null;
};

export type TimelineFact = {
  at: string | null;
  label_it: string;
  fact_key: string;
};

export type ResearchSummary = {
  sources_attempted: number;
  sources_successful: number;
  sources_partial: number;
  sources_blocked: number;
  sources_missing_adapter: number;
  sources_no_data: number;
  sources_no_event: number;
  sources_policy_denied: number;
  sources_http_error: number;
  sources_rate_limited: number;
  sources_parse_error: number;
  source_rows: Array<{
    source_id: string;
    title: string;
    human_status: HumanSourceStatus;
    fetched: boolean;
    ok: boolean;
    http_status: number | null;
    fetched_at: string | null;
    fields_extracted: string[];
    market_layer: boolean;
    reason_it: string;
    public_url: string | null;
  }>;
  feature_groups_found: FeatureGroupId[];
  feature_groups_missing: FeatureGroupId[];
  feature_quality: Record<FeatureQualityKind, number>;
  origin: {
    live_research_sources: number;
    historical_prior_features: number;
    derived_features: number;
    static_context_features: number;
    market_sources: number;
  };
  model_inputs: Array<{
    key: string;
    label_it: string;
    value: number | string | null;
    quality: FeatureQualityKind;
    group: FeatureGroupId;
  }>;
  model_exclusions: Array<{
    key: string;
    label_it: string;
    reason_it: string;
    quality: FeatureQualityKind;
  }>;
  explanation_facts: string[];
  timeline: TimelineFact[];
  prediction_snapshot: {
    prediction_time: string | null;
    model_version: string | null;
    has_independent_inference: boolean;
    odds_entered_model: false;
    feature_count_entered: number;
    feature_coverage: number | null;
  };
};

function countStatus(rows: Array<{ human_status: HumanSourceStatus }>, s: HumanSourceStatus): number {
  return rows.filter((r) => r.human_status === s).length;
}

export function buildResearchSummary(input: {
  home: string;
  away: string;
  features: FeatureLike[];
  research: Array<
    ResearchLike & {
      fetched_at?: string | null;
      url?: string | null;
    }
  >;
  prediction_time: string | null;
  model_version: string | null;
  feature_coverage: number | null;
  has_independent_inference: boolean;
  event_identified_at?: string | null;
}): ResearchSummary {
  const source_rows = input.research.map((r) => {
    const cat = catalogueById(r.source_id);
    const human_status = classifyHumanSourceStatus(r);
    return {
      source_id: r.source_id,
      title: sourceTitleIt(r.source_id, cat?.title),
      human_status,
      fetched: r.fetched === true,
      ok: r.ok === true,
      http_status: r.http_status ?? null,
      fetched_at: r.fetched_at ?? null,
      fields_extracted: r.fields_extracted ?? [],
      market_layer: cat?.market_layer === true,
      reason_it: sourceFailureReasonIt(r),
      public_url: cat?.url ?? r.url ?? null,
    };
  });

  const model_inputs = input.features
    .filter((f) => f.entered_model && f.value != null)
    .map((f) => ({
      key: f.name,
      label_it: featureLabelIt(f.name, input.home, input.away),
      value: f.value,
      quality: classifyFeatureQuality({
        key: f.name,
        value: f.value,
        status: f.status,
        entered_model: true,
        source: f.source,
      }),
      group: featureGroupOf(f.name),
    }));

  const model_exclusions = input.features
    .filter((f) => !f.entered_model)
    .map((f) => {
      const quality = classifyFeatureQuality({
        key: f.name,
        value: f.value,
        status: f.status,
        entered_model: false,
        source: f.source,
      });
      const reason_it =
        quality === "MISSING"
          ? "Nessun valore ammissibile al momento della previsione."
          : quality === "EXCLUDED"
            ? "Presente ma non usato come input del modello indipendente."
            : `Stato ${f.status}.`;
      return {
        key: f.name,
        label_it: featureLabelIt(f.name, input.home, input.away),
        reason_it,
        quality,
      };
    });

  const found = new Set<FeatureGroupId>(model_inputs.map((f) => f.group));
  const missing = FEATURE_GROUPS.map((g) => g.id).filter((id) => !found.has(id) && id !== "ALTRO");

  const feature_quality: Record<FeatureQualityKind, number> = {
    REAL: 0,
    DERIVED: 0,
    HISTORICAL_PRIOR: 0,
    MISSING: 0,
    STALE: 0,
    INVALID: 0,
    EXCLUDED: 0,
  };
  for (const f of model_inputs) feature_quality[f.quality] += 1;
  for (const f of model_exclusions) feature_quality[f.quality] += 1;

  const explanation_facts: string[] = [];
  explanation_facts.push(`sources_attempted=${source_rows.length}`);
  explanation_facts.push(`sources_successful=${countStatus(source_rows, "SUCCESS")}`);
  explanation_facts.push(`model_inputs=${model_inputs.length}`);
  explanation_facts.push(`has_inference=${input.has_independent_inference}`);
  explanation_facts.push("odds_entered_model=false");

  const timeline: TimelineFact[] = [];
  if (input.event_identified_at) {
    timeline.push({
      at: input.event_identified_at,
      label_it: "Evento identificato",
      fact_key: "event_identified",
    });
  }
  for (const s of source_rows) {
    if (!s.fetched_at) continue;
    if (s.human_status === "SUCCESS" || s.human_status === "PARTIAL") {
      timeline.push({
        at: s.fetched_at,
        label_it: `${s.title} consultato`,
        fact_key: `source_ok:${s.source_id}`,
      });
    } else if (s.human_status === "BLOCKED") {
      timeline.push({
        at: s.fetched_at,
        label_it: `${s.title} non accessibile${s.http_status ? ` (HTTP ${s.http_status})` : ""}`,
        fact_key: `source_blocked:${s.source_id}`,
      });
    }
  }
  if (input.prediction_time && input.has_independent_inference) {
    timeline.push({
      at: input.prediction_time,
      label_it: "Modello indipendente eseguito e previsione salvata",
      fact_key: "prediction_persisted",
    });
  } else if (input.prediction_time) {
    timeline.push({
      at: input.prediction_time,
      label_it: "Analisi persistita senza inference indipendente",
      fact_key: "prediction_row_no_inference",
    });
  }
  timeline.sort((a, b) => String(a.at ?? "").localeCompare(String(b.at ?? "")));

  return {
    sources_attempted: source_rows.length,
    sources_successful: countStatus(source_rows, "SUCCESS"),
    sources_partial: countStatus(source_rows, "PARTIAL"),
    sources_blocked: countStatus(source_rows, "BLOCKED"),
    sources_missing_adapter: countStatus(source_rows, "MISSING_ADAPTER"),
    sources_no_data: countStatus(source_rows, "NO_DATA"),
    sources_no_event: countStatus(source_rows, "NO_EVENT"),
    sources_policy_denied: countStatus(source_rows, "DISABLED_BY_POLICY"),
    sources_http_error: countStatus(source_rows, "HTTP_ERROR"),
    sources_rate_limited: countStatus(source_rows, "RATE_LIMITED"),
    sources_parse_error: countStatus(source_rows, "PARSE_ERROR"),
    source_rows,
    feature_groups_found: FEATURE_GROUPS.map((g) => g.id).filter((id) => found.has(id)),
    feature_groups_missing: missing,
    feature_quality,
    origin: {
      live_research_sources: source_rows.filter(
        (r) =>
          !r.market_layer &&
          (r.human_status === "SUCCESS" || r.human_status === "PARTIAL") &&
          r.source_id !== "football-data-co-uk" &&
          r.source_id !== "club-football-match-data",
      ).length,
      historical_prior_features: model_inputs.filter((f) => f.quality === "HISTORICAL_PRIOR").length,
      derived_features: model_inputs.filter((f) => f.quality === "DERIVED").length,
      static_context_features: model_inputs.filter(
        (f) => f.quality === "DERIVED" && (f.key === "home_advantage" || f.key === "season_phase"),
      ).length,
      market_sources: source_rows.filter((r) => r.market_layer && r.fetched).length,
    },
    model_inputs,
    model_exclusions,
    explanation_facts,
    timeline,
    prediction_snapshot: {
      prediction_time: input.prediction_time,
      model_version: input.model_version,
      has_independent_inference: input.has_independent_inference,
      odds_entered_model: false,
      feature_count_entered: model_inputs.length,
      feature_coverage: input.feature_coverage,
    },
  };
}