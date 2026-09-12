/**
 * Analizzati list: real analysis_dossier rows plus optional light historical %.
 * Never synthesizes strong analysis from board_summary.
 */
import { loadDossierNeon } from "@/domain/eval/betmind-runtime/dossier";
import type { AnalysisDossier } from "@/domain/eval/betmind-runtime/dossier";
import { isRealAnalysisDossier, readRemoteMirror } from "@/domain/eval/betmind-runtime/remote-mirror";
import { getStorage } from "@/domain/storage";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
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
    light_label_it: light ? "Light" : null,
    strong_label_it: strong ? "Forte" : null,
    strong_unavailable_it: strong ? null : analysis.strong_unavailable_it,
    favorite_1x2: analysis.favorite_1x2,
    markets: analysis.markets,
    prose: analysis.prose,
    sources_used: analysis.sources_used,
  };
}

function dossierToRow(dossier: AnalysisDossier): AnalyzedListRow | null {
  try {
    const event = dossier.event;
    if (!event?.event_id || !event.home || !event.away) return null;
    const im = dossier.independent_model;
    const p = im?.probability;
    const favorite =
      p && typeof p.HOME === "number" && typeof p.DRAW === "number" && typeof p.AWAY === "number"
        ? p.HOME >= p.DRAW && p.HOME >= p.AWAY
          ? "home"
          : p.AWAY >= p.DRAW
            ? "away"
            : "draw"
        : null;
    return {
      event_id: event.event_id,
      home: event.home,
      away: event.away,
      competition: event.competition ?? null,
      kickoff_utc: event.kickoff_utc,
      sport: event.sport,
      status: event.status,
      score_home: null,
      score_away: null,
      analyzed_at: dossier.analyzed_at,
      light: false,
      strong: true,
      light_label_it: null,
      strong_label_it: "Forte",
      strong_unavailable_it: p
        ? null
        : "NO_PREDICTION / INSUFFICIENT DATA — nessuna probabilità inventata",
      favorite_1x2: favorite,
      markets: [],
      prose: [im?.note ?? "", im?.decision ? `decision=${im.decision}` : ""].filter(Boolean),
      sources_used: dossier.lineage?.sources_consulted ?? [],
    };
  } catch {
    return null;
  }
}

export async function listAnalyzedEvents(cwd = process.cwd()): Promise<AnalyzedListRow[]> {
  const byId = new Map<string, AnalyzedListRow>();

  try {
    for (const row of (await loadAllLightAnalyses(cwd)).map(toRow)) {
      if (row) byId.set(row.event_id, row);
    }
  } catch {
    /* ephemeral / read-only FS — remote dossiers remain the SoT on Vercel */
  }

  try {
    const storage = getStorage(permanentRoot044());
    for (const listed of storage.listDossiers()) {
      if (!isRealAnalysisDossier(listed.payload)) continue;
      const strong = dossierToRow(listed.payload as AnalysisDossier);
      if (!strong) continue;
      const prev = byId.get(strong.event_id);
      byId.set(
        strong.event_id,
        prev
          ? {
              ...prev,
              ...strong,
              light: prev.light,
              light_label_it: prev.light_label_it,
              markets: prev.markets,
              prose: [...prev.prose, ...strong.prose],
            }
          : strong,
      );
    }
  } catch {
    /* Vercel has no writable Lab B — do not 500 */
  }

  try {
    const remote = await readRemoteMirror();
    for (const row of remote?.dossiers ?? []) {
      if (!isRealAnalysisDossier(row.dossier)) continue;
      const strong = dossierToRow(row.dossier as AnalysisDossier);
      if (!strong) continue;
      const prev = byId.get(strong.event_id);
      byId.set(strong.event_id, prev ? { ...prev, strong: true, strong_label_it: "Forte" } : strong);
    }
  } catch {
    /* Blob unread — return whatever we have, including empty */
  }

  const rows = [...byId.values()];
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
