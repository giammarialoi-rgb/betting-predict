import { appendFileSync, mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import type { MarketSignalSnapshot } from "@/domain/eval/market-intelligence/types";

export function marketIntelligenceRoot(labBRoot?: string): string {
  return join(piRoot(labBRoot), "market-intelligence");
}

export function appendMarketSignalSnapshot(
  snap: MarketSignalSnapshot,
  labBRoot?: string,
): void {
  const root = marketIntelligenceRoot(labBRoot);
  mkdirSync(root, { recursive: true });
  appendFileSync(join(root, "market-signals.jsonl"), `${JSON.stringify(snap)}\n`, "utf8");
}

export function writeMarketSignalsReport(input: {
  labBRoot?: string;
  nowIso: string;
  samples: number;
  note: string;
}): void {
  const root = marketIntelligenceRoot(input.labBRoot);
  mkdirSync(root, { recursive: true });
  writeFileSync(
    join(root, "market-signals.json"),
    JSON.stringify(
      {
        at: input.nowIso,
        samples: input.samples,
        note: input.note,
        layer: "COMPARE_ONLY",
        enters_independent_model: false,
        volume: "UNAVAILABLE",
        rlm: "UNAVAILABLE",
        liquidity: "LIQUIDITY_PROXY_BOOKS",
        real_money: false,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function writeMarketMovementReport(input: {
  labBRoot?: string;
  nowIso: string;
  movements: Array<{
    event_id: string;
    market: string;
    movement_label: string;
    delta_fav_p: number | null;
    steam_move: boolean;
    liquidity_proxy: string;
  }>;
}): void {
  const root = marketIntelligenceRoot(input.labBRoot);
  mkdirSync(root, { recursive: true });
  const steam = input.movements.filter((m) => m.steam_move).length;
  const drift = input.movements.filter((m) => m.movement_label === "drift").length;
  writeFileSync(
    join(root, "market-movement-report.json"),
    JSON.stringify(
      {
        at: input.nowIso,
        n: input.movements.length,
        steam_count: steam,
        drift_count: drift,
        movements: input.movements.slice(0, 200),
        real_money: false,
        enters_independent_model: false,
      },
      null,
      2,
    ),
    "utf8",
  );
}

/** Also mirror flat copies under piRoot for lab audit list. */
export function mirrorMarketIntelligenceToPiRoot(labBRoot?: string): void {
  const mi = marketIntelligenceRoot(labBRoot);
  const dest = piRoot(labBRoot);
  for (const name of ["market-signals.json", "market-movement-report.json"]) {
    const src = join(mi, name);
    if (!existsSync(src)) continue;
    writeFileSync(join(dest, name), readFileSync(src, "utf8"), "utf8");
  }
}
