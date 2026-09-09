# TASK 035 — Data lineage

- TASK_031_BASE SHA-256: `6d78ca34da9df180b643976c3b4a52b93cf589984bae54e056c5e3a53b44174b` (not rewritten)
- Parser: task-035-parser-v1
- New files under `audit/external/task-035/` (gitignored downloads) + fixtures for CI
- HuggingFace JulienDelavande soccer_odds / soccer_stats.sql
- HuggingFace oliviersportsdata closing sample
- HuggingFace 5Dollar in-play first-goal study
- SharpAPI CC BY 4.0 World Cup 2026 snapshot (GitHub + sharpapi.io)
- Kaggle AH sample already on disk from TASK 026
- Fingerprint: `34a510ee8ff602525d480cd10ca39e1a0418f86b71e8b4442c1d4c8bd7c45448`

No DATE_ONLY row was promoted. No OPEN/CLOSE label was turned into a timestamp. No timezone was invented.
