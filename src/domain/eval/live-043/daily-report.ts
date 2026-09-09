import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Store039 } from "@/domain/eval/live-039/store";
import { artifactStore043 } from "@/domain/eval/live-043/config";
import type { Store043 } from "@/domain/eval/live-043/store";

export function writeDailyReport043(input: {
  store039: Store039;
  store043: Store043;
  modelVersion: string;
  creditsRemaining: number | null;
  date: string;
}): string {
  const dir = join(artifactStore043(), "daily-reports");
  mkdirSync(dir, { recursive: true });
  const soccer = input.store043.catalog.filter((c) => c.sport === "soccer").length;
  const tennis = input.store043.catalog.filter((c) => c.sport === "tennis").length;
  const analyzed = input.store043.predictions.filter((p) => p.status !== "PARTIAL_DATA").length;
  const locked = input.store043.predictions.filter((p) => p.locked).length;
  const candidates = input.store043.predictions.filter((p) => p.candidate_class === "CANDIDATE").length;
  const strong = input.store043.predictions.filter((p) => p.candidate_class === "STRONG_CANDIDATE").length;
  const settled = input.store039.settlements.filter((s) => s.outcome !== "UNSETTLED").length;
  const body = [
    `DATE: ${input.date}`,
    `EVENTS_DISCOVERED: ${input.store043.catalog.length}`,
    `SOCCER_EVENTS: ${soccer}`,
    `TENNIS_EVENTS: ${tennis}`,
    `EVENTS_ANALYZED: ${analyzed}`,
    `LOCKED: ${locked}`,
    `CANDIDATES: ${candidates}`,
    `STRONG_CANDIDATES: ${strong}`,
    `SETTLED: ${settled}`,
    `MARKET_BRIER: —`,
    `MODEL_BRIER: —`,
    `DELTA: —`,
    `MODEL_VERSION: ${input.modelVersion}`,
    `LEARNING_CANDIDATES: ${input.store043.autopsies.filter((a) => a.learning_candidate).length}`,
    `AUTOPSIES: ${input.store043.autopsies.length}`,
    `API_CREDITS_REMAINING: ${input.creditsRemaining ?? "—"}`,
    "",
  ].join("\n");
  const path = join(dir, `${input.date}.md`);
  writeFileSync(path, body);
  return path;
}
