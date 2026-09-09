import type { CostRow023 } from "@/domain/eval/temporal-023/types";

/**
 * Documented Betfair Historic pricing (not purchased this run).
 * BASIC = £0 but still requires Betfair login to "purchase" the free basket.
 * Advanced/Pro soccer: official bulk-discount table.
 */
export const BASIC_GBP = 0;
export const ADVANCED_SOCCER_MONTH_GBP = 69;
export const ADVANCED_SOCCER_YEAR_GBP = 699;
export const PRO_SOCCER_MONTH_GBP = 230;
export const PRO_SOCCER_YEAR_GBP = 2299;

export const PRICING_URL =
  "https://support.developer.betfair.com/hc/en-us/articles/360019984158-Are-bulk-purchase-discounts-available";

export const BASIC_SPEC = {
  granularity_documented: "1 minute last traded price, no volume, no ladder",
  granularity_measured_median_sec: null as number | null,
  sufficient_for_clock_test: true,
  sufficient_for_depth: false,
};

export function costTable(measuredIntervalSec: number | null): CostRow023[] {
  BASIC_SPEC.granularity_measured_median_sec = measuredIntervalSec;
  return [
    {
      events: 100,
      basic_gbp: 0,
      advanced_soccer_gbp: ADVANCED_SOCCER_MONTH_GBP,
      pro_soccer_gbp: PRO_SOCCER_MONTH_GBP,
      cost_per_event_basic: 0,
      note: "BASIC £0 + Betfair login (not used). Advanced/Pro billed per soccer-month, not per event.",
    },
    {
      events: 500,
      basic_gbp: 0,
      advanced_soccer_gbp: ADVANCED_SOCCER_MONTH_GBP,
      pro_soccer_gbp: PRO_SOCCER_MONTH_GBP,
      cost_per_event_basic: 0,
      note: "Pilot 500 EPL MATCH_ODDS fits inside one BASIC month if login were available.",
    },
    {
      events: 1000,
      basic_gbp: 0,
      advanced_soccer_gbp: ADVANCED_SOCCER_MONTH_GBP,
      pro_soccer_gbp: PRO_SOCCER_MONTH_GBP,
      cost_per_event_basic: 0,
      note: "Still BASIC if only MATCH_ODDS timestamps are required.",
    },
    {
      events: 10_000,
      basic_gbp: 0,
      advanced_soccer_gbp: ADVANCED_SOCCER_MONTH_GBP,
      pro_soccer_gbp: PRO_SOCCER_MONTH_GBP,
      cost_per_event_basic: 0,
      note: "All-soccer MATCH_ODDS in a busy month may exceed 10k; still £0 BASIC or £69 Advanced month.",
    },
    {
      events: 100_000,
      basic_gbp: 0,
      advanced_soccer_gbp: ADVANCED_SOCCER_YEAR_GBP,
      pro_soccer_gbp: PRO_SOCCER_YEAR_GBP,
      cost_per_event_basic: 0,
      note: "100k events likely needs many months of all-soccer BASIC (still £0) or paid plans. Not purchased.",
    },
  ];
}

export const EXPECTED_INFORMATION_GAIN = {
  vs_date_only: "EXACT publishTime (pt) + marketStartTime — the missing STRICT clock",
  basic_vs_advanced: "Advanced adds 1s ladder + volume; not required to prove TIMESTAMP→AS_OF→LOCK",
  basic_sufficient_for_pilot: true,
  login_still_required: true,
  purchased_this_run: false,
};
