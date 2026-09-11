import { AnalyzedClient } from "@/app/(betmind)/analyzed/analyzed-client";
import { listAnalyzedEvents } from "@/domain/eval/light-analysis/list";

export const dynamic = "force-dynamic";

export default async function AnalyzedPage() {
  const events = await listAnalyzedEvents();
  return (
    <AnalyzedClient
      initialEvents={events}
      initialNote={
        events.length === 0
          ? "Premi «Aggiorna eventi» per calcolare le percentuali dalle partite già giocate."
          : null
      }
    />
  );
}
