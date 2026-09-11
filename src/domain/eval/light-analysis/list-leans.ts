/**
 * Compact list leans from already-computed light markets. Never invents a %.
 */
import { LIGHT_INSUFFICIENT_IT, type LightMarketEstimate } from "@/domain/eval/light-analysis/types";
import type { OneXTwoKey } from "@/domain/eval/light-analysis/favorite";

export type LeanGroup = "1x2" | "ou" | "btts" | "goals" | "corners";

export type ListLean = {
  key: string;
  label_it: string;
  text: string;
  favorite: boolean;
  group: LeanGroup;
};

function pct(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function pick(
  markets: readonly LightMarketEstimate[],
  market: string,
  selection: string,
  line: number | null = null,
): LightMarketEstimate | undefined {
  return markets.find(
    (m) => m.market === market && m.selection === selection && (line == null || m.line === line),
  );
}

function lean(
  key: string,
  label_it: string,
  group: LeanGroup,
  row: LightMarketEstimate | undefined,
  favorite = false,
): ListLean {
  if (!row || row.status !== "OK" || row.probability == null) {
    return { key, label_it, text: LIGHT_INSUFFICIENT_IT, favorite: false, group };
  }
  return { key, label_it, text: pct(row.probability), favorite, group };
}

export function listMarketLeans(
  markets: readonly LightMarketEstimate[],
  favorite: OneXTwoKey | null = null,
): ListLean[] {
  return [
    lean("1", "1", "1x2", pick(markets, "1x2", "HOME"), favorite === "home"),
    lean("x", "X", "1x2", pick(markets, "1x2", "DRAW"), favorite === "draw"),
    lean("2", "2", "1x2", pick(markets, "1x2", "AWAY"), favorite === "away"),
    lean("o15", "O1.5", "ou", pick(markets, "over_under", "OVER", 1.5)),
    lean("o25", "O2.5", "ou", pick(markets, "over_under", "OVER", 2.5)),
    lean("o35", "O3.5", "ou", pick(markets, "over_under", "OVER", 3.5)),
    lean("btts", "BTTS sì", "btts", pick(markets, "btts", "YES")),
    lean("hg15", "Casa >1.5", "goals", pick(markets, "team_goals", "HOME_OVER", 1.5)),
    lean("ag15", "Ospiti >1.5", "goals", pick(markets, "team_goals", "AWAY_OVER", 1.5)),
    lean("cor", "Angoli casa", "corners", pick(markets, "corners", "HOME_MORE")),
    lean("cor_a", "Angoli ospiti", "corners", pick(markets, "corners", "AWAY_MORE")),
  ];
}
