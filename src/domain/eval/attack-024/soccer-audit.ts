import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { soccerAuditFixturePath, soccerSampleFixturePath } from "@/domain/eval/attack-024/config";
import type {
  FileHashCheck024,
  SoccerAudit024,
  SoccerOddsSample024,
  TemporalAuditRow024,
} from "@/domain/eval/attack-024/types";
import {
  classifyKickoffPrecision,
  classifyQuotePrecision,
  classifyTemporalRelation,
  deltaSeconds,
  parseClockMs,
  temporalClassFromRelation,
} from "@/domain/eval/attack-024/temporal";

export const TASK024_CACHE_DIR = join(process.cwd(), "audit", "external", "task-024");

export const SOCCER_PARQUET_FILES = [
  "odds.parquet",
  "fixtures.parquet",
  "leagues.parquet",
  "teams.parquet",
  "match_stats.parquet",
  "fixture_lineups.parquet",
] as const;

export function loadSoccerAudit(): SoccerAudit024 {
  return JSON.parse(readFileSync(soccerAuditFixturePath(), "utf8")) as SoccerAudit024;
}

export function loadSoccerSamples(): SoccerOddsSample024[] {
  return JSON.parse(readFileSync(soccerSampleFixturePath(), "utf8")) as SoccerOddsSample024[];
}

export function verifySoccerParquet(audit: SoccerAudit024): FileHashCheck024[] {
  return SOCCER_PARQUET_FILES.map((file) => {
    const path = join(TASK024_CACHE_DIR, file);
    const expected = audit.files[file];
    if (!existsSync(path)) {
      return {
        file,
        present: false,
        bytes: null,
        sha256: null,
        sha256_expected: expected?.sha256 ?? null,
        match: null,
      };
    }
    const buf = readFileSync(path);
    const sha = createHash("sha256").update(buf).digest("hex");
    return {
      file,
      present: true,
      bytes: statSync(path).size,
      sha256: sha,
      sha256_expected: expected?.sha256 ?? null,
      match: expected ? sha === expected.sha256 && buf.length === expected.bytes : null,
    };
  });
}

export function classifySoccerSample(row: SoccerOddsSample024): TemporalAuditRow024 {
  const kickoff = classifyKickoffPrecision({
    kickoffRaw: row.kickoff,
    timezoneProven: true,
  });
  const quote = classifyQuotePrecision({
    quoteRaw: row.odds_known_at,
    timezoneProven: true,
    isRelativeBin: false,
  });
  const quoteMs = parseClockMs(row.odds_known_at);
  const kickoffMs = parseClockMs(row.kickoff);
  const relation = classifyTemporalRelation({ quoteMs, kickoffMs });
  return {
    fixture_id: String(row.fixture_id),
    kickoff: row.kickoff,
    odds_known_at: row.odds_known_at,
    bookmaker: row.bookmaker,
    source: row.source,
    delta_seconds: deltaSeconds(quoteMs, kickoffMs) ?? row.delta_seconds,
    temporal_class: temporalClassFromRelation({
      relation,
      kickoff,
      quote,
      dictionaryClosing: true,
    }),
  };
}

export function soccerParquetAcquired(checks: FileHashCheck024[]): boolean {
  return SOCCER_PARQUET_FILES.every((f) => checks.find((c) => c.file === f)?.present);
}
