import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { collectorLogPath042 } from "@/domain/eval/collector-042/config";

export function appendCollectorLog042(line: string, root?: string): void {
  const path = collectorLogPath042(root);
  mkdirSync(dirname(path), { recursive: true });
  const safe = line.replace(/THE_ODDS_API_KEY=\S+/gi, "THE_ODDS_API_KEY=***").replace(/apiKey=[^&\s]+/gi, "apiKey=***");
  appendFileSync(path, `${new Date().toISOString()} ${safe}\n`, "utf8");
}

export function logCycle042(
  payload: Record<string, unknown>,
  root?: string,
): void {
  appendCollectorLog042(JSON.stringify(payload), root);
}
