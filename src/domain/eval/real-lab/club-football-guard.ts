/**
 * Club Football Match Data — SECONDARY / BENCHMARK loader guards.
 * Never promote C_*, Form*, provisional Elo, or Max aggregates into STRICT.
 */

import { isAggregateOddsLabel } from "@/domain/markets/canonical";
import { classifyEloProvenance } from "@/domain/features/elo";

export const CLUB_FOOTBALL_SOURCE_ROLE = "SECONDARY" as const;

const FORBIDDEN_COLUMNS = [
  "C_LTH",
  "C_LTA",
  "C_VHD",
  "C_VAD",
  "C_HTB",
  "C_PHB",
  "Form3Home",
  "Form5Home",
  "Form3Away",
  "Form5Away",
];

export function assertClubFootballColumnAllowedForStrict(
  column: string,
): void {
  if (FORBIDDEN_COLUMNS.includes(column) || column.startsWith("C_")) {
    throw new Error(
      `CLUB_FOOTBALL_BLOCKED: column ${column} forbidden in STRICT_AS_OF path`,
    );
  }
  if (isAggregateOddsLabel(column)) {
    throw new Error(
      `CLUB_FOOTBALL_BLOCKED: aggregate ${column} is not a bookmaker`,
    );
  }
}

export function assertClubEloNotProvisional(isoDate: string): void {
  const provenance = classifyEloProvenance(isoDate);
  if (provenance === "provisional_blocked") {
    throw new Error(
      "CLUB_FOOTBALL_BLOCKED: provisional Elo cannot be treated as official",
    );
  }
}

export function clubFootballUsageMode(): {
  role: "SECONDARY";
  modes: Array<"BENCHMARK" | "VALIDATION">;
  primary: false;
} {
  return {
    role: "SECONDARY",
    modes: ["BENCHMARK", "VALIDATION"],
    primary: false,
  };
}
