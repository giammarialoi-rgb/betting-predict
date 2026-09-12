import { EventDetailClient } from "@/app/(betmind)/events/[id]/event-detail-client";
import { loadEventAnalyses } from "@/domain/eval/light-analysis/list";
import { loadBoardEventNeon, loadDossierNeon } from "@/domain/eval/betmind-runtime/dossier";
import { boardSummaryFromBoard, liveViewFromRow } from "@/domain/eval/betmind-runtime/event-detail-view";
import {
  findLiveInRemoteMirror,
  findSettlementInRemoteMirror,
  readRemoteMirror,
} from "@/domain/eval/betmind-runtime/remote-mirror";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { light, strong_available } = await loadEventAnalyses(id);
  const dossier = await loadDossierNeon(id);
  const art = await readRemoteMirror();
  const live = liveViewFromRow(findLiveInRemoteMirror(art, id));
  const remoteSettlement = findSettlementInRemoteMirror(art, id);
  const settlement = remoteSettlement
    ? {
        result: String(remoteSettlement.result ?? "N/A"),
        outcome: String(remoteSettlement.outcome ?? "N/A"),
        settled_at: String(remoteSettlement.settled_at ?? "N/A"),
      }
    : null;

  if (dossier) {
    const noPred = dossier.independent_model.probability == null;
    return (
      <EventDetailClient
        initialData={{
          event: {
            event_id: dossier.event.event_id,
            sport: dossier.event.sport,
            competition: dossier.event.competition,
            home_or_a: dossier.event.home,
            away_or_b: dossier.event.away,
            kickoff_utc: dossier.event.kickoff_utc,
            semantic_level: "N/A",
            status: live?.status ?? dossier.event.status,
          },
          predictions: [
            {
              selection: null,
              confidence_score: dossier.independent_model.confidence ?? 0,
              human_readable_reason: dossier.independent_model.note ?? "NO PREDICTION",
              probability_model: dossier.independent_model.probability,
              probability_market: dossier.market.probability,
              model_version: dossier.independent_model.model_version ?? dossier.cycle.model_version ?? "N/A",
              reason_codes: dossier.independent_model.reason_codes,
              prediction_id: dossier.prediction_id,
              timestamp: dossier.analyzed_at,
            },
          ],
          settlement,
          live,
          dossier,
          light_analysis: light,
          analysis_modes: {
            light: {
              label_it: "Light",
              available: Boolean(light && light.markets.some((m) => m.status === "OK")),
            },
            strong: {
              label_it: "Forte",
              available: strong_available || Boolean(dossier.independent_model.probability),
              unavailable_it:
                strong_available || dossier.independent_model.probability
                  ? null
                  : (light?.strong_unavailable_it ?? "Forte non disponibile — NO PREDICTION."),
            },
          },
          api_calls_ui: 0 as const,
          model_version: dossier.cycle.model_version,
          prediction_kind: noPred ? "NO_PREDICTION" : "PREDICTION",
        } as never}
      />
    );
  }

  const board = light ? null : await loadBoardEventNeon(id);
  if (!light) {
    return (
      <EventDetailClient
        initialData={null}
        initialBoardSummary={board ? boardSummaryFromBoard(id, board) : null}
      />
    );
  }
  const initialData = {
    event: {
      event_id: light.event_id,
      sport: light.sport,
      competition: light.competition ?? String(board?.competition ?? "N/A"),
      home_or_a: light.home,
      away_or_b: light.away,
      kickoff_utc: light.kickoff_utc,
      semantic_level: "N/A",
      status: live?.status ?? light.status ?? undefined,
    },
    predictions: [],
    settlement: null,
    live,
    light_analysis: light,
    analysis_modes: {
      light: {
        label_it: "Light",
        available: light.markets.some((m) => m.status === "OK"),
      },
      strong: {
        label_it: "Forte",
        available: strong_available,
        unavailable_it: strong_available ? null : light.strong_unavailable_it,
      },
    },
    api_calls_ui: 0 as const,
    model_version: null,
  };
  return <EventDetailClient initialData={initialData as never} />;
}
