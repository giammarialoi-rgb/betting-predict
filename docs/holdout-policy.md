# Holdout Policy

## Sacred partition

The lab chronological split is:

| Partition | Period (lab v1) | Allowed uses |
| --- | --- | --- |
| TRAIN | 2019–2021 | Fit baselines / frequency estimates |
| VALIDATION | 2022 | Informal checks only |
| TEST | 2023 | Model comparison (pre-holdout) |
| HOLDOUT | 2024 | **Final evaluation only** |

## Forbidden uses of HOLDOUT

Do **not** use HOLDOUT for:

- feature selection
- model selection
- threshold tuning
- hyperparameter tuning
- strategy optimization

`assertHoldoutSacred` throws if these purposes target `HOLDOUT`.

## Walk-forward

Use `buildWalkForwardFolds` (rolling origin). Random train/test temporal splits are forbidden (`assertNotRandomTemporalSplit`).

## Philosophy

A negative but honest holdout result is a valid scientific outcome. A positive result obtained by peeking at holdout is a **FAIL**.
