# Blind Actuarial Bankroll Protocol

## Absolute rule

```text
asOf → DecisionContext → Evidence → Assessment → Risk → stake → LOCK
→ only then → Outcome reveal → settlement
```

`OutcomeContext` is inaccessible before LOCK. Any leak → `BlindLeakageError` → experiment invalid.

## Solar years

Each calendar year starts at `bankroll = 1000` independently. No cumulative 2001→today capital for the primary comparison.

## Frozen policy

`experiments/exp_016_actuarial_bankroll_v1.json` is immutable. Parameter changes require `exp_016_…_v2` and a fresh run.

## Forbidden before LOCK

- final / HT scores
- post-match stats
- future odds / Elo / form / news / lineup
- closing info not available at asOf
- any field that encodes the outcome

## Settlement

```text
bankrollAfter = bankrollBefore + pnl
finalBankroll = initialBankroll + Σ pnl
```

Mismatch → `BankrollAccountingError`.

## Evidence (TASK 015)

No naked probability. News stays `CONTEXT_ONLY` unless correlated via verified FACT.

## Monte Carlo

Diagnostic only (`kind: SIMULATED`). Never retunes historical stakes.
