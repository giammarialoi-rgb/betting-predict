/**
 * FRESCHEZZA DEL DATASET — il controllo che nessun backtest puo fare.
 *
 * Il 20 settembre 2026 il modello prezzava Milan-Lecce dando il Milan al 49%
 * contro il 77% del mercato. Non era un difetto del modello: il dataset si
 * fermava alla stagione 2024/25 e ignorava quattordici mesi di calcio.
 *
 * Nessun test lo avrebbe preso. Walk-forward, holdout cieco e bootstrap misurano
 * il modello CONTRO IL PASSATO, e contro il passato funzionava benissimo. Un
 * dataset vecchio supera tutte le validazioni storiche e sbaglia solo sul
 * presente, che e l'unico momento in cui si scommette.
 *
 * Questo modulo confronta la stagione piu recente presente nei dati con quella
 * che dovrebbe essere in corso, e con la data dell'ultima partita registrata.
 */

/** Codice stagione Football-Data (es. "2627" per 2026/27) alla data indicata. */
export function currentSeasonCode(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  // Le stagioni europee iniziano a luglio: prima di luglio si e nella stagione
  // cominciata l'anno precedente.
  const startYear = now.getUTCMonth() >= 6 ? y : y - 1;
  const a = String(startYear % 100).padStart(2, "0");
  const b = String((startYear + 1) % 100).padStart(2, "0");
  return `${a}${b}`;
}

export type FreshnessVerdict = {
  ok: boolean;
  latestSeason: string;
  expectedSeason: string;
  seasonsBehind: number;
  latestMatchIso: string | null;
  daysSinceLatestMatch: number | null;
  problems: string[];
};

function seasonStartYear(code: string): number | null {
  if (!/^\d{4}$/.test(code)) return null;
  const yy = Number(code.slice(0, 2));
  return yy > 50 ? 1900 + yy : 2000 + yy;
}

export function assessFreshness(input: {
  seasons: readonly string[];
  latestMatchIso?: string | null;
  now?: Date;
  /** Giorni oltre i quali l'ultima partita registrata e considerata vecchia. */
  maxDaysSinceMatch?: number;
}): FreshnessVerdict {
  const now = input.now ?? new Date();
  const expected = currentSeasonCode(now);
  const problems: string[] = [];

  const valid = input.seasons.filter((s) => seasonStartYear(s) != null);
  const latest = valid.length
    ? valid.reduce((a, b) => (seasonStartYear(a)! >= seasonStartYear(b)! ? a : b))
    : "";
  const expStart = seasonStartYear(expected)!;
  const latStart = latest ? seasonStartYear(latest)! : expStart - 99;
  const behind = expStart - latStart;

  if (!valid.length) problems.push("nessuna stagione riconoscibile nel dataset");
  else if (behind > 0) {
    problems.push(
      `il dataset arriva alla stagione ${latest} ma quella in corso e ${expected}: ${behind} stagione/i mancanti`,
    );
  }

  let days: number | null = null;
  if (input.latestMatchIso) {
    const t = Date.parse(input.latestMatchIso);
    if (Number.isFinite(t)) {
      days = Math.floor((now.getTime() - t) / 86_400_000);
      const max = input.maxDaysSinceMatch ?? 45;
      if (days > max) {
        problems.push(`l'ultima partita registrata risale a ${days} giorni fa (soglia ${max})`);
      }
    }
  }

  return {
    ok: problems.length === 0,
    latestSeason: latest,
    expectedSeason: expected,
    seasonsBehind: Math.max(0, behind),
    latestMatchIso: input.latestMatchIso ?? null,
    daysSinceLatestMatch: days,
    problems,
  };
}

/** Come assessFreshness, ma interrompe: da usare prima di qualunque previsione live. */
export function assertFresh(input: Parameters<typeof assessFreshness>[0]): FreshnessVerdict {
  const v = assessFreshness(input);
  if (!v.ok) {
    throw new Error(
      `DATASET NON AGGIORNATO — nessuna previsione live va prodotta con questi dati:\n  ` +
        v.problems.join("\n  ") +
        `\n  Rimedio: pnpm data:build-expanded dopo aver scaricato le stagioni mancanti.`,
    );
  }
  return v;
}
