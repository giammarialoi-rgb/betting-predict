# TASK 015 — Evidence & Attribution Layer V1 — Report

## Status

**DONE** — architectural gate only. No migration. No scraping. No news pipeline.

## Deliverables

| Item | Path |
|------|------|
| Types | `src/domain/evidence/types.ts` |
| Graph + temporal firewall | `src/domain/evidence/build-graph.ts` |
| Attribution | `src/domain/evidence/attribution.ts` |
| Asserts | `src/domain/evidence/assert-assessment.ts` |
| Assessment builder | `src/domain/evidence/build-assessment.ts` |
| WhyFactor adapter | `src/domain/evidence/from-why-factor.ts` |
| InformationEvent bridge | `src/domain/evidence/from-information.ts` |
| Blind fixture | `src/domain/evidence/blind-fixture.ts` |
| Tests | `src/domain/evidence/evidence-015.test.ts` |
| Cursor rule | `.cursor/rules/evidence-attribution.mdc` |
| Docs | `docs/evidence-attribution-layer.md` |

## Blind fixture summary

| Field | Value |
|-------|------:|
| Hypothesis | HOME |
| Probability | 0.57 (model) |
| Evidence strength | moderate |
| Supporting | ≥3 |
| Contradicting | ≥2 |
| Contextual | ≥1 (news CONTEXT_ONLY) |
| Blocked | ≥1 (post-asOf) |
| sourceReliability | always null |

## Gates verified

| Gate | Result |
|------|--------|
| assessment without evidence | HARD FAIL |
| future evidence | BLOCKED / HARD FAIL if leaked into graph |
| news alone → probability | HARD FAIL (NEWS_CAUSAL_JUMP) |
| source reliability | null |
| WhyFactor adapter | compatible with explainDecision |
| migration | NONE |

## Next (not this task)

Resume real multi-market acquisition (014-B track): team goals, BTTS, handicap, corners, cards, player props — using this evidence contract when assessments are produced.
