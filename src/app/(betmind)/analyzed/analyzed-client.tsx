"use client";

import { useCallback, useState } from "react";
import { AnalyzedTicker } from "@/components/betmind/AnalyzedTicker";
import { RefreshEventsButton } from "@/components/betmind/RefreshEventsButton";
import { EmptyState } from "@/components/betmind/ui";
import type { AnalyzedListRow } from "@/domain/eval/light-analysis/types";

export function AnalyzedClient({
  initialEvents,
  initialNote,
}: {
  initialEvents: AnalyzedListRow[];
  initialNote: string | null;
}) {
  const [events, setEvents] = useState<AnalyzedListRow[]>(initialEvents);
  const [note, setNote] = useState<string | null>(initialNote);
  const [error, setError] = useState<string | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [refreshErr, setRefreshErr] = useState<string | null>(null);

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
    <div className="bm-analyzed">
      <div className="bm-analyzed-head">
        <div>
          <h1>Analizzati</h1>
          <p>Dossier reali del pipeline (Forte) e, se presenti, frequenze light da storico. Niente probabilità inventate.</p>
        </div>
        <RefreshEventsButton
          hideStatus
          onProgress={(msg, err) => {
            setRefreshNote(msg);
            setRefreshErr(err);
          }}
          onDone={() => void load()}
        />
      </div>

      {(refreshNote || refreshErr) && (
        <p className={`bm-analyzed-note${refreshErr ? " is-err" : ""}`}>
          {refreshErr ?? refreshNote}
        </p>
      )}

      {error && <p className="bm-analyzed-note is-err">{error}</p>}

      {events.length > 0 && <AnalyzedTicker events={events} />}

      {events.length === 0 && (
        <EmptyState
          title="Nessuna analisi"
          reason={
            note ??
            "Nessun analysis_dossier. Esegui pnpm analyze:event."
          }
        />
      )}
    </div>
  );
}
