import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BlindLeakageError } from "@/domain/eval/actuarial-018/integrity";
import { assertLockedBeforeReveal, assertOutcomeAbsentFromDecision } from "@/domain/eval/capital-020/lock";
import { teamKey } from "@/domain/eval/breakthrough-027/features";
import type { StrictCandidate027 } from "@/domain/eval/breakthrough-027/types";
import { marketDevig } from "@/domain/eval/turnaround-025/models";
import { actualIdx } from "@/domain/eval/validation-028/metrics";
import { corpusPartition } from "@/domain/eval/validation-028/partition";
import type { Exp028Config } from "@/domain/eval/validation-028/types";

export const FROZEN_028_SHA256_030 =
  "6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b";

export type Family030 = "elo" | "form" | "history" | "schedule" | "movement";
export type FeatureStatus030 = "AVAILABLE" | "INSUFFICIENT" | "UNAVAILABLE";
export type ModelId030 =
  | "market_only"
  | "market_elo"
  | "market_form"
  | "market_history"
  | "market_schedule"
  | "market_movement"
  | "market_all";

export type Partition030 = "TRAIN" | "VALIDATION" | "TEST" | "HOLDOUT";

const ELO_START = 1500;
const ELO_K = 20;
const DAY = 86_400_000;

export type TeamHist030 = {
  kickMs: number[];
  eloAfter: number[];
  formPts: number[];
  gf: number[];
  ga: number[];
  homeKickMs: number[];
  homePts: number[];
  awayKickMs: number[];
  awayPts: number[];
};

export type H2HRec030 = {
  kickMs: number;
  home: string;
  away: string;
  ftHome: number;
  ftAway: number;
};

export type Movement030 = {
  available: boolean;
  deltaHome: number;
  deltaDraw: number;
};

export type WalkRow030 = {
  event: StrictCandidate027;
  partition: Partition030;
  year: number;
  week: string;
  actual: 0 | 1 | 2;
  market: [number, number, number];
  asOf: string;
  locked: true;
  x: Record<Family030, number[]>;
  history_n: number;
  movement: Movement030;
};

export function assertFeatureClock(availableAtMs: number, asOfMs: number): void {
  if (!(availableAtMs <= asOfMs)) {
    throw new BlindLeakageError("feature.availableAt > asOf");
  }
}

export function leakFutureForm(formKickMs: number, asOfMs: number): void {
  if (formKickMs >= asOfMs) throw new BlindLeakageError("future form");
}

export function leakFutureElo(eloKickMs: number, asOfMs: number): void {
  if (eloKickMs >= asOfMs) throw new BlindLeakageError("future Elo");
}

export function leakFutureH2H(h2hKickMs: number, asOfMs: number): void {
  if (h2hKickMs >= asOfMs) throw new BlindLeakageError("future H2H");
}

export function leakFutureMarket(quoteMs: number, asOfMs: number): void {
  if (quoteMs > asOfMs) throw new BlindLeakageError("future market snapshot");
}

export function leakCloseBin(hoursBefore: number): void {
  if (hoursBefore < 1) throw new BlindLeakageError("close leakage");
}

export function emptyTeamHist(): TeamHist030 {
  return { kickMs: [], eloAfter: [], formPts: [], gf: [], ga: [], homeKickMs: [], homePts: [], awayKickMs: [], awayPts: [] };
}

function lastElo(t: TeamHist030, asOfMs: number): number {
  let elo = ELO_START;
  for (let i = 0; i < t.kickMs.length; i++) {
    if (t.kickMs[i]! < asOfMs) elo = t.eloAfter[i]!;
  }
  return elo;
}

function laggedSlice(t: TeamHist030, asOfMs: number): {
  formPts: number[];
  gf: number[];
  ga: number[];
  homePts: number[];
  awayPts: number[];
  kickoffs: number[];
} {
  const formPts: number[] = [];
  const gf: number[] = [];
  const ga: number[] = [];
  const kickoffs: number[] = [];
  for (let i = 0; i < t.kickMs.length; i++) {
    const k = t.kickMs[i]!;
    if (k < asOfMs) {
      formPts.push(t.formPts[i]!);
      gf.push(t.gf[i]!);
      ga.push(t.ga[i]!);
      kickoffs.push(k);
    }
  }
  const homePts: number[] = [];
  for (let i = 0; i < t.homeKickMs.length; i++) {
    if (t.homeKickMs[i]! < asOfMs) homePts.push(t.homePts[i]!);
  }
  const awayPts: number[] = [];
  for (let i = 0; i < t.awayKickMs.length; i++) {
    if (t.awayKickMs[i]! < asOfMs) awayPts.push(t.awayPts[i]!);
  }
  return { formPts, gf, ga, homePts, awayPts, kickoffs };
}

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function historyVector(input: {
  recs: readonly H2HRec030[];
  home: string;
  away: string;
  asOfMs: number;
}): { x: number[]; n: number } {
  let n = 0;
  let pts = 0;
  let gd = 0;
  for (const r of input.recs) {
    if (r.kickMs >= input.asOfMs) continue;
    n += 1;
    const homeIsCurrent = r.home === input.home;
    const ftH = homeIsCurrent ? r.ftHome : r.ftAway;
    const ftA = homeIsCurrent ? r.ftAway : r.ftHome;
    pts += ftH > ftA ? 3 : ftH === ftA ? 1 : 0;
    gd += ftH - ftA;
  }
  if (n === 0) return { x: [0, 0, 0], n: 0 };
  return { x: [Math.min(n, 10) / 10, pts / (3 * n), gd / (3 * n)], n };
}

export function movementVector(m: Movement030): number[] {
  if (!m.available) return [0, 0, 0];
  return [m.deltaHome, m.deltaDraw, Math.abs(m.deltaHome) + Math.abs(m.deltaDraw)];
}

function familyVector(input: {
  family: Family030;
  home: TeamHist030;
  away: TeamHist030;
  asOfMs: number;
  history: { x: number[] };
  movement: Movement030;
}): number[] {
  const h = laggedSlice(input.home, input.asOfMs);
  const a = laggedSlice(input.away, input.asOfMs);
  const eloH = lastElo(input.home, input.asOfMs);
  const eloA = lastElo(input.away, input.asOfMs);
  if (input.family === "elo") return [(eloH - eloA) / 400];
  if (input.family === "form") {
    const n = Math.min(5, h.formPts.length, a.formPts.length);
    const hp = n ? h.formPts.slice(-n).reduce((s, x) => s + x, 0) / (3 * n) : 0;
    const ap = n ? a.formPts.slice(-n).reduce((s, x) => s + x, 0) / (3 * n) : 0;
    const hg = n ? h.gf.slice(-n).reduce((s, x) => s + x, 0) / n : 0;
    const ag = n ? a.gf.slice(-n).reduce((s, x) => s + x, 0) / n : 0;
    return [hp - ap, (hg - ag) / 3, n / 5];
  }
  if (input.family === "history") return input.history.x;
  if (input.family === "schedule") {
    const rest = (kickoffs: number[]) => {
      const last = kickoffs[kickoffs.length - 1];
      if (last == null) return 0;
      return Math.min(21, (input.asOfMs - last) / DAY) / 14;
    };
    const cong = (kickoffs: number[]) =>
      kickoffs.filter((k) => k < input.asOfMs && input.asOfMs - k <= 7 * DAY).length / 4;
    const hs = h.homePts.length
      ? h.homePts.slice(-8).reduce((s, x) => s + x, 0) / (3 * Math.min(8, h.homePts.length))
      : 0;
    const asv = a.awayPts.length
      ? a.awayPts.slice(-8).reduce((s, x) => s + x, 0) / (3 * Math.min(8, a.awayPts.length))
      : 0;
    return [rest(h.kickoffs) - rest(a.kickoffs), cong(h.kickoffs) - cong(a.kickoffs), hs - asv];
  }
  return movementVector(input.movement);
}

export function updateTeamHist(input: {
  home: TeamHist030;
  away: TeamHist030;
  ftHome: number;
  ftAway: number;
  kickMs: number;
}): void {
  const homePts = input.ftHome > input.ftAway ? 3 : input.ftHome === input.ftAway ? 1 : 0;
  const awayPts = input.ftAway > input.ftHome ? 3 : input.ftHome === input.ftAway ? 1 : 0;
  const eloH = input.home.eloAfter[input.home.eloAfter.length - 1] ?? ELO_START;
  const eloA = input.away.eloAfter[input.away.eloAfter.length - 1] ?? ELO_START;
  const expectedHome = 1 / (1 + 10 ** (-(eloH - eloA) / 400));
  const actualHome = input.ftHome > input.ftAway ? 1 : input.ftHome === input.ftAway ? 0.5 : 0;
  input.home.kickMs.push(input.kickMs);
  input.away.kickMs.push(input.kickMs);
  input.home.eloAfter.push(eloH + ELO_K * (actualHome - expectedHome));
  input.away.eloAfter.push(eloA + ELO_K * (expectedHome - actualHome));
  input.home.formPts.push(homePts);
  input.away.formPts.push(awayPts);
  input.home.gf.push(input.ftHome);
  input.home.ga.push(input.ftAway);
  input.away.gf.push(input.ftAway);
  input.away.ga.push(input.ftHome);
  input.home.homeKickMs.push(input.kickMs);
  input.home.homePts.push(homePts);
  input.away.awayKickMs.push(input.kickMs);
  input.away.awayPts.push(awayPts);
}

export type T24Quote = { matchId: string; bookmaker: string; home: number; draw: number; away: number };

export function movementOverlayPath(skipHeavy: boolean): string {
  if (skipHeavy) {
    return join(process.cwd(), "src", "domain", "eval", "fixtures", "task-030-movement.csv");
  }
  return join(process.cwd(), "audit", "external", "task-030", "movement-t24.csv");
}

export function parseMovementCsv(text: string): T24Quote[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const header = lines[0]!.split(",");
  const iM = header.indexOf("match_id");
  const iB = header.indexOf("bookmaker");
  const iH = header.indexOf("home_odds");
  const iD = header.indexOf("draw_odds");
  const iA = header.indexOf("away_odds");
  if ([iM, iB, iH, iD, iA].some((i) => i < 0)) throw new Error("movement-t24.csv missing columns");
  const out: T24Quote[] = [];
  for (let n = 1; n < lines.length; n++) {
    const c = lines[n]!.split(",");
    const h = Number(c[iH]);
    const d = Number(c[iD]);
    const a = Number(c[iA]);
    if (!(h > 1 && d > 1 && a > 1)) continue;
    out.push({ matchId: c[iM] ?? "", bookmaker: c[iB] ?? "", home: h, draw: d, away: a });
  }
  return out;
}

export function loadMovementByMatchBook(skipHeavy: boolean): Map<string, T24Quote> {
  const p = movementOverlayPath(skipHeavy);
  const map = new Map<string, T24Quote>();
  if (!existsSync(p)) return map;
  for (const r of parseMovementCsv(readFileSync(p, "utf8"))) {
    map.set(`${r.matchId}|${r.bookmaker.toLowerCase()}`, r);
  }
  return map;
}

function movementFor(
  event: StrictCandidate027,
  t24: Map<string, T24Quote>,
  asOfMs: number,
  market: [number, number, number],
): Movement030 {
  const q = t24.get(`${event.match_id}|${event.bookmaker.toLowerCase()}`);
  if (!q) return { available: false, deltaHome: 0, deltaDraw: 0 };
  const quoteMs = Date.parse(event.kickoff) - 24 * 3600 * 1000;
  if (!Number.isFinite(quoteMs)) return { available: false, deltaHome: 0, deltaDraw: 0 };
  leakFutureMarket(quoteMs, asOfMs);
  assertFeatureClock(quoteMs, asOfMs);
  const early = marketDevig({ home: q.home, draw: q.draw, away: q.away });
  if (!early) return { available: false, deltaHome: 0, deltaDraw: 0 };
  return {
    available: true,
    deltaHome: market[0]! - early[0]!,
    deltaDraw: market[1]! - early[1]!,
  };
}

const FAMILIES: Family030[] = ["elo", "form", "history", "schedule", "movement"];

export function walk030(input: {
  events: readonly StrictCandidate027[];
  partitions: Record<Partition030, { start: string; end: string }>;
  t24: Map<string, T24Quote>;
}): WalkRow030[] {
  const cfg028 = { corpus_partitions: input.partitions } as Exp028Config;
  const teams = new Map<string, TeamHist030>();
  const h2h = new Map<string, H2HRec030[]>();
  const rows: WalkRow030[] = [];
  for (const event of input.events) {
    leakCloseBin(event.hours_before);
    const asOfMs = Date.parse(event.as_of);
    const kickMs = Date.parse(event.kickoff);
    if (!(asOfMs < kickMs)) throw new BlindLeakageError("quote not < kickoff");
    assertFeatureClock(asOfMs, asOfMs);
    const hk = teamKey(event.home);
    const ak = teamKey(event.away);
    const home = teams.get(hk) ?? emptyTeamHist();
    const away = teams.get(ak) ?? emptyTeamHist();
    if (!teams.has(hk)) teams.set(hk, home);
    if (!teams.has(ak)) teams.set(ak, away);
    const market = marketDevig({
      home: event.home_odds,
      draw: event.draw_odds,
      away: event.away_odds,
    });
    if (!market) continue;
    const payload: Record<string, unknown> = {
      event_id: event.event_id,
      as_of: event.as_of,
      odds: { home: event.home_odds, draw: event.draw_odds, away: event.away_odds },
    };
    assertOutcomeAbsentFromDecision(payload);
    if ("ft_home" in payload || "clv" in payload) {
      throw new BlindLeakageError("forbidden field in DecisionContext");
    }
    const locked = true;
    assertLockedBeforeReveal(locked);
    const pair = pairKey(hk, ak);
    const hist = historyVector({ recs: h2h.get(pair) ?? [], home: hk, away: ak, asOfMs });
    const movement = movementFor(event, input.t24, asOfMs, market);
    const x = {} as Record<Family030, number[]>;
    for (const f of FAMILIES) {
      x[f] = familyVector({ family: f, home, away, asOfMs, history: hist, movement });
    }
    const y0 = Date.UTC(Number(event.kickoff.slice(0, 4)), 0, 1);
    const weekN = Math.floor((kickMs - y0) / (7 * 86_400_000));
    rows.push({
      event,
      partition: corpusPartition(event.kickoff, cfg028),
      year: Number(event.kickoff.slice(0, 4)),
      week: `${event.kickoff.slice(0, 4)}-W${weekN}`,
      actual: actualIdx(event.ft_home, event.ft_away),
      market,
      asOf: event.as_of,
      locked,
      x,
      history_n: hist.n,
      movement,
    });
    updateTeamHist({ home, away, ftHome: event.ft_home, ftAway: event.ft_away, kickMs });
    const recs = h2h.get(pair) ?? [];
    recs.push({ kickMs, home: hk, away: ak, ftHome: event.ft_home, ftAway: event.ft_away });
    h2h.set(pair, recs);
  }
  return rows;
}
