/**
 * A/B/C/D classifier. Never invent quote clocks. Kaggle weekly TZ is unverified → not auto-STRICT.
 */

import type { ClassifiedObservation025, DataClass025, WeeklyBetfairRow025 } from "@/domain/eval/turnaround-025/types";

export function parseLooseDatetime(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim() === "") return null;
  const t = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const dmy = t.match(/^(\d{2})-(\d{2})-(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    if (dmy[4] == null) return null;
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    const hour = Number(dmy[4]);
    const minute = Number(dmy[5]);
    const second = Number(dmy[6] ?? "0");
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return Date.UTC(year, month - 1, day, hour, minute, second);
  }
  const iso = t.includes("T") ? t : t.replace(" ", "T");
  const withZ = /Z$|[+-]\d{2}:\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withZ);
  return Number.isFinite(ms) ? ms : null;
}

export function classifyWeeklyBetfairRow(row: WeeklyBetfairRow025): ClassifiedObservation025 {
  const id = `${row.event_id}|${row.selection_id}|${row.odds}`;
  if (row.sports_id !== "1") {
    return { id, dataClass: "D_INVALID", capitalEligible: false, reason: "not soccer" };
  }
  if (!(row.odds > 1)) {
    return { id, dataClass: "D_INVALID", capitalEligible: false, reason: "invalid odds" };
  }
  const kickoffMs = parseLooseDatetime(row.scheduled_off);
  const latestMs = parseLooseDatetime(row.latest_taken);
  const firstMs = parseLooseDatetime(row.first_taken);
  const quoteMs = latestMs ?? firstMs;
  if (kickoffMs == null || quoteMs == null) {
    return {
      id,
      dataClass: "C_RESEARCH_ONLY",
      capitalEligible: false,
      reason: "missing parseable scheduled_off or first/latest_taken",
    };
  }
  const tzProven =
    /Z$|[+-]\d{2}:\d{2}$/.test(row.scheduled_off.trim()) ||
    /Z$|[+-]\d{2}:\d{2}$/.test((row.latest_taken ?? row.first_taken ?? "").trim());
  if (row.in_play === "IP") {
    return {
      id,
      dataClass: "D_INVALID",
      capitalEligible: false,
      reason: "IN_PLAY=IP — not prematch",
    };
  }
  if (quoteMs >= kickoffMs) {
    return {
      id,
      dataClass: "D_INVALID",
      capitalEligible: false,
      reason: "quote timestamp not < scheduled_off",
    };
  }
  if (!tzProven) {
    return {
      id,
      dataClass: "B_RESEARCH_TEMPORAL",
      capitalEligible: false,
      reason: "LATEST_TAKEN < SCHEDULED_OFF on dataset clock but timezone not proven — not STRICT",
    };
  }
  return {
    id,
    dataClass: "A_STRICT",
    capitalEligible: true,
    reason: "ISO/offset clocks and quote < kickoff",
  };
}

export function classifyNamedOpeningDataset(label: string): DataClass025 {
  if (/opening|open/i.test(label)) return "C_RESEARCH_ONLY";
  return "C_RESEARCH_ONLY";
}

export function classifyDateOnlyOdds(): ClassifiedObservation025 {
  return {
    id: "date-only",
    dataClass: "C_RESEARCH_ONLY",
    capitalEligible: false,
    reason: "DATE_ONLY cannot become a quote timestamp",
  };
}
