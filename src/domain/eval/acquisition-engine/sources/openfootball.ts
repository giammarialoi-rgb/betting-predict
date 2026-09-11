/**
 * OpenFootball public GitHub JSON — historical/research season packs.
 * DATE_ONLY. Not live. available_at unknown → NOT_ELIGIBLE.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acquisitionGet } from "@/domain/eval/acquisition-engine/http";
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import { registerAcquisitionSource } from "@/domain/eval/acquisition-engine/persist";
import { OPENFOOTBALL_PACKS, openFootballUrl } from "@/domain/eval/acquisition-engine/catalog";
import type { AcquisitionRecord, SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

export type OpenFootballMatch = {
  date?: string;
  team1?: string;
  team2?: string;
  round?: string;
};

export function parseOpenFootballPack(jsonText: string): { name: string | null; matches: OpenFootballMatch[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { name: null, matches: [] };
  }
  if (!parsed || typeof parsed !== "object") return { name: null, matches: [] };
  const rec = parsed as { name?: unknown; matches?: unknown };
  const name = typeof rec.name === "string" ? rec.name : null;
  if (!Array.isArray(rec.matches)) return { name, matches: [] };
  const matches = rec.matches.filter((row) => row && typeof row === "object") as OpenFootballMatch[];
  return { name, matches };
}

export async function runOpenFootballLane(input: {
  url: string;
  nowIso: string;
  cwd: string;
  persistNeon: boolean;
  jsonText?: string;
  fetchImpl?: typeof fetch;
  maxRetries?: number;
}): Promise<SourceLaneResult> {
  const cacheDir = join(input.cwd, "data", "acquisition", "openfootball");
  mkdirSync(cacheDir, { recursive: true });

  const packs: Array<{ label: string; matches: number }> = [];
  let http = 200;
  let retries = 0;
  let url = input.url;
  let lastError: string | null = null;
  let total = 0;

  if (input.jsonText != null) {
    const parsed = parseOpenFootballPack(input.jsonText);
    writeFileSync(join(cacheDir, "en.1.json"), input.jsonText, "utf8");
    total = parsed.matches.length;
    if (parsed.matches.length) packs.push({ label: parsed.name ?? "en.1", matches: parsed.matches.length });
  } else {
    for (const pack of OPENFOOTBALL_PACKS) {
      const got = await acquisitionGet({
        url: openFootballUrl(pack.path),
        sourceId: "openfootball",
        minIntervalMs: input.fetchImpl ? 0 : 800,
        fetchImpl: input.fetchImpl,
        maxRetries: input.maxRetries,
      });
      retries += got.retries;
      http = got.status;
      url = got.url;
      if (!got.ok) {
        lastError = got.error ?? `HTTP_${got.status}`;
        continue;
      }
      const parsed = parseOpenFootballPack(got.text);
      if (!parsed.matches.length) continue;
      const file = pack.path.replace(/\//g, "_");
      writeFileSync(join(cacheDir, file), got.text, "utf8");
      packs.push({ label: parsed.name ?? pack.label, matches: parsed.matches.length });
      total += parsed.matches.length;
    }
  }

  if (!total) {
    return emptyLane({
      source_id: "openfootball",
      url,
      status: lastError ? "NETWORK_ERROR" : "NO_DATA",
      http_status: http || null,
      retries,
      reason: lastError ?? "EMPTY_PACKS",
      reason_it: "OpenFootball non ha restituito partite. Dataset storico; nessun dato inventato.",
    });
  }

  const records: AcquisitionRecord[] = [
    {
      source_id: "openfootball",
      kind: "research_dataset",
      feature_key: "openfootball_matches",
      value: total,
      event_id: null,
      home: null,
      away: null,
      kickoff_iso: null,
      team_name: null,
      observed_at: input.nowIso,
      available_at: null,
      temporal_precision: "date_only",
      feature_status: "NOT_ELIGIBLE",
      enters_independent_model: false,
      extraction_method: "openfootball_github_json",
      source_url: url,
      identity_status: "UNBOUND",
      reason_it: `Dataset OpenFootball (${total} partite, ${packs.length} pacchetti). Storico DATE_ONLY; non live; escluso dal modello pre-match.`,
    },
  ];

  let neon = { source_registered: false, elo_stored: 0, features_stored: 0, reason: null as string | null };
  if (input.persistNeon) {
    neon = await registerAcquisitionSource({
      slug: "openfootball",
      name: "OpenFootball football.json",
      licenseClass: "dataset",
    });
  }

  return {
    source_id: "openfootball",
    ok: true,
    fetched: true,
    status: "OK",
    http_status: http,
    url,
    records,
    fields_extracted: ["openfootball_matches"],
    reason: `matches=${total}; packs=${packs.map((p) => p.label).join(" | ")}; NOT_ELIGIBLE historical`,
    reason_it: `OpenFootball: ${total} partite storiche in ${packs.length} pacchetti. Non live, non nel modello indipendente.`,
    retries,
    cache_path: join(cacheDir, "en.1.json"),
    neon,
    coverage: { leagues: packs.map((p) => p.label), sports: ["football"] },
  };
}
