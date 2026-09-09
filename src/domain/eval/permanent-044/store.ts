import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ensurePermanentDirs044, permanentRoot044 } from "@/domain/eval/permanent-044/config";
import type {
  LearningCandidate044,
  PermanentAutopsy044,
  PermanentEvent044,
  PermanentLock044,
  PermanentPrediction044,
  PermanentQuote044,
  PermanentSettlement044,
} from "@/domain/eval/permanent-044/types";

export const LEDGER_FILES_044 = [
  "events.jsonl",
  "markets.jsonl",
  "quotes.jsonl",
  "snapshots.jsonl",
  "predictions.jsonl",
  "updates.jsonl",
  "locks.jsonl",
  "settlements.jsonl",
  "autopsies.jsonl",
  "learning-candidates.jsonl",
  "learning-cases.jsonl",
  "error-patterns.jsonl",
  "model-runs.jsonl",
  "daily-rankings.jsonl",
  "source-health.jsonl",
  "journal.jsonl",
] as const;

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

export function appendJsonl044(file: string, rec: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(rec)}\n`, "utf8");
}

export type Store044 = {
  root: string;
  events: PermanentEvent044[];
  quotes: PermanentQuote044[];
  predictions: PermanentPrediction044[];
  locks: PermanentLock044[];
  settlements: PermanentSettlement044[];
  autopsies: PermanentAutopsy044[];
  learning: LearningCandidate044[];
  eventFingerprints: Set<string>;
  eventIds: Set<string>;
  quoteFingerprints: Set<string>;
  predictionIds: Set<string>;
  lockEventIds: Set<string>;
  autopsyIds: Set<string>;
  learningIds: Set<string>;
  settlementEventIds: Set<string>;
};

export function loadStore044(root = permanentRoot044()): Store044 {
  ensurePermanentDirs044(root);
  for (const f of LEDGER_FILES_044) {
    const p = join(root, f);
    if (!existsSync(p)) writeFileSync(p, "");
  }
  const events = readJsonl<PermanentEvent044>(join(root, "events.jsonl"));
  const quotes = readJsonl<PermanentQuote044>(join(root, "quotes.jsonl"));
  const predictions = readJsonl<PermanentPrediction044>(join(root, "predictions.jsonl"));
  const locks = readJsonl<PermanentLock044>(join(root, "locks.jsonl"));
  const settlements = readJsonl<PermanentSettlement044>(join(root, "settlements.jsonl"));
  const autopsies = readJsonl<PermanentAutopsy044>(join(root, "autopsies.jsonl"));
  const learning = readJsonl<LearningCandidate044>(join(root, "learning-candidates.jsonl"));
  return {
    root,
    events,
    quotes,
    predictions,
    locks,
    settlements,
    autopsies,
    learning,
    eventFingerprints: new Set(events.map((e) => e.fingerprint)),
    eventIds: new Set(events.map((e) => e.event_id)),
    quoteFingerprints: new Set(quotes.map((q) => q.fingerprint)),
    predictionIds: new Set(predictions.map((p) => p.prediction_id)),
    lockEventIds: new Set(locks.map((l) => l.event_id)),
    autopsyIds: new Set(autopsies.map((a) => a.autopsy_id)),
    learningIds: new Set(learning.map((l) => l.candidate_id)),
    settlementEventIds: new Set(settlements.map((s) => s.event_id)),
  };
}

export function appendEvent044(store: Store044, ev: PermanentEvent044): "ok" | "dup" {
  if (store.eventFingerprints.has(ev.fingerprint)) return "dup";
  if (store.eventIds.has(ev.event_id)) return "dup";
  store.eventFingerprints.add(ev.fingerprint);
  store.eventIds.add(ev.event_id);
  store.events.push(ev);
  appendJsonl044(join(store.root, "events.jsonl"), ev);
  return "ok";
}

export function appendQuote044(store: Store044, q: PermanentQuote044): "ok" | "dup" {
  if (store.quoteFingerprints.has(q.fingerprint)) return "dup";
  store.quoteFingerprints.add(q.fingerprint);
  store.quotes.push(q);
  appendJsonl044(join(store.root, "quotes.jsonl"), q);
  return "ok";
}

export function appendPrediction044(store: Store044, p: PermanentPrediction044): "ok" | "dup" {
  if (store.predictionIds.has(p.prediction_id)) return "dup";
  store.predictionIds.add(p.prediction_id);
  store.predictions.push(p);
  appendJsonl044(join(store.root, "predictions.jsonl"), p);
  return "ok";
}

export function appendLock044(store: Store044, lock: PermanentLock044): "ok" | "dup" {
  if (store.lockEventIds.has(lock.event_id)) return "dup";
  store.lockEventIds.add(lock.event_id);
  store.locks.push(lock);
  appendJsonl044(join(store.root, "locks.jsonl"), lock);
  return "ok";
}

export function appendSettlement044(store: Store044, s: PermanentSettlement044): "ok" | "dup" {
  if (store.settlementEventIds.has(s.event_id)) return "dup";
  store.settlementEventIds.add(s.event_id);
  store.settlements.push(s);
  appendJsonl044(join(store.root, "settlements.jsonl"), s);
  return "ok";
}

export function appendAutopsy044(store: Store044, a: PermanentAutopsy044): "ok" | "dup" {
  if (store.autopsyIds.has(a.autopsy_id)) return "dup";
  store.autopsyIds.add(a.autopsy_id);
  store.autopsies.push(a);
  appendJsonl044(join(store.root, "autopsies.jsonl"), a);
  return "ok";
}

export function appendLearning044(store: Store044, c: LearningCandidate044): "ok" | "dup" {
  if (store.learningIds.has(c.candidate_id)) return "dup";
  store.learningIds.add(c.candidate_id);
  store.learning.push(c);
  appendJsonl044(join(store.root, "learning-candidates.jsonl"), c);
  return "ok";
}

export function appendJournal044(root: string, rec: Record<string, unknown>): void {
  appendJsonl044(join(root, "journal.jsonl"), { ...rec, at: new Date().toISOString() });
}

export function writeCheckpoint044(root: string, payload: Record<string, unknown>): void {
  const dir = join(root, "checkpoints");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "latest.json"), JSON.stringify({ ...payload, written_at: new Date().toISOString() }, null, 2));
}

export function loadModelRegistry044(root = permanentRoot044()): {
  current_version: string;
  versions: { version: string; parent: string | null; promoted: false; created_at: string }[];
} {
  const p = join(root, "manifests", "model-registry.json");
  if (!existsSync(p)) {
    const reg = {
      current_version: "MODEL_v1",
      versions: [
        {
          version: "MODEL_v1",
          parent: null,
          promoted: false as const,
          created_at: "2026-09-08T00:00:00.000Z",
          note: "MARKET_ONLY / MARKET_DEVIG mirror — no auto-promotion",
        },
      ],
    };
    mkdirSync(join(root, "manifests"), { recursive: true });
    writeFileSync(p, JSON.stringify(reg, null, 2));
    return reg;
  }
  return JSON.parse(readFileSync(p, "utf8"));
}
