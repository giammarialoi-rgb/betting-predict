import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ExperimentIntegrityError } from "@/domain/eval/actuarial-018/integrity";
import type { OddsSourceAdapter } from "@/domain/eval/prospective-036/adapter";
import { collectOnce036 } from "@/domain/eval/prospective-036/collector";
import { loadStore036, type ProspectiveStore036 } from "@/domain/eval/prospective-036/store";
import { isProductionLedger038 } from "@/domain/eval/datalake-038/config";
import { assertNotFixtureInProduction038 } from "@/domain/eval/datalake-038/isolation";
import { canEnterStrict038 } from "@/domain/eval/datalake-038/classify";
import { matchGrade038 } from "@/domain/eval/datalake-038/matching";

export function persistRaw038(root: string, source: string, payload: unknown): { sha256: string; bytes: number; path: string } {
  const text = JSON.stringify(payload);
  const sha256 = createHash("sha256").update(text).digest("hex");
  const dir = join(root, "raw", source);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${sha256}.json`);
  if (!existsSync(path)) writeFileSync(path, text);
  return { sha256, bytes: Buffer.byteLength(text), path };
}

export function listRawHashes038(store: ProspectiveStore036): string[] {
  return [...new Set(store.journal.map((j) => (j as { raw_hash?: string }).raw_hash).filter((h): h is string => Boolean(h)))];
}

export async function collectOnce038(input: {
  store: ProspectiveStore036;
  adapters: readonly OddsSourceAdapter[];
  clock?: { now(): Date };
  lockT1h?: boolean;
}): Promise<{
  pulls: number;
  events: number;
  quotes: number;
  duplicates: number;
  strictQuotes: number;
  locked: number;
  rawHashes: string[];
}> {
  for (const adapter of input.adapters) {
    assertNotFixtureInProduction038({
      production: isProductionLedger038(input.store.root),
      provenance: adapter.getProvenance(),
      source: adapter.id,
    });
  }
  const rawHashes: string[] = [];
  const wrapped = input.adapters.map((adapter) => {
    const innerPull = adapter.pull.bind(adapter);
    return {
      ...adapter,
      async pull(req: { requestedAtUtc: string }) {
        const pull = await innerPull(req);
        if (pull.raw_json !== undefined) {
          const saved = persistRaw038(input.store.root, pull.source, pull.raw_json);
          rawHashes.push(saved.sha256);
          if (pull.raw_hash && saved.sha256 !== pull.raw_hash) {
            throw new ExperimentIntegrityError("RAW_HASH_MISMATCH");
          }
          if (Array.isArray(pull.raw_json)) {
            for (const part of pull.raw_json) {
              if (part && typeof part === "object" && "body" in part && (part as { body?: unknown }).body != null) {
                const sport = String((part as { sport?: string }).sport ?? "sport");
                persistRaw038(input.store.root, `${pull.source}/${sport}`, (part as { body: unknown }).body);
              }
            }
          }
        } else if (pull.status === "ok" && pull.quotes.length > 0 && isProductionLedger038(input.store.root)) {
          throw new ExperimentIntegrityError("RAW_ARTIFACT_MISSING_HASH");
        }
        return pull;
      },
    } satisfies OddsSourceAdapter;
  });
  const result = await collectOnce036({
    store: input.store,
    adapters: wrapped,
    clock: input.clock,
    lockT1h: input.lockT1h,
  });
  const strictQuotes = input.store.quotes.filter((q) =>
    canEnterStrict038({
      quoteTimestampUtc: q.source_timestamp_utc,
      kickoffUtc: q.kickoff_at_utc,
      temporalBasis: q.temporal_basis,
      clientRetrievedAt: q.temporal_basis === "COLLECTOR_TIMESTAMP" ? q.collector_timestamp_utc : null,
      match: matchGrade038({
        home: q.home_team,
        away: q.away_team,
        kickoffUtc: q.kickoff_at_utc,
        competition: q.competition,
        sourceEventId: q.source_event_id,
      }),
      market: q.market,
      provenance: q.source,
    }),
  ).length;
  return { ...result, strictQuotes, rawHashes };
}

export function loadStore038(root: string): ProspectiveStore036 {
  return loadStore036(root);
}
