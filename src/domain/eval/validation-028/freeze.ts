import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { miniStrictPath, strictCandidatesPath } from "@/domain/eval/breakthrough-027/config";
import { parseStrictCandidatesCsv } from "@/domain/eval/breakthrough-027/load-candidates";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import type { DatasetFreeze028 } from "@/domain/eval/validation-028/types";
import { DATASET_ID_028 } from "@/domain/eval/validation-028/types";

export function freezeStrict027(input: { skipHeavy: boolean }): {
  freeze: DatasetFreeze028;
  events: StrictCandidate027[];
} {
  const prod = strictCandidatesPath();
  const useMini = input.skipHeavy || !existsSync(prod);
  const path = useMini ? miniStrictPath() : prod;
  const buf = readFileSync(path);
  const sha256 = createHash("sha256").update(buf).digest("hex");
  const events = parseStrictCandidatesCsv(buf.toString("utf8"), "2026-09-07T00:00:00.000Z").sort(
    (a, b) => a.kickoff.localeCompare(b.kickoff) || a.event_id.localeCompare(b.event_id),
  );
  const books = [...new Set(events.map((e) => e.bookmaker))].sort();
  return {
    events,
    freeze: {
      path,
      sha256,
      dataset_version: DATASET_ID_028,
      bytes: statSync(path).size,
      events: events.length,
      quotes: events.length * 3,
      period_start: events[0]?.kickoff ?? null,
      period_end: events[events.length - 1]?.kickoff ?? null,
      markets: ["1X2"],
      bookmakers: books,
      source_lineage:
        "Kaggle austro BeatTheBookie odds_series/odds_series_b (GPL-3.0 upstream) LEVEL B overlay on eatpizzanot/soccer-dataset date_utc (CC BY 4.0). Frozen TASK 027 STRICT file. No events added or dropped in TASK 028.",
      fixture: useMini,
    },
  };
}
