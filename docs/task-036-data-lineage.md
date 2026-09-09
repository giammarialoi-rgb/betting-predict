# TASK 036 — Data lineage

- Dataset: PROSPECTIVE_STRICT_V1
- collection_start: 2026-09-07T00:00:00.000Z
- Live store: audit/external/task-036/*.jsonl (append-only, gitignored)
- Experiment: experiments/exp_036_prospective_collection.json (frozen)
- TASK_031_BASE not rewritten
- fingerprint: `d447846e58290f0c01d4391d9b4af241360c2e27ee393e83554836465b57cc90`
- experiment sha: `520960032f0de996b9ac850ea807d4b91ebe72ecad87ec07058e0c8df97d6ef6`
- dataset sha: `5ebe75d644ab1a0d7f5ad09812ed61b295e657a3916999db432c16f6d3d66f5a`

Idempotency key: `source + source_record_id + source_timestamp + market + selection + price`.
Duplicates: `IGNORED_DUPLICATE` — never counted twice.

Snapshots are append-only. `quotes_hash` and `decision_context_hash` make two replays of the same snapshot identical.

Settlement is a later record. FT/HT never enter DecisionContext.

No DATE_ONLY promotion. No opening/closing labels as clocks. No mtime/created_at as quote time.
