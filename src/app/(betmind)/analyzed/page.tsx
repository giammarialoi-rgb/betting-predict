import { AnalyzedClient } from "@/app/(betmind)/analyzed/analyzed-client";
import { listAnalyzedEvents } from "@/domain/eval/light-analysis/list";

export const dynamic = "force-dynamic";

export default async function AnalyzedPage() {
  let events: Awaited<ReturnType<typeof listAnalyzedEvents>> = [];
  let note: string | null =
    "Nessun analysis_dossier. Esegui pnpm analyze:board (o analyze:event). Light storico è etichettato a parte.";
  try {
    events = await listAnalyzedEvents();
    note =
      events.length === 0
        ? "Nessun analysis_dossier. Esegui pnpm analyze:board (o analyze:event). Light storico è etichettato a parte."
        : null;
  } catch {
    note = "Lettura analizzati non disponibile su questo host. Niente di inventato.";
  }
  return <AnalyzedClient initialEvents={events} initialNote={note} />;
}
