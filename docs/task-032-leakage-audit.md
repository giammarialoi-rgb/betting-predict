# TASK 032 — Leakage audit

Every listed probe must HARD FAIL (throw). A miss fails the lab.

| id | throws | maps to |
|----|--------|---------|
| A_outcome | true | A_outcome |
| B_ft | true | B_ft |
| C_quote_after | true | C_quote_after |
| D_close | true | D_close |
| D_close_bin | true | D_close_bin |
| E_future_feature | true | E_future_feature |
| F_future_h2h | true | F_future_h2h |
| G_future_elo | true | G_future_elo |
| H_normalize_test | true | H_normalize_test |
| I_impute_test | true | I_impute_test |
| J_feature_test | true | J_feature_test |
| K_tune_test | true | K_tune_test |
| L_holdout | true | L_holdout |
| test_lock | true | test_lock |
| holdout_lock | true | holdout_lock |
| date_only | true | date_only |
| invented_ts | true | invented_ts |
| lock | true | lock |
| auto_promote | true | auto_promote |
| masaniello | true | masaniello |
| frozen_flags | true | frozen_flags |

A. outcome in DecisionContext
B. FT/HT
C. quote > asOf
D. closing odds / close bin
E–G. future form/Elo/H2H
H. normalization fit on TEST
I. imputation from TEST
J. feature selection on TEST
K. tuning on TEST
L. HOLDOUT used for training/selection

test_used_for_selection: false
HOLDOUT_TOUCHED: false
HOLDOUT_STATUS: EMPTY
