# TASK 034 — Data lineage

- TASK_031_BASE SHA-256: `6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b`
- Experiment SHA-256: `0a1ba9a4433162a4caf60791055308786dcd123519c61467e067f0658f836359`
- File: `audit/external/task-027/strict-candidates.csv` (not rewritten)
- T-1h 1X2 LEVEL_B: PHP hours_before=1 + soccer-dataset UTC kickoff
- T-24h overlay: `audit/external/task-030/movement-t24.csv` (same LEVEL_B clock, no interpolation)
- Cross-book: `audit/external/task-029/books-t1h.csv`
- CLOSE / DATE_ONLY / Club Form* / news: not in DecisionContext
- Result fingerprint: `0f04323ba8374bf2e0e30ad6a55aff67743b6746a2c172a00d85a7fa52335543`

## Secondary corpora (not promoted)

| Dataset | Class | Use |
|---|---|---|
| TASK_031_BASE 1X2 T-1h | STRICT | capital-eligible clock; this audit |
| books-t1h overlay | STRICT overlay | cross-book at T-1h |
| movement-t24 overlay | STRICT overlay | second pre-match timestamp |
| BeatTheBookie closing_odds | DATE_ONLY | hypothesis generation only |
| Club-Football | DATE_ONLY / TEMPORALLY_UNKNOWN | not STRICT |
| Betfair weekly CSV | RESEARCH / UNKNOWN timezone | not STRICT |
| HuggingFace oliviersportsdata sample | DATE_ONLY / closing | not STRICT |

No DATE_ONLY row was promoted. No synthetic quote or timestamp was added.
