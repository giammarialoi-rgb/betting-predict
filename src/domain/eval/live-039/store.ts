import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPayload } from "@/ingest/hash";
import type { Decision039, Event039, Journal039, Quote039, Settlement039 } from "@/domain/eval/live-039/types";

export type Store039 = {
  root: string;
  events: Event039[];
  quotes: Quote039[];
  settlements: Settlement039[];
  decisions: Decision039[];
  journal: Journal039[];
  quoteKeys: Set<string>;
};

function pathOf(root: string, name: string): string {
  return join(root, name);
}

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

export function quoteKey039(q: {
  event_id: string;
  bookmaker: string;
  market: string;
  outcome: string;
  source_quote_timestamp: string | null;
  price: number;
}): string {
  return [q.event_id, q.bookmaker, q.market, q.outcome, q.source_quote_timestamp ?? "", q.price.toFixed(6)].join("|");
}

export function loadStore039(root: string): Store039 {
  mkdirSync(root, { recursive: true });
  const quotes = readJsonl<Quote039>(pathOf(root, "quotes.jsonl"));
  return {
    root,
    events: readJsonl<Event039>(pathOf(root, "events.jsonl")),
    quotes,
    settlements: readJsonl<Settlement039>(pathOf(root, "settlements.jsonl")),
    decisions: readJsonl<Decision039>(pathOf(root, "decisions.jsonl")),
    journal: readJsonl<Journal039>(pathOf(root, "journal.jsonl")),
    quoteKeys: new Set(quotes.map((q) => quoteKey039(q))),
  };
}

function append(root: string, file: string, rec: unknown): void {
  mkdirSync(root, { recursive: true });
  appendFileSync(pathOf(root, file), `${JSON.stringify(rec)}\n`, "utf8");
}

export function upsertEvent039(store: Store039, ev: Event039): "inserted" | "touched" {
  const existing = store.events.find((e) => e.source === ev.source && e.source_event_id === ev.source_event_id);
  if (!existing) {
    store.events.push(ev);
    append(store.root, "events.jsonl", ev);
    return "inserted";
  }
  existing.last_seen_at = ev.last_seen_at;
  if (ev.commence_time && existing.commence_time !== ev.commence_time) {
    existing.commence_time = ev.commence_time;
    existing.kickoff_status = ev.kickoff_status;
  }
  writeFileSync(pathOf(store.root, "events.jsonl"), store.events.map((e) => `${JSON.stringify(e)}\n`).join(""));
  return "touched";
}

export function appendQuote039(store: Store039, q: Quote039): "ok" | "IGNORED_DUPLICATE" {
  const key = quoteKey039(q);
  if (store.quoteKeys.has(key)) return "IGNORED_DUPLICATE";
  store.quoteKeys.add(key);
  store.quotes.push(q);
  append(store.root, "quotes.jsonl", q);
  return "ok";
}

export function appendSettlement039(store: Store039, s: Settlement039): "ok" | "exists" {
  if (store.settlements.some((x) => x.event_id === s.event_id && x.outcome !== "UNSETTLED")) return "exists";
  store.settlements = store.settlements.filter((x) => x.event_id !== s.event_id);
  store.settlements.push(s);
  append(store.root, "settlements.jsonl", s);
  return "ok";
}

export function appendDecision039(store: Store039, d: Decision039): void {
  store.decisions.push(d);
  append(store.root, "decisions.jsonl", d);
}

export function appendJournal039(store: Store039, j: Journal039): void {
  store.journal.push(j);
  append(store.root, "journal.jsonl", j);
}

export function datasetFingerprint039(store: Store039): string {
  return hashPayload({
    events: store.events.map((e) => e.event_id),
    quotes: store.quotes.map((q) => quoteKey039(q)),
    classes: store.quotes.map((q) => q.temporal_class),
    settlements: store.settlements.map((s) => [s.event_id, s.outcome]),
    decisions: store.decisions.map((d) => d.decision_id),
  });
}
