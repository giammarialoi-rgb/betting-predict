import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BlindLeakageError, ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import { auditTask035 } from "@/domain/eval/breakthrough-035/audit";
import { catalog035 } from "@/domain/eval/breakthrough-035/catalog";
import { assertHoldoutLocked035, assertNo036, assertTestLocked035, loadExp035Config } from "@/domain/eval/breakthrough-035/config";
import { classifyQuote035 } from "@/domain/eval/breakthrough-035/gate";
import {
  fingerprint035,
  printVerdictBlock035,
  runTask035,
  verdict035,
} from "@/domain/eval/breakthrough-035/lab";
import { leakInventTimezone, leakOpenCloseToTimestamp, runHostileBattery035 } from "@/domain/eval/breakthrough-035/leakage";
import { parseFootballDataE0, parseOlivierClosing, parseSharpApi } from "@/domain/eval/breakthrough-035/parsers";
import { scoreCard035 } from "@/domain/eval/breakthrough-035/scoring";
import { FROZEN_031_SHA256_035 } from "@/domain/eval/breakthrough-035/types";
import type { NormalizedQuote035 } from "@/domain/eval/breakthrough-035/types";

function q(over: Partial<NormalizedQuote035>): NormalizedQuote035 {
  return {
    event_id: "e1",
    market_id: "1X2",
    selection: "HOME",
    price: 1.8,
    quote_timestamp: null,
    kickoff_timestamp: null,
    source: "t",
    source_record_id: "1",
    timezone: null,
    temporal_basis: "UNKNOWN",
    quote_has_offset: false,
    kickoff_has_offset: false,
    prematch_candidate: false,
    inplay_or_post: false,
    bookmaker: null,
    competition: null,
    home: "A",
    away: "B",
    ft_home: null,
    ft_away: null,
    ...over,
  };
}

describe("TASK 035 data breakthrough", () => {
  it("scoring + catalog + frozen flags", () => {
    const s = scoreCard035({ clock: 5, kickoff: 3, match: 2, depth: 3, coverage: 3, holdout: 3 });
    assert.equal(s.total, 19);
    const cat = catalog035();
    assert.ok(cat.length >= 30);
    assert.ok(cat.every((x) => x.can_become_strict === false));
    const cfg = loadExp035Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.open_task_036, false);
    assert.equal(cfg.modify_frozen_031, false);
    assert.equal(cfg.add_new_model_family, false);
    assert.equal(cfg.legacy_dataset_sha256, FROZEN_031_SHA256_035);
    assert.ok(cfg.corpus_partitions.TEST.end < cfg.corpus_partitions.HOLDOUT.start);
    assert.throws(() => assertTestLocked035(true), ExperimentIntegrityError);
    assert.throws(() => assertHoldoutLocked035(true), ExperimentIntegrityError);
    assert.throws(() => assertNo036(true), ExperimentIntegrityError);
  });

  it("temporal gate never promotes DATE_ONLY / naive / in-play", () => {
    assert.equal(classifyQuote035(q({ temporal_basis: "DATE_ONLY" })), "DATE_ONLY");
    assert.equal(classifyQuote035(q({ temporal_basis: "CLOSING" })), "DATE_ONLY");
    assert.equal(
      classifyQuote035(
        q({
          quote_timestamp: "2024-07-25 10:50:04",
          kickoff_timestamp: "2024-07-26 00:30:00",
          temporal_basis: "NAIVE_DATETIME",
        }),
      ),
      "AMBIGUOUS",
    );
    assert.equal(
      classifyQuote035(
        q({
          inplay_or_post: true,
          quote_timestamp: "2025-08-16T03:37:26Z",
          kickoff_timestamp: "2025-08-16T03:00:00Z",
          quote_has_offset: true,
          kickoff_has_offset: true,
          timezone: "UTC",
        }),
      ),
      "POSTMATCH",
    );
    assert.equal(
      classifyQuote035(
        q({
          quote_timestamp: "2026-07-13T01:45:33.481Z",
          kickoff_timestamp: "2026-07-14T19:00:00Z",
          quote_has_offset: true,
          kickoff_has_offset: true,
          timezone: "UTC",
          temporal_basis: "ISO_Z_SNAPSHOT",
          prematch_candidate: true,
        }),
      ),
      "RESEARCH_TEMPORAL",
    );
  });

  it("parsers keep Sharp ISO-Z and Olivier closing semantics", () => {
    const sharp = parseSharpApi(
      "id,sportsbook,event_id,sport,league,home_team,away_team,market_type,selection,selection_type,odds_american,odds_decimal,odds_probability,line,event_start_time,is_live,timestamp\n1,pinnacle,e,soccer,wc,France,Spain,moneyline,France,home,-120,1.83,0.5,,2026-07-14T00:00:00Z,False,2026-07-13T01:45:33Z\n",
    );
    assert.equal(sharp.length, 1);
    assert.equal(sharp[0]!.quote_has_offset, true);
    assert.equal(sharp[0]!.prematch_candidate, false);
    const clos = parseOlivierClosing(
      "Country,League,Date,Statut,Home_Team,Away_Team,Home_Goal,Away_Goal,Pen.,Closing_Odds_Home,Closing_Odds_Draw,Closing_Odds_Away\nFinland,X,06/01/1998,,A,B,1,0,,1.75,3,4.5\n",
    );
    assert.equal(clos.length, 3);
    assert.equal(clos[0]!.temporal_basis, "CLOSING");
    assert.equal(clos[0]!.quote_timestamp, null);
    const fd = parseFootballDataE0(
      "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,B365H,B365D,B365A\nE0,09/08/2019,20:00,Liverpool,Norwich,4,1,1.14,10,19\n",
    );
    assert.equal(fd.length, 3);
    assert.equal(fd[0]!.temporal_basis, "OPEN_CLOSE");
    assert.equal(fd[0]!.quote_timestamp, null);
    assert.equal(classifyQuote035(fd[0]!), "DATE_ONLY");
  });

  it("verdict + leakage + dual-run fixture lab", async () => {
    assert.equal(
      verdict035({ newStrict: 0, newStrict2020: 0, holdoutN: 0, testN: 0, multiYear: false, modelBeatsAllGates: false }),
      "INSUFFICIENT_DATA_FINAL",
    );
    assert.equal(
      verdict035({ newStrict: 600, newStrict2020: 200, holdoutN: 150, testN: 120, multiYear: true, modelBeatsAllGates: false }),
      "DATA_BREAKTHROUGH_NO_EDGE",
    );
    assert.equal(
      verdict035({ newStrict: 600, newStrict2020: 200, holdoutN: 150, testN: 120, multiYear: true, modelBeatsAllGates: true }),
      "MODEL_EDGE_DETECTED",
    );
    assert.throws(() => leakOpenCloseToTimestamp(true), BlindLeakageError);
    assert.throws(() => leakInventTimezone(), BlindLeakageError);
    const batt = runHostileBattery035();
    assert.ok(batt.every((x) => x.throws), batt.filter((x) => !x.throws).map((x) => x.id).join(","));
    const a = await runTask035({ skipHeavy: true });
    const b = await runTask035({ skipHeavy: true });
    assert.equal(a.verdict, "INSUFFICIENT_DATA_FINAL");
    assert.equal(a.FINAL_VERDICT, "INSUFFICIENT_DATA_FINAL");
    assert.equal(a.winner, null);
    assert.equal(a.auto_promotion, false);
    assert.equal(a.real_money, false);
    assert.equal(a.MODEL_READY, false);
    assert.equal(a.BETS, 0);
    assert.equal(a.BANKROLL, "—");
    assert.equal(a.TEST_EVENTS, 0);
    assert.equal(a.HOLDOUT_EVENTS, 0);
    assert.equal(a.HOLDOUT_STATUS, "EMPTY");
    assert.equal(a.strict_events, 0);
    assert.equal(a.fingerprint, b.fingerprint);
    assert.ok(printVerdictBlock035(a).includes("FINAL_VERDICT: INSUFFICIENT_DATA_FINAL"));
    assert.equal(auditTask035(a).ok, true, auditTask035(a).failures.join(","));
    assert.equal(
      fingerprint035({
        verdict: a.verdict,
        newStrict: a.strict_events,
        newStrict2020: a.strict_2020_plus,
        legacy: a.observed_sha256,
        exp: a.experiment_sha256,
        investigated: a.sources_investigated,
        usable: a.sources_usable,
        test: a.TEST_EVENTS,
        holdout: a.HOLDOUT_EVENTS,
        bets: a.BETS,
        winner: a.winner,
        match_exact: a.match_exact,
      }),
      a.fingerprint,
    );
    for (const row of a.annual) {
      assert.equal(row.start, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
  });
});
