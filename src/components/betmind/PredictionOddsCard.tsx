"use client";

import Link from "next/link";
import { OddsBlock } from "@/components/betmind/OddsBlock";
import {
  Metric,
  Pill,
  asRecord,
  fmtN,
  fmtWhen,
} from "@/components/betmind/ui";
import {
  decisionLabelIt,
  eventStatusIt,
  marketLabelIt,
  selectionLabelIt,
} from "@/domain/eval/betmind-runtime/status-copy";

export type PredictionEvent = Record<string, unknown>;

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pct(v: unknown): string {
  const n = num(v);
  if (n == null) return "—";
  const x = n <= 1 ? n * 100 : n;
  return `${fmtN(x, 1)}%`;
}


function modelProbs(ev: PredictionEvent): Record<string, number> | null {
  const pm = asRecord(ev.probability_model);
  if (!pm) return null;
  const HOME = num(pm.HOME);
  const DRAW = num(pm.DRAW);
  const AWAY = num(pm.AWAY);
  if (HOME == null && DRAW == null && AWAY == null) return null;
  return {
    ...(HOME != null ? { HOME } : {}),
    ...(DRAW != null ? { DRAW } : {}),
    ...(AWAY != null ? { AWAY } : {}),
  };
}

function independentStatus(ev: PredictionEvent): {
  kind: "model" | "insufficient" | "no_bet" | "pending";
  label: string;
} {
  const model = modelProbs(ev);
  const raw = String(ev.decision ?? ev.prediction_status ?? ev.calendar_bucket ?? "");
  const label = decisionLabelIt(raw);
  if (model) return { kind: "model", label };
  if (/INSUFFICIENT/i.test(raw)) return { kind: "insufficient", label: "Dati insufficienti" };
  if (/NO_BET|SKIP|HOLD/i.test(raw)) return { kind: "no_bet", label };
  return { kind: "pending", label };
}

function pickSelection(probs: Record<string, number> | null): string | null {
  if (!probs) return null;
  let best: string | null = null;
  let bestV = -1;
  for (const k of ["HOME", "DRAW", "AWAY"]) {
    const v = probs[k];
    if (v != null && v > bestV) {
      best = k;
      bestV = v;
    }
  }
  return best;
}

export function PredictionOddsCard({
  event: ev,
  href,
}: {
  event: PredictionEvent;
  href?: string;
}) {
  const home = String(ev.home_or_a ?? "").trim();
  const away = String(ev.away_or_b ?? "").trim();
  const title = home && away ? `${home} vs ${away}` : String(ev.label ?? ev.event_id ?? "Partita");
  const model = modelProbs(ev);
  const status = independentStatus(ev);
  const pick = pickSelection(model);
  const marketName = marketLabelIt(String(ev.odds_market ?? (ev.markets as string[] | undefined)?.[0] ?? "1X2"));
  const kick = String(ev.kickoff_utc ?? "");
  const matchStatus = eventStatusIt(String(ev.status ?? ""));
  const inner = (
    <article className="bm-pred-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="bm-section-label">{String(ev.competition ?? "—")}</div>
          <h3 className="mt-0.5 text-lg font-semibold leading-snug">{title}</h3>
          <p className="mt-0.5 text-sm bm-muted">
            {kick ? fmtWhen(kick) : "Orario non disponibile"}
            {ev.status ? ` · ${matchStatus}` : ""}
            {` · ${marketName}`}
          </p>
        </div>
        <Pill tone={status.kind === "model" ? "accent" : status.kind === "insufficient" ? "warn" : "neutral"}>
          {status.label}
        </Pill>
      </div>

      <div className="bm-split mt-3">
        <div className="bm-panel-model">
          <div className="bm-section-label">Previsione indipendente</div>
          {model ? (
            <>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <Metric label="Casa" value={pct(model.HOME)} accent />
                <Metric label="Pareggio" value={pct(model.DRAW)} />
                <Metric label="Trasferta" value={pct(model.AWAY)} />
              </div>
              {pick ? (
                <p className="mt-2 text-xs">
                  Esito più probabile: <strong>{selectionLabelIt(pick)}</strong>
                </p>
              ) : null}
            </>
          ) : (
            <p className="mt-2 text-sm bm-muted">
              {status.kind === "insufficient"
                ? "Dati insufficienti per una previsione indipendente. Niente di inventato."
                : status.kind === "no_bet"
                  ? "Nessuna scommessa: il modello non ha una quota-azione su questa partita."
                  : "Previsione non ancora disponibile."}
            </p>
          )}
        </div>

        <div className="bm-panel-market">
          <OddsBlock event={ev} />
        </div>
      </div>

      {href ? (
        <span className="mt-3 inline-block text-xs bm-accent">Vedi analisi completa</span>
      ) : null}
    </article>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}
