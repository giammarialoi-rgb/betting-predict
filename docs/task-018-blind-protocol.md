# TASK 018 — Blind Protocol

```
EVENT → AS_OF → INFORMATION SET → FEATURES (reconstructed) → MODEL
→ EVIDENCE → ASSESSMENT → RISK → LOCK → REVEAL → SETTLEMENT
```

- DecisionContext must not contain FT/HT/outcome/future Elo/future odds.
- Repo Odd* = TEMPORALLY_UNKNOWN → STRICT reject (no kickoff=availability).
- Form* from repo forbidden; lagged reconstruction only.
- Expanding window train: events < T only.
- Parameters frozen in `experiments/exp_018_blind_actuarial_v1.json`.
- HISTORICAL ≠ SIMULATED Monte Carlo.