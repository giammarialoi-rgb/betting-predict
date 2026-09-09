# TASK 051 — Data integrity

## Mechanisms

- Append-only JSONL ledgers under Lab B
- Event / quote / prediction / lock / settlement / autopsy / learning dedupe sets in `store.ts`
- Atomic JSON writes for brain state (`integrity.ts`)
- Idempotent paper-bet open keyed by `prediction_id`
- LOCK immutability + post-lock mutation firewall (inherited 036/044)
- Experiment flags frozen in `experiments/exp_051_autonomous_24_7_brain.json`

## No synthetic data

Discovery and quotes come from the live provider only. Lab/audit default: no discover (`allowDiscover: false`).

## Capitals

Paper ledger is clearly separated (`capital: PAPER_ONLY`, `real_money: false`).
