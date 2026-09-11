/**
 * Analizzati list: events that actually have light and/or strong analysis.
 */
import { loadDossierNeon } from "@/domain/eval/betmind-runtime/dossier";
import { lightHasEstimableMarket } from "@/domain/eval/light-analysis/compute";
import { loadAllLightAnalyses, loadLightAnalysis } from "@/domain/eval/light-analysis/persist";
import type { AnalyzedListRow, LightAnalysis } from "@/domain/eval/light-analysis/types";

function toRow(analysis: LightAnalysis): AnalyzedListRow | null {
  const light = lightHasEstimableMarket(analysis);
  const strong = analysis.strong_available === true;
  if (!light && !strong) return null;
  return {
    event_id: analysis.event_id,
    home: analysis.home,
    away: analysis.away,
    competition: analysis.competition,
    kickoff_utc: analysis.kickoff_utc,
    sport: analysis.sport,
    status: analysis.status,
    score_home: analysis.score_home,
    score_away: analysis.score_away,
    analyzed_at: analysis.analyzed_at,
    light,
    strong,
    light_label_it: light ? "Analisi light" : null,
    strong_label_it: strong ? "Analisi forte" : null,
    strong_unavailable_it: strong ? null : analysis.strong_unavailable_it,
    favorite_1x2: analysis.favorite_1x2,
    markets: analysis.markets,
    prose: analysis.prose,
    sources_used: analysis.sources_used,
  };
}

export async function listAnalyzedEvents(cwd = process.cwd()): Promise<AnalyzedListRow[]> {
  const rows = (await loadAllLightAnalyses(cwd))
    .map(toRow)
    .filter((r): r is AnalyzedListRow => r != null);
  rows.sort((a, b) => {
    const ka = a.kickoff_utc ?? "";
    const kb = b.kickoff_utc ?? "";
    if (ka !== kb) return ka.localeCompare(kb);
    return `${a.competition ?? ""}:${a.home}`.localeCompare(`${b.competition ?? ""}:${b.home}`);
  });
  return rows;
}

export async function loadEventAnalyses(
  eventId: string,
  cwd = process.cwd(),
): Promise<{
  light: LightAnalysis | null;
  strong_available: boolean;
}> {
  const light = await loadLightAnalysis(eventId, cwd);
  if (light) {
    return { light, strong_available: light.strong_available };
  }
  const dossier = await loadDossierNeon(eventId);
  const strong_available = Boolean(dossier?.independent_model.probability);
  return { light: null, strong_available };
}
