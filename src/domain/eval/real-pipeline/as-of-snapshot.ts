import { AsOfLeakageError, assertAsOf } from "@/lib/as-of";
import { coerceAvailableAtToIso } from "@/lib/available-at";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";
import type { PermanentEvent044, PermanentQuote044 } from "@/domain/eval/permanent-044/types";
import type { AsOfSnapshot, AsOfSnapshotField } from "@/domain/eval/real-pipeline/types";

function clockOrUnknown(raw: string | null | undefined): {
  iso: string | null;
  precision: "exact" | "unknown";
} {
  const iso = coerceAvailableAtToIso(raw);
  return { iso, precision: iso ? "exact" : "unknown" };
}

export class PreMatchLeakageError extends Error {
  readonly code = "PRE_MATCH_LEAKAGE";
  constructor(message: string) {
    super(message);
    this.name = "PreMatchLeakageError";
  }
}

function parseIso(value: string, label: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new TypeError(`${label} must be a valid ISO timestamp`);
  }
  return d;
}

function fieldLooksLikeFtScore(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k === "fthg" ||
    k === "ftag" ||
    k === "ftr" ||
    k === "ft_score" ||
    k === "full_time_home" ||
    k === "full_time_away" ||
    k.includes("full_time_score")
  );
}

function fieldLooksLikeClosingOdds(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes("closing") ||
    k.includes("odds_close") ||
    k.endsWith("b365c") ||
    k.endsWith("psc") ||
    k === "probability_market"
  );
}

export function buildAsOfSnapshot(input: {
  event: PermanentEvent044;
  asOf: string;
  observations?: readonly ResearchObservation[];
  quotes?: readonly PermanentQuote044[];
}): AsOfSnapshot {
  const fields: AsOfSnapshotField[] = [];
  const market_fields: AsOfSnapshotField[] = [];
  const blockedByTemporal: AsOfSnapshotField[] = [];
  const asOfMs = Date.parse(input.asOf);

  const identityClock = clockOrUnknown(input.event.available_at_utc ?? input.event.collected_at_utc);
  fields.push({
    key: "home",
    value: input.event.home_or_a,
    provenance: {
      source_id: input.event.source,
      observed_at: input.event.collected_at_utc,
      available_at: identityClock.iso,
      extraction_method: "event_identity",
      epistemic_kind: "FACT",
    },
    enters_model: false,
    temporal_precision: identityClock.precision,
  });
  fields.push({
    key: "away",
    value: input.event.away_or_b,
    provenance: {
      source_id: input.event.source,
      observed_at: input.event.collected_at_utc,
      available_at: identityClock.iso,
      extraction_method: "event_identity",
      epistemic_kind: "FACT",
    },
    enters_model: false,
    temporal_precision: identityClock.precision,
  });

  for (const obs of input.observations ?? []) {
    const { iso: available, precision } = clockOrUnknown(obs.available_at);
    const wantsModel = obs.enters_independent_model === true && obs.status === "REAL";
    const row: AsOfSnapshotField = {
      key: obs.feature_key,
      value: obs.value,
      provenance: {
        source_id: obs.source,
        observed_at: obs.observed_at,
        available_at: available,
        extraction_method: obs.extraction_method,
        epistemic_kind: obs.kind === "HISTORICAL_PRIOR" ? "QUANTITATIVE_EVIDENCE" : "FACT",
      },
      // Fail closed without aborting ANALYZE_EVENT: no clock → cannot enter the model.
      enters_model: wantsModel && available != null,
      temporal_precision: precision,
    };
    if (available && Number.isFinite(asOfMs) && Date.parse(available) > asOfMs) {
      blockedByTemporal.push({ ...row, enters_model: false });
      continue;
    }
    if (obs.kind === "MARKET" || fieldLooksLikeClosingOdds(obs.feature_key)) {
      market_fields.push({ ...row, enters_model: false });
      continue;
    }
    fields.push(row);
  }

  for (const q of input.quotes ?? []) {
    const { iso: available, precision } = clockOrUnknown(q.available_at_utc ?? q.collected_at_utc);
    const row: AsOfSnapshotField = {
      key: `quote.${q.market}.${q.selection}.${q.bookmaker}`,
      value: q.price,
      provenance: {
        source_id: q.source,
        observed_at: q.collected_at_utc,
        available_at: available,
        extraction_method: "market_quote",
        epistemic_kind: "FACT",
      },
      enters_model: false,
      temporal_precision: precision,
    };
    if (available && Number.isFinite(asOfMs) && Date.parse(available) > asOfMs) {
      blockedByTemporal.push(row);
      continue;
    }
    market_fields.push(row);
  }

  return {
    event_id: input.event.event_id,
    asOf: input.asOf,
    kickoff_utc: input.event.kickoff_utc ?? input.asOf,
    home: input.event.home_or_a,
    away: input.event.away_or_b,
    competition: input.event.competition,
    fields,
    market_fields,
    blockedByTemporal,
    ft_score: null,
  };
}

/**
 * Fail closed on leakage. Snapshot fields with available_at > asOf or >= kickoff
 * must not enter the decision graph. FT scores and closing odds cannot be model fields.
 */
export function assertPreMatchData(snapshot: AsOfSnapshot, kickoff: string | Date): void {
  const kick = kickoff instanceof Date ? kickoff : parseIso(kickoff, "kickoff");
  const asOf = parseIso(snapshot.asOf, "asOf");

  if (asOf.getTime() > kick.getTime()) {
    throw new PreMatchLeakageError(
      `asOf ${snapshot.asOf} is after kickoff ${kick.toISOString()}`,
    );
  }

  const check = (field: AsOfSnapshotField, bucket: string): void => {
    if (fieldLooksLikeFtScore(field.key) && field.enters_model) {
      throw new PreMatchLeakageError(`${bucket}.${field.key} FT score cannot enter pre-match model`);
    }
    if (fieldLooksLikeClosingOdds(field.key) && field.enters_model) {
      throw new PreMatchLeakageError(`${bucket}.${field.key} closing/market odds cannot enter independent model`);
    }
    const available = coerceAvailableAtToIso(field.provenance.available_at);
    if (!available) {
      if (field.enters_model) {
        throw new PreMatchLeakageError(
          `${bucket}.${field.key} enters_model but available_at is unknown`,
        );
      }
      return;
    }
    const avail = parseIso(available, `${bucket}.${field.key}.available_at`);
    try {
      assertAsOf(asOf, avail);
    } catch (e) {
      if (e instanceof AsOfLeakageError) {
        throw new PreMatchLeakageError(
          `${bucket}.${field.key} available_at ${available} after asOf ${snapshot.asOf}`,
        );
      }
      throw e;
    }
    if (avail.getTime() > kick.getTime()) {
      throw new PreMatchLeakageError(
        `${bucket}.${field.key} available_at ${available} after kickoff ${kick.toISOString()}`,
      );
    }
  };

  for (const f of snapshot.fields) check(f, "fields");
  for (const f of snapshot.market_fields) {
    if (f.enters_model) {
      throw new PreMatchLeakageError(`market_fields.${f.key} must not enter the independent model`);
    }
    check(f, "market_fields");
  }
  if (snapshot.blockedByTemporal.some((f) => f.enters_model)) {
    throw new PreMatchLeakageError("temporally blocked field marked enters_model");
  }
  if (snapshot.ft_score != null) {
    throw new PreMatchLeakageError("ft_score must be null on a pre-match snapshot");
  }
}
