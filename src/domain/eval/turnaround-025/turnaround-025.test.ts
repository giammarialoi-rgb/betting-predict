import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { ClubMatchLite } from "@/domain/eval/actuarial-018/load-matches";
import { auditTask025 } from "@/domain/eval/turnaround-025/audit";
import {
  classifyDateOnlyOdds,
  classifyNamedOpeningDataset,
  classifyWeeklyBetfairRow,
} from "@/domain/eval/turnaround-025/classify";
import { loadExp025Config } from "@/domain/eval/turnaround-025/config";
import { inspectKaggleWeekly, kaggleWeekSamplePath } from "@/domain/eval/turnaround-025/kaggle-inspect";
import { parseWeeklyBetfairCsv } from "@/domain/eval/turnaround-025/kaggle-betfair";
import { decideVerdict025, runTask025 } from "@/domain/eval/turnaround-025/lab";
import {
  assertWeeklyNotForcedStrict,
  runHostileBattery025,
  sampleWeeklyPe,
} from "@/domain/eval/turnaround-025/leakage";
import { gradeTwoEvents, strictMatchAllowed } from "@/domain/eval/turnaround-025/matching";
import { stage1Probability, stage2Decision } from "@/domain/eval/turnaround-025/models";
import { annualBankroll025 } from "@/domain/eval/turnaround-025/replay";
import { researchDiagnostic } from "@/domain/eval/turnaround-025/research";
import { acquisitionScores } from "@/domain/eval/turnaround-025/scores";

describe("TASK 025 real data turnaround", () => {
  it("classifies Kaggle weekly clocks: naive PE is B, IP is D, horse is D, ISO Z can be A", () => {
    const rows = parseWeeklyBetfairCsv(readFileSync(kaggleWeekSamplePath(), "utf8"));
    assert.equal(classifyWeeklyBetfairRow(rows[0]!).dataClass, "B_RESEARCH_TEMPORAL");
    assert.equal(classifyWeeklyBetfairRow(rows[0]!).capitalEligible, false);
    const ip = rows.find((r) => r.in_play === "IP")!;
    assert.equal(classifyWeeklyBetfairRow(ip).dataClass, "D_INVALID");
    const horse = rows.find((r) => r.sports_id === "7")!;
    assert.equal(classifyWeeklyBetfairRow(horse).dataClass, "D_INVALID");
    const iso = sampleWeeklyPe({
      scheduled_off: "2013-01-13T15:00:00Z",
      latest_taken: "2013-01-13T14:00:00Z",
      first_taken: "2013-01-13T10:00:00Z",
    });
    assert.equal(classifyWeeklyBetfairRow(iso).dataClass, "A_STRICT");
    const dmy = sampleWeeklyPe({
      scheduled_off: "04-09-2014 15:30",
      latest_taken: "04-09-2014 14:00:00",
      first_taken: "04-09-2014 10:00:00",
      in_play: "PE",
    });
    assert.equal(classifyWeeklyBetfairRow(dmy).dataClass, "B_RESEARCH_TEMPORAL");
    assert.equal(classifyWeeklyBetfairRow(dmy).capitalEligible, false);
    assertWeeklyNotForcedStrict();
    assert.equal(classifyNamedOpeningDataset("historical opening odds"), "C_RESEARCH_ONLY");
    assert.equal(classifyDateOnlyOdds().dataClass, "C_RESEARCH_ONLY");
  });

  it("matching V2: EPL vs E0 Middlesbrough/Man City is MATCH_EXACT; only EXACT is capital-join", () => {
    const g = gradeTwoEvents({
      dateA: "2017-04-30",
      dateB: "2017-04-30",
      homeA: "Middlesbrough",
      homeB: "Middlesbrough",
      awayA: "Man City",
      awayB: "Manchester City",
      competitionA: "EPL",
      competitionB: "E0",
    });
    assert.equal(g, "MATCH_EXACT");
    assert.equal(strictMatchAllowed(g), true);
    assert.equal(strictMatchAllowed("MATCH_HIGH_CONFIDENCE"), false);
    assert.equal(strictMatchAllowed("MATCH_PROBABLE"), false);
  });

  it("two-stage: P_model > P_market is not a bet without gates; no evidence graph fails", () => {
    const p = stage1Probability("market_devig", {
      marketOdds: { home: 2.0, draw: 3.5, away: 4.0 },
      freq: [0.4, 0.3, 0.3],
      formHomePts: 9,
      formAwayPts: 4,
      formSample: 5,
      eloDiff: 50,
      gfHome: 8,
      gaHome: 4,
      gfAway: 5,
      gaAway: 7,
      microstructureAvailable: false,
    });
    assert.ok(p);
    const noGraph = stage2Decision({
      capitalEligible: true,
      declaredEdge: true,
      probs: [0.5, 0.25, 0.25],
      market: [0.4, 0.3, 0.3],
      threshold: 0.03,
      trainN: 500,
      minTrain: 100,
      calibrationOk: true,
      liquidityOk: true,
      timestampStrict: true,
      evidenceGraph: false,
    });
    assert.equal(noGraph.decision, "NO_BET");
    assert.equal(noGraph.reason, "NO_EVIDENCE_GRAPH");
    const frozen = stage2Decision({
      capitalEligible: true,
      declaredEdge: false,
      probs: [0.5, 0.25, 0.25],
      market: [0.4, 0.3, 0.3],
      threshold: 0.03,
      trainN: 500,
      minTrain: 100,
      calibrationOk: true,
      liquidityOk: true,
      timestampStrict: true,
      evidenceGraph: true,
    });
    assert.equal(frozen.decision, "NO_BET");
    assert.match(frozen.reason, /declared_edge/);
  });

  it("hostile A–O all throw; annual never silent 1000; research bets stay 0", () => {
    const battery = runHostileBattery025();
    assert.equal(battery.length, 15);
    assert.ok(battery.every((x) => x.throws));
    const years = annualBankroll025({
      years: [2016, 2017],
      strictByYear: new Map([[2017, 1]]),
      decisionsByYear: new Map([[2017, 1]]),
      candidatesByYear: new Map([[2017, 0]]),
      betsByYear: new Map([[2017, 0]]),
      eventsByYear: new Map([[2017, 1]]),
    });
    assert.equal(years[1]!.end, null);
    assert.notEqual(years[1]!.end, 1000);
    assert.equal(years[1]!.status, "INSUFFICIENT_DATA");
    const matches: ClubMatchLite[] = [];
    for (let i = 0; i < 60; i++) {
      const day = new Date(Date.UTC(2010, 0, 1 + i));
      matches.push({
        eventId: `t|${i}`,
        division: "E0",
        matchDate: day,
        year: 2010,
        home: i % 2 === 0 ? "Alpha" : "Beta",
        away: i % 2 === 0 ? "Beta" : "Alpha",
        ftHome: 1,
        ftAway: 0,
        result: "HOME",
        oddHome: 1.8,
        oddDraw: 3.5,
        oddAway: 4.5,
        homeElo: 1500,
        awayElo: 1480,
      });
    }
    const diag = researchDiagnostic({ matches });
    assert.equal(diag.bets, 0);
    assert.ok(diag.decisions > 0);
    assert.ok(diag.market_brier != null);
  });

  it("frozen config, offline lab, INSUFFICIENT_DATA, no silent 1000, kaggle schema not STRICT", async () => {
    const cfg = loadExp025Config();
    assert.equal(cfg.winner, null);
    assert.equal(cfg.declared_edge, false);
    assert.equal(cfg.frozen_model_id, "market_devig");
    assert.equal(cfg.frozen_edge_threshold, 0.03);
    assert.equal(decideVerdict025(1), "INSUFFICIENT_DATA");
    const kaggle = await inspectKaggleWeekly();
    if (!kaggle.bulk_acquired) {
      assert.equal(kaggle.class_counts.A_STRICT, 0);
    }
    const scores = acquisitionScores();
    assert.ok(scores[0]!.temporalPrecision >= scores[scores.length - 1]!.temporalPrecision || scores[0]!.eigOverCost >= 0);
    const report = await runTask025({ allowNetwork: false, skipResearchCorpus: true });
    assert.equal(report.verdict, "INSUFFICIENT_DATA");
    assert.equal(report.winner, null);
    assert.equal(report.real_money, false);
    assert.equal(report.metrics.bets, 0);
    assert.equal(report.metrics.events_strict, 1);
    assert.equal(report.blind.decision.decision, "NO_BET");
    assert.equal(report.blind.decision.clv_diagnostic.used_in_decision, false);
    assert.ok(report.blind.decision.evidence_graph);
    assert.ok(report.leakage.every((l) => l.throws));
    for (const row of report.annual) {
      assert.notEqual(row.end, 1000);
      if (row.bets === 0) assert.equal(row.end, null);
    }
    const audited = auditTask025(report);
    assert.equal(audited.ok, true, audited.failures.join(","));
  });
});
