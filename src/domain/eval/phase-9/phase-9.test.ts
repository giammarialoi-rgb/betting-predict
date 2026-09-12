import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, it } from "node:test";
import { normalizeFootballDataCsv } from "@/domain/eval/predictive-intelligence/dataset/normalize";
import { assertNoMarketInputsInPredictionContext } from "@/domain/eval/predictive-intelligence/features/asof";
import { buildFeatureVectorPi } from "@/domain/eval/predictive-intelligence/features/engine";
import { NEON_IN_USE } from "@/domain/storage";
import {
  assertFeatureVectorFirewall,
  assertNoRandomSplit,
  assertPreviousMatchBeforeKickoff,
  leakageAuditReport,
} from "@/domain/eval/phase-9/firewall";
import { assertWindowsTemporal, buildWalkForwardWindows } from "@/domain/eval/phase-9/splits";
import { settle1x2Selection, settleMarket } from "@/domain/eval/phase-9/markets";
import { decidePhase9Status, recordPhase9Entry, assertNeverAutoPromote } from "@/domain/eval/phase-9/registry";
import { chooseThresholdOnVal, valueSlice } from "@/domain/eval/phase-9/value";
import { qualityMetrics1x2 } from "@/domain/eval/phase-9/metrics";
import { runPhase9Backtest } from "@/domain/eval/phase-9/run";
import type { Phase9Match } from "@/domain/eval/phase-9/types";
import { PHASE9_NON_DETERMINABILE } from "@/domain/eval/phase-9/types";

function seasonCsv(seasonStartYear: number, n: number, teams: string[]): string {
  const hdr =
    "Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,HTHG,HTAG,HTR,HS,AS,HST,AST,HC,AC,HY,AY,HR,AR,B365H,B365D,B365A,B365CH,B365CD,B365CA,AvgH,AvgD,AvgA,B365>2.5,B365<2.5";
  const rows: string[] = [hdr];
  let d = new Date(Date.UTC(seasonStartYear, 7, 14));
  for (let i = 0; i < n; i += 1) {
    const h = teams[i % teams.length]!;
    const a = teams[(i + 1) % teams.length]!;
    const hg = i % 3;
    const ag = (i + 1) % 3;
    const ftr = hg > ag ? "H" : hg < ag ? "A" : "D";
    const day = `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
    rows.push(
      [
        "E0",
        day,
        "15:00",
        h,
        a,
        hg,
        ag,
        ftr,
        0,
        0,
        "D",
        10,
        8,
        4,
        3,
        5,
        4,
        1,
        2,
        0,
        0,
        2.1,
        3.4,
        3.5,
        2.05,
        3.5,
        3.6,
        2.12,
        3.3,
        3.4,
        1.9,
        1.9,
      ].join(","),
    );
    d = new Date(d.getTime() + 86400000 * 3);
  }
  return rows.join("\n");
}

function matchesForSeasons(specs: { code: string; year: number; n: number }[]): Phase9Match[] {
  const teams = ["Arsenal", "Chelsea", "Liverpool", "Everton", "Tottenham", "West Ham"];
  const all: Phase9Match[] = [];
  for (const s of specs) {
    const { matches } = normalizeFootballDataCsv({
      csvText: seasonCsv(s.year, s.n, teams),
      season: s.code,
      league: "E0",
    });
    all.push(...(matches as Phase9Match[]));
  }
  return all;
}

describe("Phase 9 — neon ban", () => {
  it("filesystem only", () => {
    assert.equal(NEON_IN_USE, false);
  });
});

describe("Phase 9 — leakage firewalls", () => {
  it("rejects random split", () => {
    assert.throws(() => assertNoRandomSplit("random"), /RANDOM_SPLIT_FORBIDDEN|Random split/);
    assert.throws(() => buildWalkForwardWindows([], "random"));
  });

  it("rejects target and future features / previous after kickoff", () => {
    const matches = matchesForSeasons([{ code: "2122", year: 2021, n: 40 }]);
    const later = matches[30]!;
    const earlier = matches[5]!;
    assertPreviousMatchBeforeKickoff({ previous: earlier, target: later });
    assert.throws(() => assertPreviousMatchBeforeKickoff({ previous: later, target: earlier }));
    assert.throws(() => assertPreviousMatchBeforeKickoff({ previous: later, target: later }), /TARGET_LEAKAGE/);
    const feat = buildFeatureVectorPi(later, matches);
    assertFeatureVectorFirewall(feat, later);
    assert.throws(() => assertNoMarketInputsInPredictionContext(["odds_open_home"]));
    assert.throws(() => assertNoMarketInputsInPredictionContext(["B365C"]));
    assert.ok(!Object.keys(feat.values).some((k) => /odds|b365|market_prob|implied/i.test(k)));
  });

  it("leakage audit records DATE_ONLY and odds pass", () => {
    const matches = matchesForSeasons([{ code: "2122", year: 2021, n: 30 }]);
    const t = matches[20]!;
    const feat = buildFeatureVectorPi(t, matches);
    const audit = leakageAuditReport({
      matches,
      sampleFeatures: [{ target: t, keys: Object.keys(feat.values) }],
      splitMethod: "walk_forward",
    });
    assert.equal(audit.odds_pass, true);
    assert.equal(audit.target_pass, true);
    assert.equal(audit.random_split_rejected, true);
    assert.equal(audit.date_only_policy, "DATE_ONLY_CONSERVATIVE");
    assert.equal(audit.neon_in_use, false);
  });
});

describe("Phase 9 — splits", () => {
  it("walk-forward windows are chronological and disjoint", () => {
    const matches = matchesForSeasons([
      { code: "1920", year: 2019, n: 24 },
      { code: "2021", year: 2020, n: 24 },
      { code: "2122", year: 2021, n: 24 },
      { code: "2223", year: 2022, n: 24 },
    ]);
    const w = buildWalkForwardWindows(matches);
    assert.ok(w.length >= 2);
    assertWindowsTemporal(w);
    for (const win of w) {
      assert.ok(win.train_end <= win.val_start);
      assert.ok(win.val_end <= win.oos_start);
      assert.ok(!win.train_seasons.includes(win.oos_seasons[0]!));
    }
  });
});

describe("Phase 9 — settlement", () => {
  it("settles 1X2 / BTTS / O-U / DNB void", () => {
    const matches = matchesForSeasons([{ code: "2122", year: 2021, n: 6 }]);
    const m = matches.find((x) => x.fthg > 0 && x.ftag > 0) ?? matches[0]!;
    assert.equal(settle1x2Selection(m.ftr, m.ftr), true);
    assert.equal(settle1x2Selection("HOME", "AWAY"), false);
    const btts = settleMarket("BTTS", m);
    assert.equal(btts.settled, true);
    assert.equal(btts.won, m.fthg > 0 && m.ftag > 0);
    const ou = settleMarket("OU_2_5", { ...m, fthg: 2, ftag: 1 });
    assert.equal(ou.won, true);
    const dnb = settleMarket("DNB", { ...m, ftr: "DRAW", fthg: 1, ftag: 1 });
    assert.equal(dnb.voided, true);
    const cornersMissing = settleMarket("CORNERS_O9_5", { ...m, hc: null, ac: null });
    assert.equal(cornersMissing.settled, false);
    assert.equal(cornersMissing.reason, PHASE9_NON_DETERMINABILE);
  });
});

describe("Phase 9 — promotion and insufficient sample", () => {
  it("never auto-promotes; leakage retires; small N is insufficient", () => {
    const leak = decidePhase9Status({
      leakage_pass: false,
      train_n: 400,
      validate_n: 100,
      oos_n: 100,
      supported: true,
      windows_total: 3,
      windows_beat_naive: 3,
      oos_log_loss: 0.9,
      naive_log_loss: 1.1,
      oos_brier: 0.2,
      naive_brier: 0.3,
      calibration_error: 0.02,
      min_train: 20,
    });
    assert.equal(leak.status, "RETIRED");
    const small = decidePhase9Status({
      leakage_pass: true,
      train_n: 5,
      validate_n: 5,
      oos_n: 5,
      supported: false,
      windows_total: 0,
      windows_beat_naive: 0,
      oos_log_loss: null,
      naive_log_loss: null,
      oos_brier: null,
      naive_brier: null,
      calibration_error: null,
      min_train: 20,
    });
    assert.equal(small.status, "INSUFFICIENT_EVIDENCE");
    const cand = decidePhase9Status({
      leakage_pass: true,
      train_n: 400,
      validate_n: 100,
      oos_n: 100,
      supported: true,
      windows_total: 3,
      windows_beat_naive: 3,
      oos_log_loss: 0.9,
      naive_log_loss: 1.1,
      oos_brier: 0.2,
      naive_brier: 0.3,
      calibration_error: 0.02,
      min_train: 20,
    });
    assert.equal(cand.status, "CANDIDATE");
    assert.ok(cand.reasons.includes("NO_AUTO_PROMOTION"));
    const root = mkdtempSync(join(tmpdir(), "p9-reg-"));
    mkdirSync(join(root, "manifests"), { recursive: true });
    const rec = recordPhase9Entry({
      root,
      model_id: "INDEPENDENT_POISSON_v1",
      version: "t",
      leakage_pass: true,
      train_n: 400,
      validate_n: 100,
      oos_n: 100,
      windows_beat_naive: 3,
      windows_total: 3,
      supported: true,
      min_train: 20,
      metrics_oos: { log_loss: 0.9, naive_log_loss: 1.1, brier: 0.2, naive_brier: 0.3, calibration_error: 0.02 },
    });
    assert.notEqual(rec.status, "PROMOTED");
    assert.equal(rec.production, false);
    assertNeverAutoPromote(rec);
  });

  it("quality metrics flag insufficient sample", () => {
    const q = qualityMetrics1x2([
      { p: { HOME: 0.5, DRAW: 0.3, AWAY: 0.2 }, y: "HOME" },
      { p: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 }, y: "DRAW" },
    ]);
    assert.equal(q.insufficient, true);
    assert.ok(q.insufficient_reason);
  });
});

describe("Phase 9 — value threshold on VAL only", () => {
  it("does not peek OOS to choose threshold", () => {
    const val = Array.from({ length: 40 }, (_, i) => ({
      canonical_id: `v${i}`,
      season: "2122",
      league: "E0",
      match_date: "2022-01-01",
      y: (i % 3 === 0 ? "HOME" : i % 3 === 1 ? "DRAW" : "AWAY") as const,
      fthg: 1,
      ftag: 0,
      p: { HOME: 0.55, DRAW: 0.25, AWAY: 0.2 },
      market_p: { HOME: 0.4, DRAW: 0.3, AWAY: 0.3 },
      odds: { home: 2.2, draw: 3.4, away: 3.5 },
      lambda_home: 1.4,
      lambda_away: 1.0,
    }));
    const oos = val.map((r, i) => ({ ...r, canonical_id: `o${i}`, p: { HOME: 0.2, DRAW: 0.2, AWAY: 0.6 } }));
    const chosen = chooseThresholdOnVal(val);
    assert.ok(chosen.threshold == null || EDGE_OK(chosen.threshold));
    const sl = valueSlice(oos, 0.03, "GRID_REPORT_ONLY");
    assert.ok(sl.n_bets >= 0);
  });
});

function EDGE_OK(t: number): boolean {
  return [0.01, 0.02, 0.03, 0.05, 0.07, 0.1].includes(t);
}

describe("Phase 9 — end-to-end synthetic OOS", () => {
  it("runs walk-forward on synthetic seasons without Neon or random split", async () => {
    const matches = matchesForSeasons([
      { code: "1920", year: 2019, n: 80 },
      { code: "2021", year: 2020, n: 80 },
      { code: "2122", year: 2021, n: 80 },
      { code: "2223", year: 2022, n: 80 },
    ]);
    const root = mkdtempSync(join(tmpdir(), "p9-run-"));
    mkdirSync(join(root, "predictive-intelligence", "datasets"), { recursive: true });
    writeFileSync(
      join(root, "predictive-intelligence", "datasets", "matches.jsonl"),
      matches.map((m) => JSON.stringify(m)).join("\n") + "\n",
    );
    const result = await runPhase9Backtest({
      labBRoot: root,
      skipFetch: true,
      matches,
      nowIso: "2026-09-12T00:00:00.000Z",
    });
    assert.equal(result.neon_in_use, false);
    assert.equal(result.promoted, 0);
    assert.ok(result.windows >= 1);
    assert.ok(result.rows === matches.length);
  });
});
