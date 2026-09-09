<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:evidence-attribution-rules -->

# Evidence & Attribution (permanent)

Every assessment must be temporally valid, attributable and evidence-backed.

- **No naked probability.** Probability without an evidence graph or an explicit insufficiency declaration is invalid.
- **No unsupported causal claim.** News starts as `CONTEXT_ONLY`; it must not auto-become a prediction.
- **No source reliability invented.** `sourceReliability` remains `null` until measured; do not conflate it with claim confidence.
- **Evidence available after `asOf` must never enter the decision context.** Record it only as temporally blocked.
- Keep epistemic kinds separate: `FACT` | `QUANTITATIVE_EVIDENCE` | `INFERENCE` | `MODEL_JUDGMENT`.
- Required graph buckets: SUPPORTING, CONTRADICTING, CONTEXTUAL, INSUFFICIENT.
- Implementation: `src/domain/evidence/` and `.cursor/rules/evidence-attribution.mdc`.

Also permanent: multi-market information unit (`event → market → line → selection → bookmaker → asOf → price`), real acquisition over catalog expansion, blind replay, Evidence & Attribution (TASK 015), Blind Actuarial Bankroll Lab (TASK 016), Blind Actuarial Historical Replay (TASK 017), TASK 018 STRICT firewall on Club-Football (odds TEMPORALLY_UNKNOWN → NO BET; reconstruct Form; prefer ugly truth), TASK 019 date-precision ≠ exact, and TASK 020 blind capital test — without inventing data, bypassing blocks, or applying unapproved migrations.

<!-- END:evidence-attribution-rules -->

<!-- BEGIN:historical-decision-time-rules -->

# Historical Decision Time (permanent)

THE SYSTEM MUST NEVER CONVERT HISTORICAL OUTCOME KNOWLEDGE INTO PRE-EVENT KNOWLEDGE.

A historical dataset is not automatically a decision-time dataset.

Every feature, market quote, news item, statistic, lineup, injury, weather observation and market snapshot must have defensible temporal semantics before entering STRICT_AS_OF.

If temporal availability cannot be demonstrated, the information may remain available for research/benchmark purposes but MUST NOT affect the blind capital replay.

No positive result may justify weakening this rule.

Implementation: `.cursor/rules/historical-decision-time.mdc` and `src/domain/eval/capital-020/`.

<!-- END:historical-decision-time-rules -->
