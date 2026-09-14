/**
 * API-Sports prematch adapter — injuries / lineups → PrematchFeatureObservation.
 * Cache-first; never invent available_at. Without demonstrable published clock → NOT_ELIGIBLE for MODEL.
 */

import { mkdirSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { apiSportsGet057 } from "@/domain/data-sources/api-sports/client";
import { piRoot } from "@/domain/eval/predictive-intelligence/config";
import type { PrematchFeatureObservation } from "@/domain/eval/data-intelligence/types";

export type ApiSportsPrematchInput = {
  eventId: string;
  eventTime: string;
  homeTeam: string;
  awayTeam: string;
  /** API-Sports fixture id when known. */
  fixtureId?: number | null;
  homeTeamApiId?: number | null;
  awayTeamApiId?: number | null;
  decisionTime: string;
  labBRoot?: string;
  /** Inject parsed bodies for tests (no network). */
  deps?: {
    injuriesBody?: unknown;
    lineupsBody?: unknown;
    /** Demonstrable publish clock — required for MODEL eligibility. */
    sourcePublishedAt?: string | null;
    retrievedAt?: string;
    allowNetwork?: boolean;
  };
};

function cacheDir(labBRoot?: string): string {
  const dir = join(piRoot(labBRoot), "data-intelligence", "api-sports-cache");
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cachePath(labBRoot: string | undefined, key: string): string {
  const h = createHash("sha256").update(key).digest("hex").slice(0, 20);
  return join(cacheDir(labBRoot), `${h}.json`);
}

function readDiskCache(path: string, maxAgeMs: number): unknown | null {
  if (!existsSync(path)) return null;
  try {
    const j = JSON.parse(readFileSync(path, "utf8")) as { cached_at: string; body: unknown };
    if (Date.now() - Date.parse(j.cached_at) > maxAgeMs) return null;
    return j.body;
  } catch {
    return null;
  }
}

function writeDiskCache(path: string, body: unknown): void {
  writeFileSync(
    path,
    JSON.stringify({ cached_at: new Date().toISOString(), body }, null, 2),
    "utf8",
  );
}

function teamKey(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "");
}

function extractPublishedAt(body: unknown, fallback: string | null | undefined): string | null {
  if (fallback) return fallback;
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, unknown>;
  // Never treat retrieved/cache time as published. Only explicit update fields.
  const parameters = root.parameters;
  if (parameters && typeof parameters === "object") {
    const u = (parameters as Record<string, unknown>).update;
    if (typeof u === "string" && Number.isFinite(Date.parse(u))) return new Date(u).toISOString();
  }
  return null;
}

export type InjuryRow = {
  teamName: string;
  playerName: string;
  reason: string | null;
  type: string | null;
  update: string | null;
};

export function parseInjuries(body: unknown): InjuryRow[] {
  const response = (body as { response?: unknown })?.response;
  if (!Array.isArray(response)) return [];
  const out: InjuryRow[] = [];
  for (const row of response) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const team = r.team as { name?: string } | undefined;
    const player = r.player as { name?: string; type?: string; reason?: string; update?: string } | undefined;
    const fixture = r.fixture as { date?: string } | undefined;
    const name = team?.name;
    if (!name || !player?.name) continue;
    let update: string | null = null;
    if (typeof player.update === "string") {
      update = player.update;
    } else if (typeof fixture?.date === "string") {
      // fixture.date is event time — NOT injury publish clock; ignore for available_at
      update = null;
    }
    out.push({
      teamName: name,
      playerName: player.name,
      reason: typeof player.reason === "string" ? player.reason : null,
      type: typeof player.type === "string" ? player.type : null,
      update,
    });
  }
  return out;
}

type LineupSide = { teamName: string; confirmed: boolean; update: string | null };

export function parseLineups(body: unknown): LineupSide[] {
  const response = (body as { response?: unknown })?.response;
  if (!Array.isArray(response)) return [];
  const out: LineupSide[] = [];
  for (const row of response) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const team = r.team as { name?: string } | undefined;
    const startXI = r.startXI;
    const confirmed = Array.isArray(startXI) && startXI.length >= 11;
    out.push({
      teamName: team?.name ?? "",
      confirmed,
      update: null, // API rarely exposes lineup publish time
    });
  }
  return out;
}

function mkObs(input: {
  eventId: string;
  eventTime: string;
  sourcePublishedAt: string | null;
  retrievedAt: string;
  feature_name: string;
  feature_value: number | string | null;
  enters_independent_model: boolean;
  quality: PrematchFeatureObservation["quality"];
}): PrematchFeatureObservation {
  const hasClock = Boolean(input.sourcePublishedAt);
  return {
    event_id: input.eventId,
    event_time: input.eventTime,
    source_id: "api-sports",
    feature_name: input.feature_name,
    feature_value: input.feature_value,
    source_published_at: input.sourcePublishedAt,
    retrieved_at: input.retrievedAt,
    available_at: hasClock ? input.sourcePublishedAt : null,
    feature_time: hasClock ? input.sourcePublishedAt : null,
    quality: hasClock ? input.quality : input.feature_value == null ? "missing" : "not_eligible",
    timestamp_precision: hasClock ? "datetime" : "unknown",
    enters_independent_model: input.enters_independent_model && hasClock,
    legal_status: "licensed",
  };
}

/**
 * Build injuries/lineups observations. Prefer injected bodies; optional network if allowNetwork.
 */
export async function fetchApiSportsPrematchObservations(
  input: ApiSportsPrematchInput,
): Promise<PrematchFeatureObservation[]> {
  const retrievedAt = input.deps?.retrievedAt ?? new Date().toISOString();
  const publishedFallback = input.deps?.sourcePublishedAt ?? null;
  let injuriesBody: unknown = input.deps?.injuriesBody ?? null;
  let lineupsBody: unknown = input.deps?.lineupsBody ?? null;

  if (input.deps?.allowNetwork && input.fixtureId) {
    const injPath = `/injuries?fixture=${input.fixtureId}`;
    const linePath = `/fixtures/lineups?fixture=${input.fixtureId}`;
    const injCache = cachePath(input.labBRoot, injPath);
    const lineCache = cachePath(input.labBRoot, linePath);

    if (!injuriesBody) {
      injuriesBody = readDiskCache(injCache, 6 * 3600_000);
      if (!injuriesBody) {
        const res = await apiSportsGet057(injPath, { useCacheMs: 6 * 3600_000 });
        if (res.ok) {
          injuriesBody = res.body;
          writeDiskCache(injCache, res.body);
        }
      }
    }
    if (!lineupsBody) {
      lineupsBody = readDiskCache(lineCache, 6 * 3600_000);
      if (!lineupsBody) {
        const res = await apiSportsGet057(linePath, { useCacheMs: 6 * 3600_000 });
        if (res.ok) {
          lineupsBody = res.body;
          writeDiskCache(lineCache, res.body);
        }
      }
    }
  }

  const published =
    extractPublishedAt(injuriesBody, publishedFallback) ??
    extractPublishedAt(lineupsBody, publishedFallback);

  const homeK = teamKey(input.homeTeam);
  const awayK = teamKey(input.awayTeam);
  const obs: PrematchFeatureObservation[] = [];

  if (injuriesBody) {
    const rows = parseInjuries(injuriesBody);
    const rowClock = rows.map((r) => r.update).find((u) => u && Number.isFinite(Date.parse(u)));
    const clock = published ?? (rowClock ? new Date(rowClock).toISOString() : null);
    let homeN = 0;
    let awayN = 0;
    const homeNames: string[] = [];
    const awayNames: string[] = [];
    for (const r of rows) {
      const tk = teamKey(r.teamName);
      if (tk.includes(homeK) || homeK.includes(tk)) {
        homeN += 1;
        homeNames.push(r.playerName);
      } else if (tk.includes(awayK) || awayK.includes(tk)) {
        awayN += 1;
        awayNames.push(r.playerName);
      }
    }
    obs.push(
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: clock,
        retrievedAt,
        feature_name: "home_injuries_n",
        feature_value: homeN,
        enters_independent_model: true,
        quality: "confirmed",
      }),
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: clock,
        retrievedAt,
        feature_name: "away_injuries_n",
        feature_value: awayN,
        enters_independent_model: true,
        quality: "confirmed",
      }),
      // List for reasoning CONTEXT — never numeric MODEL bag
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: clock,
        retrievedAt,
        feature_name: "injuries_home_list",
        feature_value: homeNames.join(","),
        enters_independent_model: false,
        quality: "ok",
      }),
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: clock,
        retrievedAt,
        feature_name: "injuries_away_list",
        feature_value: awayNames.join(","),
        enters_independent_model: false,
        quality: "ok",
      }),
    );
  } else {
    obs.push(
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: null,
        retrievedAt,
        feature_name: "home_injuries_n",
        feature_value: null,
        enters_independent_model: true,
        quality: "missing",
      }),
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: null,
        retrievedAt,
        feature_name: "away_injuries_n",
        feature_value: null,
        enters_independent_model: true,
        quality: "missing",
      }),
    );
  }

  if (lineupsBody) {
    const sides = parseLineups(lineupsBody);
    const clock = published; // lineup publish clock usually absent → NOT_ELIGIBLE
    for (const side of sides) {
      const tk = teamKey(side.teamName);
      const isHome = tk.includes(homeK) || homeK.includes(tk);
      const isAway = tk.includes(awayK) || awayK.includes(tk);
      if (!isHome && !isAway) continue;
      obs.push(
        mkObs({
          eventId: input.eventId,
          eventTime: input.eventTime,
          sourcePublishedAt: clock ?? side.update,
          retrievedAt,
          feature_name: isHome ? "home_lineup_confirmed" : "away_lineup_confirmed",
          feature_value: side.confirmed ? 1 : 0,
          enters_independent_model: true,
          quality: "confirmed",
        }),
      );
    }
  } else {
    obs.push(
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: null,
        retrievedAt,
        feature_name: "home_lineup_confirmed",
        feature_value: null,
        enters_independent_model: true,
        quality: "missing",
      }),
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: null,
        retrievedAt,
        feature_name: "away_lineup_confirmed",
        feature_value: null,
        enters_independent_model: true,
        quality: "missing",
      }),
    );
  }

  return obs;
}

/**
 * Sync cache-only load (no network). Returns [] if cache miss.
 * Used by sync analyze-045 path.
 */
export function loadApiSportsPrematchFromCacheSync(input: {
  eventId: string;
  eventTime: string;
  homeTeam: string;
  awayTeam: string;
  fixtureId?: number | null;
  decisionTime: string;
  labBRoot?: string;
  sourcePublishedAt?: string | null;
}): PrematchFeatureObservation[] {
  if (!input.fixtureId) return [];
  const injPath = `/injuries?fixture=${input.fixtureId}`;
  const linePath = `/fixtures/lineups?fixture=${input.fixtureId}`;
  const injuriesBody = readDiskCache(cachePath(input.labBRoot, injPath), 7 * 86400_000);
  const lineupsBody = readDiskCache(cachePath(input.labBRoot, linePath), 7 * 86400_000);
  if (!injuriesBody && !lineupsBody) return [];

  // Re-use async parser path synchronously via deps injection pattern
  let out: PrematchFeatureObservation[] = [];
  // Inline minimal sync call by constructing through the same mkObs path:
  // We call the async function with deps only (no await network) — but it's async.
  // Duplicate thin sync parse:
  const retrievedAt = new Date().toISOString();
  const published = input.sourcePublishedAt ?? extractPublishedAt(injuriesBody, null) ?? extractPublishedAt(lineupsBody, null);
  const homeK = teamKey(input.homeTeam);
  const awayK = teamKey(input.awayTeam);

  if (injuriesBody) {
    const rows = parseInjuries(injuriesBody);
    const rowClock = rows.map((r) => r.update).find((u) => u && Number.isFinite(Date.parse(u)));
    const clock = published ?? (rowClock ? new Date(rowClock).toISOString() : null);
    let homeN = 0;
    let awayN = 0;
    for (const r of rows) {
      const tk = teamKey(r.teamName);
      if (tk.includes(homeK) || homeK.includes(tk)) homeN += 1;
      else if (tk.includes(awayK) || awayK.includes(tk)) awayN += 1;
    }
    out = out.concat([
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: clock,
        retrievedAt,
        feature_name: "home_injuries_n",
        feature_value: homeN,
        enters_independent_model: true,
        quality: "confirmed",
      }),
      mkObs({
        eventId: input.eventId,
        eventTime: input.eventTime,
        sourcePublishedAt: clock,
        retrievedAt,
        feature_name: "away_injuries_n",
        feature_value: awayN,
        enters_independent_model: true,
        quality: "confirmed",
      }),
    ]);
  }

  if (lineupsBody) {
    for (const side of parseLineups(lineupsBody)) {
      const tk = teamKey(side.teamName);
      const isHome = tk.includes(homeK) || homeK.includes(tk);
      const isAway = tk.includes(awayK) || awayK.includes(tk);
      if (!isHome && !isAway) continue;
      out.push(
        mkObs({
          eventId: input.eventId,
          eventTime: input.eventTime,
          sourcePublishedAt: published,
          retrievedAt,
          feature_name: isHome ? "home_lineup_confirmed" : "away_lineup_confirmed",
          feature_value: side.confirmed ? 1 : 0,
          enters_independent_model: true,
          quality: "confirmed",
        }),
      );
    }
  }

  return out;
}
