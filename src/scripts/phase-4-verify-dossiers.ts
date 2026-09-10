import { loadStore044 } from "@/domain/eval/permanent-044/store";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { buildAnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";

const root = permanentRoot044();
const store = loadStore044(root);
const now = Date.now();
const upcoming = store.events
  .filter((e) => e.kickoff_utc && Date.parse(e.kickoff_utc) >= now)
  .sort((a, b) => Date.parse(a.kickoff_utc!) - Date.parse(b.kickoff_utc!));

const rows = [];
for (const e of upcoming) {
  const d = buildAnalysisDossier(e.event_id, root);
  if (!d) continue;
  const hx = d.human_explanation;
  const rs = d.research_summary;
  rows.push({
    event_id: e.event_id,
    match: `${e.home_or_a} vs ${e.away_or_b}`,
    kickoff: e.kickoff_utc,
    live_research: hx?.live_research ?? null,
    archive: hx?.archive ?? null,
    sources_attempted: rs?.sources_attempted ?? 0,
    live_sources: rs?.origin.live_research_sources ?? 0,
    historical_features: rs?.origin.historical_prior_features ?? 0,
    derived_features: rs?.origin.derived_features ?? 0,
    used_n: hx?.used.length ?? 0,
    used0: hx?.used[0] ?? null,
    missing0: hx?.missing[0] ?? null,
    model: d.independent_model.model_version,
    has_inference: Boolean(d.independent_model.probability),
    coverage: d.independent_model.feature_coverage,
    odds_in_model: false,
    identity_home: d.team_identity?.home.canonical_id ?? null,
    provisional: d.team_identity?.home.provisional ?? null,
    lambda: d.poisson,
    recon0: d.reconciliation?.[0]?.note_it ?? null,
  });
  if (rows.length >= 5) break;
}
console.log(JSON.stringify({ n: rows.length, rows }, null, 2));
