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
    lines.push(`Probabile over 2.5 (${pct(over25.probability)}, n=${over25.n} partite storiche).`);
  } else if (over25?.probability != null && over25.probability <= 0.45) {
    lines.push(`Più spesso under 2.5 (${pct(1 - over25.probability)}, n=${over25.n}).`);
  }

  const home15 = find(markets, "team_goals", "HOME_OVER", 1.5);
  if (home15?.probability != null && home15.probability >= 0.55) {
    lines.push(`Casa di solito >1.5 gol in casa (${pct(home15.probability)}, n=${home15.n}).`);
  }

  const away15 = find(markets, "team_goals", "AWAY_OVER", 1.5);
  if (away15?.probability != null && away15.probability >= 0.55) {
    lines.push(`Ospiti di solito >1.5 gol in trasferta (${pct(away15.probability)}, n=${away15.n}).`);
  }

  const homeCorners = find(markets, "corners", "HOME_MORE");
  const awayCorners = find(markets, "corners", "AWAY_MORE");
  if (
    awayCorners?.probability != null &&
    awayCorners.probability >= 0.55 &&
    (homeCorners?.probability == null || awayCorners.probability > homeCorners.probability)
  ) {
    lines.push(
      `Ospiti probabilmente più calci d’angolo (${pct(awayCorners.probability)}, n=${awayCorners.n}).`,
    );
  } else if (homeCorners?.probability != null && homeCorners.probability >= 0.55) {
    lines.push(
      `Casa probabilmente più calci d’angolo (${pct(homeCorners.probability)}, n=${homeCorners.n}).`,
    );
  }

  const btts = find(markets, "btts", "YES");
  if (btts?.probability != null && btts.probability >= 0.55) {
    lines.push(`Entrambe le squadre hanno segnato spesso (${pct(btts.probability)}, n=${btts.n}).`);
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
    lines.push(`Frequenze 1X2 (campione n=${home.n}): favorito ${fav}.`);
  }

  return lines;
}
