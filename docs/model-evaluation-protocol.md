# Model Evaluation Protocol

## Metrics

Primary metrics (not win rate alone):

- **Brier score** (multi-class mean squared error for 1X2)
- **Log loss**
- **Calibration error** (mean \|predicted − actual\| across reliability bins)
- **Reliability buckets** (`predicted probability`, `actual frequency`, `sample count`)

## Baselines compared

| Model | Role |
| --- | --- |
| Market implied | Strong null hypothesis |
| Historical frequency | Naive empirical prior |
| Elo | Rating-only prior |
| Simple feature blend | Transparent non-tuned blend |

## Partitions

Every comparison is reported separately for:

```text
TRAIN | VALIDATION | TEST | HOLDOUT
```

Never only as a single aggregate.

## Market efficiency (diagnostic)

For MODEL_READY markets (currently **0** until temporal validation completes), compare:

```text
probability_gap = model_probability − market_probability
```

plus Brier / log-loss / calibration differences.

`probability_gap` is **not** a bet signal, profit, or “value bet”.

## Multiple testing

Hypothesis shopping is recorded via:

- number of hypotheses tested
- number of significant results
- correction method (`benjamini_hochberg` or `bonferroni`)

No claim of edge without out-of-sample confirmation (`assertClaimRequiresOos`).

## Allowed language

Allowed:

> Model X obtained better/worse Brier than the market baseline on TEST (period, n, method, uncertainty, MT correction, holdout separate).

Forbidden:

> We beat the bookmaker / guaranteed edge / value bet / ROI from this lab.
