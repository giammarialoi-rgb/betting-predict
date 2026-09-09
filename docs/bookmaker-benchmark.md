# Bookmaker benchmark foundation

Purpose: compare **model probability** vs **market implied probability** per market/line/selection — scientifically, without betting.

## Objects

- `MarketBaselineComparison` (`src/domain/eval/benchmark.ts`)
- Multi-market buckets (separate sample sizes — do not pool blindly)
- Hypothesis frame: H0 no incremental info / H1 incremental / unevaluated

## Explicitly out of scope

- stakes, Kelly, ROI optimization, bet tables, auto betting

## Closing line

Closing implied probability is only attached when the comparison time allows observing close. Prematch decisions must not use closing.

## Multiple testing

See `src/domain/eval/multiple-testing.ts` — Bonferroni threshold + OOS confirmation guard before any “beat the bookmaker” claim.
