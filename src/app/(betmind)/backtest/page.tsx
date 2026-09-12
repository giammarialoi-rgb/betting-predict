"use client";

import { useEffect, useState } from "react";
import { Card, Pill, Metric, EmptyState } from "@/components/betmind/ui";

type CopyBlock = { kind: "FATTO" | "EVIDENZA" | "IPOTESI"; text: string };
type UiCopy = { title: string; subtitle: string; blocks: CopyBlock[]; disclaimer: string };

type BacktestPayload = {
  neon_in_use?: boolean;
  "ui-copy"?: UiCopy;
  "dataset-manifest"?: {
    total_rows?: number;
    date_min?: string | null;
    date_max?: string | null;
    downloads_ok?: number;
    downloads_fail?: number;
  };
  "backtest-results"?: {
    rows?: number;
    current_production?: string;
    models?: { model_id: string; status?: string; oos_n?: number; supported?: boolean }[];
  };
  "promotion-candidates"?: { promoted_count?: number; candidates?: unknown[] };
};

function tone(kind: CopyBlock["kind"]): "accent" | "warn" | "neutral" {
  if (kind === "FATTO") return "accent";
  if (kind === "IPOTESI") return "warn";
  return "neutral";
}

export default function BacktestPage() {
  const [data, setData] = useState<BacktestPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/betmind/backtest")
      .then((r) => r.json())
      .then((j: BacktestPayload) => {
        if (!cancelled) setData(j);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "errore");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const copy = data?.["ui-copy"];
  const manifest = data?.["dataset-manifest"];
  const results = data?.["backtest-results"];
  const promo = data?.["promotion-candidates"];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div>
        <div className="bm-section-label">Laboratorio OOS</div>
        <h1 className="text-2xl font-bold">Backtest</h1>
        <p className="mt-1 text-sm bm-muted">
          Valutazione fuori campione sul passato. Qualità del modello e profitto restano
          separati. Neon non utilizzato. Nessuna promozione automatica.
        </p>
      </div>

      {error && (
        <Card className="border-[rgba(255,77,77,0.4)]">
          <p className="text-sm text-[var(--bm-danger)]">{error}</p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card title="Corpus">
          <Metric label="Partite" value={String(manifest?.total_rows ?? results?.rows ?? "—")} />
        </Card>
        <Card title="Finestre">
          <Metric
            label="Date"
            value={
              manifest?.date_min && manifest?.date_max
                ? `${manifest.date_min} → ${manifest.date_max}`
                : "—"
            }
          />
        </Card>
        <Card title="Promozione">
          <Metric label="PROMOTED" value={String(promo?.promoted_count ?? 0)} />
        </Card>
      </div>

      <Card title={copy?.title ?? "Cosa abbiamo imparato"} glow>
        <p className="mb-3 text-sm bm-muted">{copy?.subtitle}</p>
        {!copy?.blocks?.length ? (
          <EmptyState title="Nessun report persistito" reason="Esegui pnpm betmind:backtest." />
        ) : (
          <div className="space-y-3">
            {copy.blocks.map((b, i) => (
              <div key={`${b.kind}-${i}`} className="rounded-xl border border-[var(--bm-border)] bg-black/20 p-3">
                <Pill tone={tone(b.kind)}>{b.kind}</Pill>
                <p className="mt-2 text-sm">{b.text}</p>
              </div>
            ))}
          </div>
        )}
        {copy?.disclaimer ? <p className="mt-4 text-xs bm-muted">{copy.disclaimer}</p> : null}
      </Card>

      <Card title="Modelli (OOS)">
        <p className="mb-2 text-xs bm-muted">
          Produzione corrente: {results?.current_production ?? "INDEPENDENT_POISSON_v1"}. Non sostituita da questo lab.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs bm-muted">
              <tr>
                <th className="py-2">Modello</th>
                <th>Stato</th>
                <th>OOS n</th>
                <th>Supportato</th>
              </tr>
            </thead>
            <tbody>
              {(results?.models ?? []).map((m) => (
                <tr key={m.model_id} className="border-t border-[var(--bm-border)]">
                  <td className="py-2">{m.model_id}</td>
                  <td>{m.status ?? "—"}</td>
                  <td>{m.oos_n ?? "—"}</td>
                  <td>{m.supported ? "sì" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
