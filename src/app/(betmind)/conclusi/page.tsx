"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, SnapshotBadge, fmtWhen } from "@/components/betmind/ui";

type Concluso = {
  prediction_id: string;
  event_id: string;
  label?: string;
  market: string;
  selection: string;
  prediction_probability: number | null;
  odds_at_prediction: number | null;
  model_version: string | null;
  status: string;
  result: string | null;
  settled_at: string | null;
  pnl_simulated: number | null;
  data_quality: number | null;
};

export default function ConclusiPage() {
  const [rows, setRows] = useState<Concluso[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [source, setSource] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [updating, setUpdating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setUpdating(true);
    fetch("/api/betmind/conclusi")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setRows((body.cases as Concluso[]) ?? []);
        setNote(typeof body.note === "string" ? body.note : null);
        setSource(String(body.source ?? ""));
        setErr(null);
      })
      .catch(() => {
        if (!cancelled) setErr("Impossibile caricare i conclusi.");
      })
      .finally(() => {
        if (!cancelled) setUpdating(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const won = rows.filter((r) => r.status === "WON").length;
  const lost = rows.filter((r) => r.status === "LOST").length;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="bm-section-label">Verifica</div>
          <h1 className="mt-1 text-2xl font-bold">Conclusi</h1>
          <p className="bm-prose-muted mt-2 max-w-xl">
            Previsioni liquidate su risultati reali. Nessun esito inventato.
          </p>
        </div>
        <SnapshotBadge updating={updating} />
      </div>

      {err && (
        <Card>
          <p className="text-sm text-[var(--bm-danger)]">{err}</p>
        </Card>
      )}

      <Card>
        <p className="bm-prose">
          {rows.length} casi · {won} corrette · {lost} errate
          {source ? ` · origine ${source}` : ""}
        </p>
        {note ? <p className="bm-prose-muted mt-2">{note}</p> : null}
      </Card>

      {!rows.length && !updating ? (
        <EmptyState
          title="Nessun concluso"
          reason="Quando una partita termina e il risultato è verificato, compare qui con esito WON/LOST."
        />
      ) : (
        <div className="grid gap-3">
          {rows.map((r) => (
            <Card key={r.prediction_id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link href={`/events/${encodeURIComponent(r.event_id)}`} className="font-semibold">
                    {r.label ?? r.event_id}
                  </Link>
                  <p className="bm-prose-muted mt-1 text-sm">
                    {r.market} · {r.selection}
                    {r.prediction_probability != null
                      ? ` · ${(r.prediction_probability * 100).toFixed(1)}%`
                      : ""}
                  </p>
                </div>
                <span
                  className={
                    r.status === "WON"
                      ? "text-[var(--bm-success)] font-semibold"
                      : r.status === "LOST"
                        ? "text-[var(--bm-danger)] font-semibold"
                        : "bm-muted font-semibold"
                  }
                >
                  {r.status}
                </span>
              </div>
              <p className="bm-prose mt-2 text-sm">
                Risultato: {r.result ?? "non disponibile"}
                {r.pnl_simulated != null ? ` · P/L sim. ${r.pnl_simulated.toFixed(2)}u` : ""}
              </p>
              <p className="bm-prose-muted mt-1 text-xs">
                {r.model_version ?? "modello n/d"}
                {r.settled_at ? ` · liquidato ${fmtWhen(r.settled_at)}` : ""}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
