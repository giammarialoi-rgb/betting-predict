/**
 * Italian deterministic copy from persisted numbers.
 * FATTO / EVIDENZA / IPOTESI — no “BetMind works” claims.
 */
import { PHASE9_NON_DETERMINABILE } from "@/domain/eval/phase-9/types";

function n(v: number | null | undefined, d = 4): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(d);
}

function pct(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

export type Phase9CopyBlock = {
  kind: "FATTO" | "EVIDENZA" | "IPOTESI";
  text: string;
};

export function buildItalianCopy(input: {
  date_min: string | null;
  date_max: string | null;
  total_rows: number;
  windows: number;
  neon: false;
  current_production: string;
  promoted: number;
  models: {
    id: string;
    status: string;
    oos_n: number;
    log_loss: number | null;
    brier: number | null;
    accuracy: number | null;
    supported: boolean;
    reason: string;
  }[];
  naive_log_loss: number | null;
  market_log_loss: number | null;
  chosen_threshold: number | null;
  oos_yield: number | null;
  oos_bets: number | null;
  hypotheses: string[];
}): { title: string; subtitle: string; blocks: Phase9CopyBlock[]; disclaimer: string } {
  const blocks: Phase9CopyBlock[] = [];
  blocks.push({
    kind: "FATTO",
    text:
      input.total_rows > 0
        ? `Il corpus OOS ha ${input.total_rows} partite finite (date ${input.date_min ?? "?"} → ${input.date_max ?? "?"}), ${input.windows} finestre walk-forward. Storage: filesystem. Neon: non utilizzato.`
        : `Nessuna partita storica utilizzabile è stata caricata. ${PHASE9_NON_DETERMINABILE}.`,
  });
  blocks.push({
    kind: "FATTO",
    text: `Modello di produzione corrente: ${input.current_production}. Modelli PROMOTED: ${input.promoted}. La promozione automatica è disattivata.`,
  });
  for (const m of input.models) {
    if (!m.supported) {
      blocks.push({
        kind: "FATTO",
        text: `${m.id} non è stato valutato OOS: ${m.reason}.`,
      });
      continue;
    }
    blocks.push({
      kind: "EVIDENZA",
      text: `${m.id} (${m.status}) su ${m.oos_n} partite OOS: log-loss ${n(m.log_loss)}, Brier ${n(m.brier)}, accuratezza ${pct(m.accuracy)}.`,
    });
  }
  if (input.naive_log_loss != null) {
    blocks.push({
      kind: "EVIDENZA",
      text: `Baseline naive (frequenze di campionato as-of) log-loss ${n(input.naive_log_loss)}. Il confronto di qualità è separato dal profitto.`,
    });
  }
  if (input.market_log_loss != null) {
    blocks.push({
      kind: "EVIDENZA",
      text: `Baseline di mercato (quote OPEN de-vig, non indipendente) log-loss ${n(input.market_log_loss)}. Non è un input del modello.`,
    });
  } else {
    blocks.push({
      kind: "FATTO",
      text: `Baseline di mercato: ${PHASE9_NON_DETERMINABILE} (quote OPEN incomplete).`,
    });
  }
  if (input.chosen_threshold == null) {
    blocks.push({
      kind: "FATTO",
      text: `Soglia di value: non scelta — ${PHASE9_NON_DETERMINABILE} sul validation set.`,
    });
  } else {
    blocks.push({
      kind: "EVIDENZA",
      text: `Soglia edge scelta solo su TRAIN/VAL: ${(input.chosen_threshold * 100).toFixed(0)}%. Su OOS: ${input.oos_bets ?? 0} scommesse, yield ${pct(input.oos_yield)}. Un yield positivo non autorizza la promozione.`,
    });
  }
  for (const h of input.hypotheses.slice(0, 4)) {
    blocks.push({ kind: "IPOTESI", text: h });
  }
  return {
    title: "Cosa abbiamo imparato",
    subtitle: "Numeri persistiti. Non è una garanzia che BetMind predica o vinca.",
    blocks,
    disclaimer:
      "Nessuna percentuale senza requisiti di dati. SEEK TRUTH. Prove sul passato prima di autorizzare il futuro.",
  };
}
