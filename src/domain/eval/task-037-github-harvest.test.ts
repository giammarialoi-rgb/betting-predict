import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { auditTask037 } from "@/domain/eval/harvest-037/audit";
import { REPOS_037 } from "@/domain/eval/harvest-037/catalog";
import { loadExp037Config } from "@/domain/eval/harvest-037/config";
import {
  canEnterStrict037,
  canonicalEventKey037,
  classifyQuote037,
  lastObservationAtOrBeforeT1h,
  matchGrade037,
} from "@/domain/eval/harvest-037/gate";
import { fingerprint037, runTask037 } from "@/domain/eval/harvest-037/lab";
import { SINGLE_MISSING_RESOURCE_037, buildLake037 } from "@/domain/eval/harvest-037/lake";
import { runHostileBattery037 } from "@/domain/eval/harvest-037/leakage";
import type { Quote037, RepoHarvest037 } from "@/domain/eval/harvest-037/types";

function q(over: Partial<Quote037> = {}): Quote037 {
  return {
    event_id: "e1",
    competition: "epl",
    season: "2015-16",
    home: "Arsenal",
    away: "Chelsea",
    kickoff_utc: "2015-09-12T14:00:00.000Z",
    quote_timestamp_utc: "2015-09-12T13:00:00.000Z",
    odds_home: 1.9,
    odds_draw: 3.4,
    odds_away: 4.0,
    source: "fixture",
    bookmaker: "pinnacle",
    temporal_basis: "BOOKMAKER_PUBLISH",
    quote_has_offset: true,
    kickoff_has_offset: true,
    client_retrieved_at: null,
    ft_home: 1,
    ft_away: 0,
    ...over,
  };
}

describe("TASK 037 GitHub harvest", () => {
  it("frozen flags + clustering + sha256", () => {
    const cfg = loadExp037Config();
    assert.equal(cfg.open_task_038, false);
    assert.equal(cfg.count_legacy_031_as_new_strict, false);
    assert.equal(cfg.winner, null);
    const anish = REPOS_037.find((r) => r.id === "anishkhetani");
    assert.equal(anish?.cluster, "football-data-co-uk");
    assert.equal(anish?.role, "MIRROR");
    const hex = createHash("sha256").update("task-037").digest("hex");
    assert.equal(hex.length, 64);
  });

  it("timestamp classification, T-1h, MATCH_EXACT, STRICT gate", () => {
    assert.equal(classifyQuote037(q({ temporal_basis: "DATE_ONLY" })).lake, "DATE_ONLY");
    assert.equal(classifyQuote037(q({ quote_has_offset: false, temporal_basis: "NAIVE_DATETIME" })).lake, "NAIVE_DATETIME");
    assert.equal(
      classifyQuote037(q({ quote_timestamp_utc: "2015-09-12T15:00:00.000Z" })).lake,
      "POSTMATCH",
    );
    assert.equal(matchGrade037(q()), "MATCH_EXACT");
    assert.equal(canEnterStrict037(q(), "MATCH_EXACT"), true);
    assert.equal(canEnterStrict037(q(), "MATCH_AMBIGUOUS"), false);
    assert.equal(
      canEnterStrict037(
        q({
          quote_timestamp_utc: "2026-09-02T13:02:39.000Z",
          client_retrieved_at: "2026-09-02T13:02:39.000Z",
          temporal_basis: "CLIENT_RETRIEVED",
        }),
        "MATCH_EXACT",
      ),
      false,
    );
    const last = lastObservationAtOrBeforeT1h([
      { quoteMs: Date.parse("2015-09-12T11:00:00.000Z"), kickMs: Date.parse("2015-09-12T14:00:00.000Z") },
      { quoteMs: Date.parse("2015-09-12T13:00:00.000Z"), kickMs: Date.parse("2015-09-12T14:00:00.000Z") },
      { quoteMs: Date.parse("2015-09-12T13:30:00.000Z"), kickMs: Date.parse("2015-09-12T14:00:00.000Z") },
    ]);
    assert.equal(last?.quoteMs, Date.parse("2015-09-12T13:00:00.000Z"));
    assert.equal(
      canonicalEventKey037({ competition: "EPL", season: "2015", kickoff_utc: "t", home: "A", away: "B" }),
      "epl|2015|t|a|b",
    );
  });

  it("hostile leakage + lab dual-run + no silent bankroll", async () => {
    const batt = runHostileBattery037();
    assert.ok(batt.every((x) => x.throws), batt.filter((x) => !x.throws).map((x) => x.id).join(","));
    const a = await runTask037({ skipHeavy: true });
    const b = await runTask037({ skipHeavy: true });
    assert.equal(a.fingerprint, b.fingerprint);
    assert.equal(a.STRICT_EVENTS, 0);
    assert.equal(a.BETS, 0);
    assert.equal(a.BANKROLL, "—");
    assert.equal(a.FINAL_VERDICT, "FINAL_BLOCKER");
    assert.ok(a.missing_resource.includes("≥100 STRICT"));
    assert.equal(auditTask037(a).ok, true, auditTask037(a).failures.join(","));
    const lake = buildLake037(a.harvest);
    assert.equal(lake.strict_events, 0);
    assert.ok(lake.clusters.some((c) => c.id === "task-031-base" && c.events_est === 10499));
    assert.equal(
      fingerprint037({
        verdict: "FINAL_BLOCKER",
        exp: a.experiment_sha256,
        strict: 0,
        bets: 0,
        winner: null,
        scanned: a.GITHUB_REPOSITORIES_SCANNED,
        missing: SINGLE_MISSING_RESOURCE_037,
      }),
      a.fingerprint,
    );
    const dummy: RepoHarvest037 = a.harvest[0]!;
    assert.ok(dummy.cluster);
  });

  it("does not open TASK 038", () => {
    assert.equal(loadExp037Config().open_task_038, false);
    assert.throws(() => {
      if (!loadExp037Config().open_task_038) throw new ExperimentIntegrityError("038 closed");
    }, ExperimentIntegrityError);
  });
});
