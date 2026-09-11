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
          ? "Nessun evento con analisi light o forte persistita. Premi «Aggiorna eventi» per ricalcolare dalle fonti già cablate."
          : null
      }
    />
  );
}
