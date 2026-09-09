import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { hashPayload } from "@/ingest/hash";
import type {
  DecisionContext036,
  ProspectiveEvent036,
  ProspectiveQuote036,
  ProspectiveSnapshot036,
  SourcePull036,
} from "@/domain/eval/prospective-036/types";

export type ProspectiveStore036 = {
  root: string;
  events: ProspectiveEvent036[];
  quotes: ProspectiveQuote036[];
  snapshots: ProspectiveSnapshot036[];
  decisions: DecisionContext036[];
  journal: SourcePull036[];
  observationKeys: Set<string>;
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

export function observationKey(input: {
  source: string;
  source_record_id: string;
  source_timestamp: string | null;
  market: string;
  selection: string;
  price: number;
}): string {
  return [
    input.source,
    input.source_record_id,
    input.source_timestamp ?? "",
    input.market,
    input.selection,
    input.price.toFixed(6),
  ].join("|");
}

export function loadStore036(root: string): ProspectiveStore036 {
  mkdirSync(root, { recursive: true });
  const quotes = readJsonl<ProspectiveQuote036>(pathOf(root, "quotes.jsonl"));
  return {
    root,
    events: readJsonl<ProspectiveEvent036>(pathOf(root, "events.jsonl")),
    quotes,
    snapshots: readJsonl<ProspectiveSnapshot036>(pathOf(root, "snapshots.jsonl")),
    decisions: readJsonl<DecisionContext036>(pathOf(root, "decisions.jsonl")),
    journal: readJsonl<SourcePull036>(pathOf(root, "journal.jsonl")),
    observationKeys: new Set(
      quotes.map((q) =>
        observationKey({
          source: q.source,
          source_record_id: q.source_record_id,
          source_timestamp: q.source_timestamp_utc,
          market: q.market,
          selection: q.selection,
          price: q.odds_decimal,
        }),
      ),
    ),
  };
}

export function appendRecord(root: string, file: string, rec: unknown): void {
  mkdirSync(root, { recursive: true });
  appendFileSync(pathOf(root, file), `${JSON.stringify(rec)}\n`, "utf8");
}

export function appendEvent(store: ProspectiveStore036, ev: ProspectiveEvent036): void {
  store.events.push(ev);
  appendRecord(store.root, "events.jsonl", ev);
}

export function appendQuote(store: ProspectiveStore036, q: ProspectiveQuote036): "ok" | "IGNORED_DUPLICATE" {
  const key = observationKey({
    source: q.source,
    source_record_id: q.source_record_id,
    source_timestamp: q.source_timestamp_utc,
    market: q.market,
    selection: q.selection,
    price: q.odds_decimal,
  });
  if (store.observationKeys.has(key)) return "IGNORED_DUPLICATE";
  store.observationKeys.add(key);
  store.quotes.push(q);
  appendRecord(store.root, "quotes.jsonl", q);
  return "ok";
}

export function appendSnapshot(store: ProspectiveStore036, s: ProspectiveSnapshot036): void {
  store.snapshots.push(s);
  appendRecord(store.root, "snapshots.jsonl", s);
}

export function appendDecision(store: ProspectiveStore036, d: DecisionContext036): void {
  store.decisions.push(d);
  appendRecord(store.root, "decisions.jsonl", d);
}

export function appendJournal(store: ProspectiveStore036, j: SourcePull036): void {
  store.journal.push(j);
  appendRecord(store.root, "journal.jsonl", j);
}

export function appendAudit036(root: string, rec: { at_utc: string; code: string; detail: string }): void {
  appendRecord(root, "audit.jsonl", rec);
}

export function datasetFingerprint036(store: ProspectiveStore036): string {
  return hashPayload({
    events: store.events.map((e) => e.event_id),
    quotes: store.quotes.map((q) => q.observation_id),
    snapshots: store.snapshots.map((s) => s.snapshot_id),
    decisions: store.decisions.map((d) => d.decision_id),
  });
}
