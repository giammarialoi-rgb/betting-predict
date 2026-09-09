import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FOOTBALL_DATA_CO_UK_FIXTURE_CSV,
  FOOTBALL_DATA_CO_UK_FIXTURE_DIVISION,
  FOOTBALL_DATA_CO_UK_FIXTURE_SEASON,
} from "./fixture";
import { parseFootballDataCoUkMatches } from "./parser";

describe("football-data.co.uk parser", () => {
  it("parses fixture rows into dataset_open/close snapshots without inventing clocks", () => {
    const { matches, stats } = parseFootballDataCoUkMatches({
      csvText: FOOTBALL_DATA_CO_UK_FIXTURE_CSV,
      seasonCode: FOOTBALL_DATA_CO_UK_FIXTURE_SEASON,
      division: FOOTBALL_DATA_CO_UK_FIXTURE_DIVISION,
    });

    assert.equal(stats.validMatchRows, 2);
    assert.ok(stats.rejectedRows >= 2);
    assert.ok(stats.rejectionReasons.invalid_date >= 1);
    assert.ok(stats.rejectionReasons.unmapped_team >= 1);

    const first = matches.find((m) => m.homeTeamId === "manchester-united");
    assert.ok(first);
    assert.ok(
      first.snapshots.every(
        (s) =>
          s.temporalPrecision === "unknown" &&
          (s.observationKind === "dataset_open" ||
            s.observationKind === "dataset_close") &&
          s.observedAt.toISOString() === "2024-08-17T00:00:00.000Z" &&
          s.sourcePublishedAt === null,
      ),
    );
    assert.ok(
      first.snapshots.some(
        (s) => s.bookmakerSlug === "bet365" && s.observationKind === "dataset_open",
      ),
    );
    assert.ok(
      first.snapshots.some(
        (s) => s.bookmakerSlug === "bet365" && s.observationKind === "dataset_close",
      ),
    );
    assert.equal(
      first.snapshots.some((s) => s.bookmakerSlug === "max" || s.bookmakerSlug === "avg"),
      false,
    );
  });
});
