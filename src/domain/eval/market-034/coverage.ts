import { windowExistsInPhpHourly, REQUESTED_WINDOWS } from "@/domain/eval/breakthrough-027/php-bins";
import type { Window034 } from "@/domain/eval/market-034/types";
import { WINDOWS_034 } from "@/domain/eval/market-034/types";

export type Coverage034 = Record<Window034, { php_possible: boolean; observed: number; coverage: number }>;

export function emptyCoverage(nEvents: number): Coverage034 {
  const out = {} as Coverage034;
  for (const w of WINDOWS_034) {
    const php = REQUESTED_WINDOWS.includes(w as (typeof REQUESTED_WINDOWS)[number])
      ? windowExistsInPhpHourly(w as (typeof REQUESTED_WINDOWS)[number])
      : false;
    out[w] = { php_possible: php, observed: 0, coverage: nEvents === 0 ? 0 : 0 };
  }
  return out;
}

export type EventWindowRow034 = {
  event_id: string;
  kickoff: string;
  bookmaker: string;
  t1h: 1;
  t24: 0 | 1;
  "T-72h": 0;
  "T-48h": 0;
  "T-12h": 0;
  "T-6h": 0;
  "T-3h": 0;
  "T-30m": 0;
  "T-15m": 0;
  "T-5m": 0;
  "T-1m": 0;
};

export function buildCoverage(input: {
  nEvents: number;
  t1h: number;
  t24: number;
}): Coverage034 {
  const out = emptyCoverage(input.nEvents);
  const n = input.nEvents || 1;
  out["T-1h"] = { php_possible: true, observed: input.t1h, coverage: input.t1h / n };
  out["T-24h"] = { php_possible: true, observed: input.t24, coverage: input.t24 / n };
  out["T-72h"] = { php_possible: false, observed: 0, coverage: 0 };
  out["T-30m"] = { php_possible: false, observed: 0, coverage: 0 };
  out["T-15m"] = { php_possible: false, observed: 0, coverage: 0 };
  out["T-5m"] = { php_possible: false, observed: 0, coverage: 0 };
  out["T-1m"] = { php_possible: false, observed: 0, coverage: 0 };
  for (const w of ["T-48h", "T-12h", "T-6h", "T-3h"] as const) {
    out[w] = { php_possible: true, observed: 0, coverage: 0 };
  }
  return out;
}
