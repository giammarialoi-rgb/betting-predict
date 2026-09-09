/** Paper target simulator — never promises outcomes; capital closed. */

export type TargetScenario044 = {
  name: "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE" | "EXTREME";
  required_odds_approx: number;
  selections: number;
  combined_probability_naive: number;
  risk: string;
  failure_probability_naive: number;
  note: string;
};

export function simulateTarget044(input: {
  capital: number;
  target_profit: number;
  time_window_days: number;
  risk_tolerance: "low" | "medium" | "high";
}): {
  reachable_claim: "VERY_UNLIKELY" | "UNLIKELY" | "UNCERTAIN" | "PLAUSIBLE_ONLY_WITH_EDGE";
  scenarios: TargetScenario044[];
  disclaimer: string;
} {
  const multiple = input.target_profit / Math.max(input.capital, 1e-9);
  const scenarios: TargetScenario044[] = [
    {
      name: "CONSERVATIVE",
      required_odds_approx: 1.4,
      selections: Math.ceil(Math.log(multiple) / Math.log(1.4)),
      combined_probability_naive: 0,
      risk: "low",
      failure_probability_naive: 1,
      note: "Without demonstrated edge, compounding at short odds still fails most paths.",
    },
    {
      name: "BALANCED",
      required_odds_approx: 2.0,
      selections: Math.ceil(Math.log(multiple) / Math.log(2)),
      combined_probability_naive: 0,
      risk: "medium",
      failure_probability_naive: 1,
      note: "Naive product of fair-ish probs collapses quickly.",
    },
    {
      name: "AGGRESSIVE",
      required_odds_approx: 3.5,
      selections: Math.ceil(Math.log(multiple) / Math.log(3.5)),
      combined_probability_naive: 0,
      risk: "high",
      failure_probability_naive: 1,
      note: "High variance; not a plan.",
    },
    {
      name: "EXTREME",
      required_odds_approx: 10,
      selections: Math.ceil(Math.log(multiple) / Math.log(10)),
      combined_probability_naive: 0,
      risk: "extreme",
      failure_probability_naive: 1,
      note: "Lottery-like path — declare probability of success as negligible without edge.",
    },
  ];
  for (const s of scenarios) {
    const p = 1 / s.required_odds_approx;
    s.combined_probability_naive = Math.pow(p, Math.max(s.selections, 1));
    s.failure_probability_naive = 1 - s.combined_probability_naive;
  }
  return {
    reachable_claim: multiple >= 50 ? "VERY_UNLIKELY" : multiple >= 10 ? "UNLIKELY" : "UNCERTAIN",
    scenarios,
    disclaimer:
      "TARGET_SIMULATOR is educational only. REAL_MONEY=false. No promise of profit. MODEL_EDGE=UNKNOWN until holdout protocol.",
  };
}
