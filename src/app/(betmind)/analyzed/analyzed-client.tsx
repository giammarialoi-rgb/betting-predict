"use client";

import { useCallback, useState } from "react";
import { AnalyzedTicker } from "@/components/betmind/AnalyzedTicker";
import { RefreshEventsButton } from "@/components/betmind/RefreshEventsButton";
import { Card, EmptyState, SnapshotBadge } from "@/components/betmind/ui";
import { useBetMindData } from "@/components/betmind/DataProvider";
import type { AnalyzedListRow } from "@/domain/eval/light-analysis/types";

export function AnalyzedClient({
  initialEvents,
  initialNote,
}: {
  initialEvents: AnalyzedListRow[];
  initialNote: string | null;
}) {
  const { updating, lastUpdate } = useBetMindData();
  const [events, setEvents] = useState<AnalyzedListRow[]>(initialEvents);
  const [note, setNote] = useState<string | null>(initialNote);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/betmind/analyzed", { cache: "no-store" });
      const body = (await res.json()) as {
        events?: AnalyzedListRow[];
        note_it?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setEvents(body.events ?? []);
      setNote(body.note_it ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lettura fallita");
    }
  }, []);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Lista partite</div>
          <h1 className="text-2xl font-bold">Eventi analizzati</h1>
          <p className="bm-prose-muted mt-1 max-w-xl">
            Solo incontri con un’analisi reale (light e/o forte). Lista densa per campionato:
            orario, casa / ospite, stato, 1X2 (favorito in verde), over 1.5 / 2.5 / 3.5, BTTS,
            gol squadra e angoli.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 text-xs">
            <SnapshotBadge updating={updating} />
            <span className="bm-muted">
              {lastUpdate ? new Date(lastUpdate).toLocaleTimeString("it-IT") : "—"}
            </span>
          </div>
          <RefreshEventsButton onDone={() => void load()} />
        </div>
      </div>

      <Card>
        <p className="text-sm">
          <strong>Analisi light</strong> — modello magro sulle fonti gratuite già cablate
          (frequenze da storico club-football / football-data.co.uk, xG Understat se presente,
          fixture ESPN / OpenLigaDB / OpenFootball / TheSportsDB, meteo se ci sono coordinate,
          RSS solo contesto). Meno gate della forte: può mostrare % quando la forte è NO BET.
        </p>
        <p className="mt-2 text-sm">
          <strong>Analisi forte</strong> — modello indipendente attuale, gate invariati
          (copertura ≥ 35%, missing_keys ≤ 45). Se manca, la riga lo dice. Le quote restano
          solo confronto mercato.
        </p>
      </Card>

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      {events.length > 0 && <AnalyzedTicker events={events} />}

      {events.length === 0 && (
        <EmptyState
          title="Nessun evento analizzato"
          reason={
            note ??
            "Non c’è ancora un’analisi light o forte persistita. Premi «Aggiorna eventi» per ricalcolare dai dati già disponibili. Niente di inventato."
          }
        />
      )}
    </div>
  );
}
