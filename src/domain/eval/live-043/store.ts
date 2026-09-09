import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { artifactStore043 } from "@/domain/eval/live-043/config";
import type {
  AutopsyRecord043,
  CatalogEvent043,
  ModelRegistry043,
  PredictionRecord043,
  Snapshot043,
  Triangulation043,
} from "@/domain/eval/live-043/types";

function readJsonl<T>(file: string): T[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l) as T);
}

function appendJsonl(file: string, rec: unknown): void {
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify(rec)}\n`, "utf8");
}

export type Store043 = {
  root: string;
  catalog: CatalogEvent043[];
  predictions: PredictionRecord043[];
  snapshots: Snapshot043[];
  triangulations: Triangulation043[];
  autopsies: AutopsyRecord043[];
  catalogKeys: Set<string>;
  snapshotKeys: Set<string>;
};

export function loadStore043(root = artifactStore043()): Store043 {
  mkdirSync(root, { recursive: true });
  const catalog = readJsonl<CatalogEvent043>(join(root, "catalog.jsonl"));
  const snapshots = readJsonl<Snapshot043>(join(root, "snapshots.jsonl"));
  return {
    root,
    catalog,
    predictions: readJsonl<PredictionRecord043>(join(root, "predictions.jsonl")),
    snapshots,
    triangulations: readJsonl<Triangulation043>(join(root, "triangulation.jsonl")),
    autopsies: readJsonl<AutopsyRecord043>(join(root, "autopsy.jsonl")),
    catalogKeys: new Set(catalog.map((c) => c.stable_key)),
    snapshotKeys: new Set(snapshots.map((s) => `${s.event_id}|${s.window}|${s.source_available_at}`)),
  };
}

export function upsertCatalog043(store: Store043, ev: CatalogEvent043): "inserted" | "touched" {
  const existing = store.catalog.find((c) => c.stable_key === ev.stable_key);
  if (!existing) {
    store.catalog.push(ev);
    store.catalogKeys.add(ev.stable_key);
    appendJsonl(join(store.root, "catalog.jsonl"), ev);
    return "inserted";
  }
  existing.status = ev.status;
  existing.commence_time = ev.commence_time ?? existing.commence_time;
  writeFileSync(join(store.root, "catalog.jsonl"), store.catalog.map((c) => `${JSON.stringify(c)}\n`).join(""));
  return "touched";
}

export function upsertPrediction043(store: Store043, pred: PredictionRecord043): void {
  const i = store.predictions.findIndex((p) => p.event_id === pred.event_id);
  if (i >= 0) {
    // never unlock a LOCKED formal record's locked flag / as_of
    const prev = store.predictions[i]!;
    if (prev.locked && prev.formal_scientific) {
      store.predictions[i] = {
        ...pred,
        locked: true,
        formal_scientific: true,
        as_of: prev.as_of,
        model_probability: prev.model_probability,
        market_probability: prev.market_probability,
        status: pred.status === "SETTLED" || pred.status === "AUTOPSY_DONE" || pred.status === "AUTOPSY_PENDING" ? pred.status : prev.status,
      };
    } else {
      store.predictions[i] = pred;
    }
  } else {
    store.predictions.push(pred);
  }
  writeFileSync(join(store.root, "predictions.jsonl"), store.predictions.map((p) => `${JSON.stringify(p)}\n`).join(""));
}

export function appendSnapshot043(store: Store043, snap: Snapshot043): "ok" | "dup" {
  const key = `${snap.event_id}|${snap.window}|${snap.source_available_at}`;
  if (store.snapshotKeys.has(key)) return "dup";
  store.snapshotKeys.add(key);
  store.snapshots.push(snap);
  appendJsonl(join(store.root, "snapshots.jsonl"), snap);
  return "ok";
}

export function upsertTriangulation043(store: Store043, t: Triangulation043): void {
  const i = store.triangulations.findIndex((x) => x.event_id === t.event_id && x.market === t.market && x.as_of === t.as_of);
  if (i >= 0) store.triangulations[i] = t;
  else store.triangulations.push(t);
  writeFileSync(join(store.root, "triangulation.jsonl"), store.triangulations.map((x) => `${JSON.stringify(x)}\n`).join(""));
}

export function appendAutopsy043(store: Store043, a: AutopsyRecord043): void {
  if (store.autopsies.some((x) => x.event_id === a.event_id && x.model_version === a.model_version)) return;
  store.autopsies.push(a);
  appendJsonl(join(store.root, "autopsy.jsonl"), a);
}

export function loadModelRegistry043(root = artifactStore043()): ModelRegistry043 {
  const p = join(root, "model-registry.json");
  if (!existsSync(p)) {
    const reg: ModelRegistry043 = {
      current_version: "MODEL_v1",
      versions: [
        {
          version: "MODEL_v1",
          training_cutoff: null,
          training_events: 0,
          validation_events: 0,
          features_used: ["MARKET_DEVIG"],
          hyperparameters: { kind: "MARKET_ONLY" },
          creation_timestamp: "2026-09-08T00:00:00.000Z",
          dataset_fingerprint: "market_only_v1",
          production: true,
        },
      ],
    };
    mkdirSync(root, { recursive: true });
    writeFileSync(p, JSON.stringify(reg, null, 2));
    return reg;
  }
  return JSON.parse(readFileSync(p, "utf8")) as ModelRegistry043;
}

export function saveModelRegistry043(reg: ModelRegistry043, root = artifactStore043()): void {
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, "model-registry.json"), JSON.stringify(reg, null, 2));
}
