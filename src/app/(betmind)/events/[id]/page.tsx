import { EventDetailClient } from "@/app/(betmind)/events/[id]/event-detail-client";
import { loadEventAnalyses } from "@/domain/eval/light-analysis/list";
import { loadBoardEventNeon } from "@/domain/eval/betmind-runtime/dossier";
import { boardSummaryFromBoard } from "@/domain/eval/betmind-runtime/event-detail-view";

export const dynamic = "force-dynamic";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { light, strong_available } = await loadEventAnalyses(id);
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
      status: light.status ?? undefined,
    },
    predictions: [],
    settlement: null,
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
