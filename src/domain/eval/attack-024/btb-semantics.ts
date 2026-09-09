/**
 * BeatTheBookie odds_series semantics from generate_odds_series_csv.php + Figure2B.m.
 *
 * PHP: $interval_mins=60, $time_window_hours=72, 72 bins, LOCF.
 * 0-indexed column 0 = 71h before kickoff; column 71 = kickoff marker.
 *
 * Figure2B.m (MATLAB 1-indexed):
 *   hoursBeforeOnset = 5
 *   hours = {(71-5+1):71 ...} → columns 67:71
 * MATLAB col 67 = PHP col 66 = 5h before
 * MATLAB col 71 = PHP col 70 = 1h before
 * MATLAB col 72 = PHP col 71 = kickoff — excluded from the 5→1h window
 *
 * Absolute timestamp: not in the TXT. Timezone of matches.date: UNDOCUMENTED.
 * SQL odds_history_series.odds_datetime would be CASE A if acquired and TZ proven.
 */

import { SERIES_BINS, seriesColumnRelativeSeconds } from "@/domain/eval/recovery-022/temporal";
import type { BtbSeriesCase024 } from "@/domain/eval/attack-024/types";

export type SeriesBin024 = {
  php0: number;
  matlab1: number;
  relative_seconds_before_kickoff: number;
  relative_hours: number;
  in_figure2b_5_to_1h: boolean;
  is_kickoff_marker: boolean;
};

export function seriesBins(): SeriesBin024[] {
  const out: SeriesBin024[] = [];
  for (let php0 = 0; php0 < SERIES_BINS; php0++) {
    const rel = seriesColumnRelativeSeconds(php0);
    const hours = rel / 3600;
    const matlab1 = php0 + 1;
    out.push({
      php0,
      matlab1,
      relative_seconds_before_kickoff: rel,
      relative_hours: hours,
      in_figure2b_5_to_1h: matlab1 >= 67 && matlab1 <= 71,
      is_kickoff_marker: php0 === SERIES_BINS - 1,
    });
  }
  return out;
}

export function figure2bPrematchBins(): SeriesBin024[] {
  return seriesBins().filter((b) => b.in_figure2b_5_to_1h);
}

/**
 * TXT hourly series: CASO B relative offset is documented, but TZ/origin of
 * matches.date is not → cannot emit UTC available_at. STRICT_AS_OF = no.
 *
 * SQL odds_datetime (not acquired): CASO A candidate only if timezone proven.
 */
export function btbSeriesCase(input: {
  bulkAcquired: boolean;
  hasAbsoluteDatetime: boolean;
  timezoneProven: boolean;
  generatorRelativeDocumented: boolean;
}): { case: BtbSeriesCase024; strict: false; note: string } {
  if (!input.bulkAcquired && !input.hasAbsoluteDatetime) {
    return {
      case: "D",
      strict: false,
      note: "odds_series / SQL dump NOT_ACQUIRED — semantics from generator only",
    };
  }
  if (input.hasAbsoluteDatetime && input.timezoneProven) {
    return {
      case: "A",
      strict: false,
      note: "absolute datetime + TZ would be CASE A; TZ not proven in this run",
    };
  }
  if (input.generatorRelativeDocumented && !input.timezoneProven) {
    return {
      case: "B",
      strict: false,
      note: "TEMPORALLY_VALID_RELATIVE on dataset clock (Figure2B 5→1h bins exclude kickoff); TZ undocumented so UTC STRICT is false (CASE C for absolute clock)",
    };
  }
  return { case: "D", strict: false, note: "ambiguous" };
}

export function assertNotPromoteHourlyBinToUtc(availableAt: string | null, timezoneProven: boolean): void {
  if (availableAt != null && !timezoneProven) {
    throw new Error("invented_clock: BeatTheBookie hourly bin is not a UTC timestamp");
  }
}
