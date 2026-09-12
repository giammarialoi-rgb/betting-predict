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
          ? "Nessun analysis_dossier. Esegui pnpm analyze:event su una partita futura. Light storico è etichettato a parte."
          : null
      }
    />
  );
}
