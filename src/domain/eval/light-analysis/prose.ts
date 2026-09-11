/**
 * Short Italian lines grounded in computed frequencies — not vibes.
 */
import type { LightMarketEstimate } from "@/domain/eval/light-analysis/types";

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function find(
  markets: readonly LightMarketEstimate[],
  market: string,
  selection: string,
  line: number | null = null,
): LightMarketEstimate | undefined {
  return markets.find(
    (m) =>
      m.market === market &&
      m.selection === selection &&
      (line == null || m.line === line) &&
      m.status === "OK" &&
      m.probability != null,
  );
}

export function proseFromMarkets(markets: readonly LightMarketEstimate[]): string[] {
  const lines: string[] = [];
  const over25 = find(markets, "over_under", "OVER", 2.5);
  if (over25?.probability != null && over25.probability >= 0.55) {
    lines.push(`Spesso over 2.5 (${pct(over25.probability)}, su ${over25.n} partite).`);
  } else if (over25?.probability != null && over25.probability <= 0.45) {
    lines.push(`Più spesso under 2.5 (${pct(1 - over25.probability)}, su ${over25.n} partite).`);
  }

  const home15 = find(markets, "team_goals", "HOME_OVER", 1.5);
  if (home15?.probability != null && home15.probability >= 0.55) {
    lines.push(`La casa segna spesso più di 1.5 gol (${pct(home15.probability)}, su ${home15.n} partite).`);
  }

  const away15 = find(markets, "team_goals", "AWAY_OVER", 1.5);
  if (away15?.probability != null && away15.probability >= 0.55) {
    lines.push(`Gli ospiti segnano spesso più di 1.5 gol (${pct(away15.probability)}, su ${away15.n} partite).`);
  }

  const homeCorners = find(markets, "corners", "HOME_MORE");
  const awayCorners = find(markets, "corners", "AWAY_MORE");
  if (
    awayCorners?.probability != null &&
    awayCorners.probability >= 0.55 &&
    (homeCorners?.probability == null || awayCorners.probability > homeCorners.probability)
  ) {
    lines.push(`Più calci d’angolo per gli ospiti (${pct(awayCorners.probability)}).`);
  } else if (homeCorners?.probability != null && homeCorners.probability >= 0.55) {
    lines.push(`Più calci d’angolo per la casa (${pct(homeCorners.probability)}).`);
  }

  const btts = find(markets, "btts", "YES");
  if (btts?.probability != null && btts.probability >= 0.55) {
    lines.push(`Entrambe hanno segnato spesso (${pct(btts.probability)}).`);
  }

  const home = find(markets, "1x2", "HOME");
  const draw = find(markets, "1x2", "DRAW");
  const away = find(markets, "1x2", "AWAY");
  if (home?.probability != null && draw?.probability != null && away?.probability != null) {
    const fav =
      home.probability >= draw.probability && home.probability >= away.probability
        ? `1 (casa) ${pct(home.probability)}`
        : draw.probability >= away.probability
          ? `X ${pct(draw.probability)}`
          : `2 (trasferta) ${pct(away.probability)}`;
    lines.push(`Favorito 1X2: ${fav}.`);
  }

  return lines;
}
