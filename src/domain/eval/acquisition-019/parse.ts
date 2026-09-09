/**
 * Parse acquired CSVs into normalized events + market observations.
 * Never invents available_at clocks. Never promotes Max/Avg to bookmakers.
 */

import { createHash } from "node:crypto";
import { parseCsv } from "@/providers/football-data-co-uk/parser";
import { datasetDateAnchorUtc } from "@/domain/odds/temporal";
import { assertNotAggregateAsBookmaker } from "@/domain/markets/canonical";
import {
  classifyAnishColumn,
  FDCU_COLUMN_SPECS,
  isAggregateColumn,
} from "@/domain/eval/acquisition-019/columns";
import {
  buildNormalizedEvent,
  seasonFromIsoDate,
} from "@/domain/eval/acquisition-019/event-matching";
import {
  PARSER_VERSION,
  TEMPORAL_BASIS_CLOSE,
  TEMPORAL_BASIS_OPEN,
  type FailureBudget,
  type MarketObservation019,
  type NormalizedEvent,
  type OddsLevel,
  type Provenance,
  type TemporalPrecision019,
} from "@/domain/eval/acquisition-019/types";

export function emptyFailureBudget(): FailureBudget {
  return {
    HTTP_ERROR: 0,
    PARSE_ERROR: 0,
    SCHEMA_ERROR: 0,
    DUPLICATE: 0,
    ENTITY_UNMATCHED: 0,
    TEMPORAL_UNKNOWN: 0,
    TEMPORAL_CONFLICT: 0,
    POST_MATCH: 0,
    LICENSE_BLOCKED: 0,
    INSUFFICIENT_FIELDS: 0,
    AGGREGATE_SKIPPED: 0,
    CLOSE_NOT_PREMATCH: 0,
    acquired_files: 0,
    parsed_rows: 0,
    normalized_events: 0,
    matched_events: 0,
    observations_raw: 0,
    observations_book: 0,
    observations_strict: 0,
    observations_date: 0,
  };
}

export function parseOddsCell(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 1) return null;
  return n;
}

export function parseDate019(raw: string): Date | null {
  const t = raw.trim();
  if (!t) return null;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const dmy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  let year = Number(dmy[3]);
  if (dmy[3]!.length === 2) {
    year = year >= 93 ? 1900 + year : 2000 + year;
  }
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function resultFromFt(h: number | null, a: number | null): {
  ftHome: number | null;
  ftAway: number | null;
} {
  return { ftHome: h, ftAway: a };
}

function parseGoals(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function temporalForKind(kind: "dataset_open" | "dataset_close"): {
  precision: TemporalPrecision019;
  basis: string;
  level: OddsLevel;
  availableAt: string | null;
  dateAnchor: Date;
  matchDate: Date;
} {
  return {
    precision: kind === "dataset_open" ? "date" : "unknown",
    basis: kind === "dataset_open" ? TEMPORAL_BASIS_OPEN : TEMPORAL_BASIS_CLOSE,
    level: kind === "dataset_open" ? "B" : "D",
    availableAt: null,
    dateAnchor: new Date(0),
    matchDate: new Date(0),
  };
}

function attachTemporal(
  matchDate: Date,
  kind: "dataset_open" | "dataset_close",
): {
  observedAt: string;
  availableAt: string | null;
  temporalPrecision: TemporalPrecision019;
  temporalBasis: string;
  oddsLevel: OddsLevel;
} {
  const anchor = datasetDateAnchorUtc(matchDate);
  const t = temporalForKind(kind);
  // Date-anchor is recorded for open rows as observed calendar date, NOT claimed availability.
  return {
    observedAt: anchor.toISOString(),
    availableAt: null,
    temporalPrecision: t.precision,
    temporalBasis: t.basis,
    oddsLevel: t.level,
  };
}

export function extractFdcuObservations(input: {
  eventId: string;
  row: Record<string, string>;
  matchDate: Date;
  sourceId: string;
  budget: FailureBudget;
}): MarketObservation019[] {
  const out: MarketObservation019[] = [];
  const ahRaw = input.row.AHh ?? "";
  const numericAh = Number(ahRaw);
  const lineAh = ahRaw !== "" && Number.isFinite(numericAh) ? numericAh : null;

  for (const key of Object.keys(input.row)) {
    if (isAggregateColumn(key) && parseOddsCell(input.row[key]) != null) {
      input.budget.AGGREGATE_SKIPPED += 1;
    }
  }

  for (const spec of FDCU_COLUMN_SPECS) {
    if (!(spec.column in input.row)) continue;
    const odds = parseOddsCell(input.row[spec.column]);
    if (odds == null) continue;
    input.budget.observations_raw += 1;
    try {
      assertNotAggregateAsBookmaker(spec.bookmakerId);
    } catch {
      input.budget.AGGREGATE_SKIPPED += 1;
      continue;
    }
    let line = spec.line;
    if (spec.marketType === "AH") {
      if (lineAh == null) {
        input.budget.INSUFFICIENT_FIELDS += 1;
        continue;
      }
      line = spec.selectionSide === "HOME" ? lineAh : -lineAh;
    }
    const temporal = attachTemporal(input.matchDate, spec.kind);
    if (spec.kind === "dataset_close") {
      input.budget.CLOSE_NOT_PREMATCH += 1;
      input.budget.TEMPORAL_UNKNOWN += 1;
    } else {
      input.budget.observations_date += 1;
    }
    input.budget.observations_book += 1;
    out.push({
      eventId: input.eventId,
      bookmakerId: spec.bookmakerId,
      marketType: spec.marketType,
      line,
      selectionSide: spec.selectionSide,
      odds,
      observationKind: spec.kind,
      sourceId: input.sourceId,
      originalColumn: spec.column,
      ...temporal,
    });
  }
  return out;
}

export type ParsedBundle = {
  events: NormalizedEvent[];
  observations: MarketObservation019[];
  provenance: Provenance;
  discoveredColumns: string[];
};

export function parseFdcuCsv(input: {
  csvText: string;
  sourceId: string;
  sourceUrl: string;
  originalFile: string;
  datasetVersion: string;
  licenseStatus: Provenance["licenseStatus"];
  retrievedAt: string;
  defaultCompetition?: string;
  budget: FailureBudget;
}): ParsedBundle {
  const table = parseCsv(input.csvText);
  const events: NormalizedEvent[] = [];
  const observations: MarketObservation019[] = [];
  const seen = new Set<string>();
  const discovered = table.headers.filter(
    (h) =>
      FDCU_COLUMN_SPECS.some((s) => s.column === h) ||
      /^(B365|PS|WH|BW|IW|VC|LB|GB).+/.test(h),
  );

  if (table.headers.length === 0) {
    input.budget.SCHEMA_ERROR += 1;
    return emptyBundle(input);
  }

  input.budget.acquired_files += 1;

  for (const row of table.rows) {
    input.budget.parsed_rows += 1;
    const matchDate = parseDate019(row.Date ?? row.date ?? "");
    if (!matchDate) {
      input.budget.PARSE_ERROR += 1;
      continue;
    }
    const home = (row.HomeTeam ?? row.home_team ?? "").trim();
    const away = (row.AwayTeam ?? row.away_team ?? "").trim();
    if (!home || !away) {
      input.budget.INSUFFICIENT_FIELDS += 1;
      continue;
    }
    const iso = matchDate.toISOString().slice(0, 10);
    const season = seasonFromIsoDate(iso);
    const ft = resultFromFt(parseGoals(row.FTHG), parseGoals(row.FTAG));
    const ev = buildNormalizedEvent({
      sourceId: input.sourceId,
      sourceEventId: `${input.sourceId}|${row.Div ?? input.defaultCompetition ?? "?"}|${iso}|${home}|${away}`,
      competitionRaw: row.Div || input.defaultCompetition || "unknown",
      matchDate: iso,
      year: matchDate.getUTCFullYear(),
      season,
      homeRaw: home,
      awayRaw: away,
      ftHome: ft.ftHome,
      ftAway: ft.ftAway,
    });
    if (ev.matchingConfidence === "unmatched") {
      input.budget.ENTITY_UNMATCHED += 1;
      continue;
    }
    if (seen.has(ev.canonicalEventId)) {
      input.budget.DUPLICATE += 1;
    } else {
      seen.add(ev.canonicalEventId);
      events.push(ev);
      input.budget.normalized_events += 1;
    }
    observations.push(
      ...extractFdcuObservations({
        eventId: ev.canonicalEventId,
        row,
        matchDate,
        sourceId: input.sourceId,
        budget: input.budget,
      }),
    );
  }

  return {
    events,
    observations,
    discoveredColumns: discovered,
    provenance: {
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      retrievedAt: input.retrievedAt,
      datasetVersion: input.datasetVersion,
      sourceHash: hashText(input.csvText),
      originalFile: input.originalFile,
      parserVersion: PARSER_VERSION,
      licenseStatus: input.licenseStatus,
    },
  };
}

function emptyBundle(input: {
  sourceId: string;
  sourceUrl: string;
  originalFile: string;
  datasetVersion: string;
  licenseStatus: Provenance["licenseStatus"];
  retrievedAt: string;
}): ParsedBundle {
  return {
    events: [],
    observations: [],
    discoveredColumns: [],
    provenance: {
      sourceId: input.sourceId,
      sourceUrl: input.sourceUrl,
      retrievedAt: input.retrievedAt,
      datasetVersion: input.datasetVersion,
      sourceHash: "",
      originalFile: input.originalFile,
      parserVersion: PARSER_VERSION,
      licenseStatus: input.licenseStatus,
    },
  };
}

export function parseAnishEpl(input: {
  resultsCsv: string;
  oddsCsv: string;
  sourceUrl: string;
  originalFile: string;
  retrievedAt: string;
  budget: FailureBudget;
}): ParsedBundle {
  const results = parseCsv(input.resultsCsv);
  const odds = parseCsv(input.oddsCsv);
  if (!results.headers.includes("match_id") || !odds.headers.includes("match_id")) {
    input.budget.SCHEMA_ERROR += 1;
    return emptyBundle({
      sourceId: "anishkhetani-epl-archive",
      sourceUrl: input.sourceUrl,
      originalFile: input.originalFile,
      datasetVersion: "anishkhetani/premier-league-data",
      licenseStatus: "public_redistribution",
      retrievedAt: input.retrievedAt,
    });
  }
  input.budget.acquired_files += 2;

  const resultById = new Map<string, Record<string, string>>();
  for (const row of results.rows) {
    if (row.match_id) resultById.set(row.match_id, row);
  }

  const specs = new Map<string, ReturnType<typeof classifyAnishColumn>>();
  for (const h of odds.headers) {
    specs.set(h, classifyAnishColumn(h));
  }

  const events: NormalizedEvent[] = [];
  const observations: MarketObservation019[] = [];
  const seen = new Set<string>();
  const discovered: string[] = [];
  for (const [col, spec] of specs) {
    if (spec && spec !== "meta" && spec !== "aggregate") discovered.push(col);
    if (spec === "aggregate") {
      // counted per-cell below
    }
  }

  for (const row of odds.rows) {
    input.budget.parsed_rows += 1;
    const id = row.match_id ?? "";
    const res = resultById.get(id) ?? row;
    const matchDate = parseDate019(row.date ?? res.date ?? "");
    if (!matchDate) {
      input.budget.PARSE_ERROR += 1;
      continue;
    }
    const home = (row.home_team ?? res.home_team ?? "").trim();
    const away = (row.away_team ?? res.away_team ?? "").trim();
    if (!home || !away) {
      input.budget.INSUFFICIENT_FIELDS += 1;
      continue;
    }
    const iso = matchDate.toISOString().slice(0, 10);
    const season = (row.season_code ?? res.season_code ?? seasonFromIsoDate(iso)).replace("-", "");
    const ev = buildNormalizedEvent({
      sourceId: "anishkhetani-epl-archive",
      sourceEventId: id || `epl|${iso}|${home}|${away}`,
      competitionRaw: "E0",
      matchDate: iso,
      year: matchDate.getUTCFullYear(),
      season: season.length === 4 ? season : seasonFromIsoDate(iso),
      homeRaw: home,
      awayRaw: away,
      ftHome: parseGoals(res.fthg),
      ftAway: parseGoals(res.ftag),
    });
    if (ev.matchingConfidence === "unmatched") {
      input.budget.ENTITY_UNMATCHED += 1;
      continue;
    }
    if (seen.has(ev.canonicalEventId)) {
      input.budget.DUPLICATE += 1;
    } else {
      seen.add(ev.canonicalEventId);
      events.push(ev);
      input.budget.normalized_events += 1;
    }

    const ahOpen = Number(row.ah_line);
    const ahClose = Number(row.ah_line_close);
    const ahOpenOk = Number.isFinite(ahOpen);
    const ahCloseOk = Number.isFinite(ahClose);

    for (const [col, spec] of specs) {
      if (spec === "meta") continue;
      if (spec === "aggregate") {
        if (parseOddsCell(row[col]) != null) input.budget.AGGREGATE_SKIPPED += 1;
        continue;
      }
      if (!spec) continue;
      const oddsVal = parseOddsCell(row[col]);
      if (oddsVal == null) continue;
      input.budget.observations_raw += 1;
      try {
        assertNotAggregateAsBookmaker(spec.bookmakerId);
      } catch {
        input.budget.AGGREGATE_SKIPPED += 1;
        continue;
      }
      let line = spec.line;
      if (spec.marketType === "AH") {
        const useClose = spec.kind === "dataset_close";
        if (useClose ? !ahCloseOk : !ahOpenOk) {
          input.budget.INSUFFICIENT_FIELDS += 1;
          continue;
        }
        const rawLine = useClose ? ahClose : ahOpen;
        line = spec.selectionSide === "HOME" ? rawLine : -rawLine;
      }
      const temporal = attachTemporal(matchDate, spec.kind);
      if (spec.kind === "dataset_close") {
        input.budget.CLOSE_NOT_PREMATCH += 1;
        input.budget.TEMPORAL_UNKNOWN += 1;
      } else {
        input.budget.observations_date += 1;
      }
      input.budget.observations_book += 1;
      observations.push({
        eventId: ev.canonicalEventId,
        bookmakerId: spec.bookmakerId,
        marketType: spec.marketType,
        line,
        selectionSide: spec.selectionSide,
        odds: oddsVal,
        observationKind: spec.kind,
        sourceId: "anishkhetani-epl-archive",
        originalColumn: col,
        ...temporal,
      });
    }
  }

  return {
    events,
    observations,
    discoveredColumns: discovered,
    provenance: {
      sourceId: "anishkhetani-epl-archive",
      sourceUrl: input.sourceUrl,
      retrievedAt: input.retrievedAt,
      datasetVersion: "anishkhetani/premier-league-data processed",
      sourceHash: hashText(input.oddsCsv),
      originalFile: input.originalFile,
      parserVersion: PARSER_VERSION,
      licenseStatus: "public_redistribution",
    },
  };
}
