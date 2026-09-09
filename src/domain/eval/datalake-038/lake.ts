import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { hashPayload } from "@/ingest/hash";
import { lakeRoot038 } from "@/domain/eval/datalake-038/config";
import { loadHarvest037Snapshot, manifestsFromHarvest038 } from "@/domain/eval/datalake-038/inventory";
import type { SourceManifest038 } from "@/domain/eval/datalake-038/types";

export type Lake038 = {
  roots: {
    raw: string;
    normalized: string;
    manifests: string;
    research: string;
    strict: string;
    quarantine: string;
    externalGithub: string;
  };
  sources: SourceManifest038[];
  researchEvents: number;
  referenceEvents: number;
  quarantineSources: number;
  liveStrictEligibleSources: number;
  fingerprint: string;
};

export function ensureLakeDirs038(root = lakeRoot038()): Lake038["roots"] {
  const roots = {
    raw: join(root, "raw"),
    normalized: join(root, "normalized"),
    manifests: join(root, "manifests"),
    research: join(root, "research"),
    strict: join(root, "strict"),
    quarantine: join(root, "quarantine"),
    externalGithub: join(root, "external", "github"),
  };
  for (const p of Object.values(roots)) mkdirSync(p, { recursive: true });
  mkdirSync(join(root, "external", "manifests"), { recursive: true });
  mkdirSync(join(root, "external", "catalog"), { recursive: true });
  return roots;
}

export function buildLake038(input: { acquisitionDate?: string; harvestSkip?: boolean } = {}): Lake038 {
  const roots = ensureLakeDirs038();
  const harvest = input.harvestSkip === true ? loadHarvest037Snapshot() : loadHarvest037Snapshot();
  const acquisitionDate = input.acquisitionDate ?? "2026-09-07T00:00:00.000Z";
  const sources = manifestsFromHarvest038(harvest, acquisitionDate);
  const researchEvents = sources.filter((s) => s.partition === "RESEARCH_ONLY").reduce((a, s) => a + (s.eventCount ?? 0), 0);
  const referenceEvents = sources.filter((s) => s.partition === "REFERENCE").reduce((a, s) => a + (s.eventCount ?? 0), 0);
  const fingerprint = hashPayload({
    ids: sources.map((s) => [s.sourceId, s.temporalClass, s.sha256, s.eventCount]),
    researchEvents,
    referenceEvents,
  });
  return {
    roots,
    sources,
    researchEvents,
    referenceEvents,
    quarantineSources: sources.filter((s) => s.partition === "QUARANTINE").length,
    liveStrictEligibleSources: sources.filter((s) => s.strictEligible).length,
    fingerprint,
  };
}

export function persistLake038(lake: Lake038): void {
  const { roots, sources } = lake;
  writeFileSync(
    join(roots.raw, "pointers.json"),
    JSON.stringify(
      {
        note: "Raw GitHub clones remain immutable under data/external/github/_clones (gitignored). This file is the committed pointer index. Do not alter raw blobs.",
        clones: "data/external/github/_clones/<owner>__<repo>/",
        live_raw: "audit/external/task-038/raw/ (gitignored append-only)",
        sources: sources.map((s) => ({
          sourceId: s.sourceId,
          repository: s.repository,
          sha256: s.sha256,
          commit: s.commit,
          originalUrl: s.originalUrl,
        })),
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(roots.normalized, "index.json"),
    JSON.stringify(
      {
        events_research: lake.researchEvents,
        events_reference: lake.referenceEvents,
        events_new_strict: 0,
        note: "acquired != strict usable. Normalized live quotes stay in the append-only ledger, not here.",
      },
      null,
      2,
    ),
  );
  writeFileSync(join(roots.manifests, "task-038-sources.json"), JSON.stringify(sources, null, 2));
  for (const s of sources) {
    writeFileSync(join(roots.manifests, `${s.sourceId}.json`), JSON.stringify(s, null, 2));
  }
  writeFileSync(
    join(roots.research, "index.json"),
    JSON.stringify(
      {
        partition: "RESEARCH_ONLY",
        usable_for_capital: false,
        sources: sources.filter((s) => s.researchEligible && s.partition !== "CAPITAL_STRICT").map((s) => s.sourceId),
        events: lake.researchEvents,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(roots.strict, "index.json"),
    JSON.stringify(
      {
        partition: "CAPITAL_STRICT",
        task_031_base_counted: false,
        live_events: 0,
        allowlist: ["the-odds-api"],
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(roots.strict, "task-031-base.pointer.json"),
    JSON.stringify(
      {
        sourceId: "task-031-base",
        sha256: sources.find((s) => s.sourceId === "task-031-base")?.sha256,
        events: 10499,
        counted_as_038_strict: false,
        capital_038: false,
        split: "HISTORICAL_REFERENCE",
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(roots.quarantine, "index.json"),
    JSON.stringify(
      {
        partition: "QUARANTINE",
        sources: sources.filter((s) => s.partition === "QUARANTINE").map((s) => ({ id: s.sourceId, why: s.rejectionReason })),
      },
      null,
      2,
    ),
  );
  const extManifests = join(process.cwd(), "data", "external", "manifests");
  if (existsSync(join(process.cwd(), "data", "external"))) {
    mkdirSync(extManifests, { recursive: true });
    writeFileSync(join(extManifests, "task-038-sources.json"), JSON.stringify(sources, null, 2));
  }
}
