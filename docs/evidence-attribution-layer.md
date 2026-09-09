# Evidence & Attribution Layer V1

Architectural gate (TASK 015): every future assessment must explain what supports it, what contradicts it, which sources document it, and what was knowable at decision time.

## Principle

```text
No naked probability.
No unsupported causal claim.
No invented source reliability.
Evidence after asOf never enters the decision.
```

## Types

See `src/domain/evidence/types.ts`:

- `EvidenceItem` — claim + source + temporal fields + epistemic kind + polarity
- `EvidenceGraph` — supporting / contradicting / contextual / insufficient
- `AssessmentReport` — hypothesis, probability, strength, graph, attributions, blockedByTemporal

## News policy

A journalistic claim (e.g. “8 players ill”) becomes:

```text
category: news
polarity: CONTEXT_ONLY
```

It does **not** set probability. A separate verified signal (lineup/injury FACT) may SUPPORT/CONTRADICT. Probability comes from model/quantification.

## Temporal firewall

```text
available_at <= asOf  → eligible for graph
available_at > asOf   → blockedByTemporal only
```

## Compatibility

`WhyFactor` continues to work via `evidenceItemFromWhyFactor` / `evidenceItemsFromWhyFactors`. Existing WHY V2 tests remain unchanged.

## Blind fixture example

`runBlindEvidenceFixture()` produces roughly:

| Bucket | Content |
|--------|---------|
| SUPPORTING | form, market move, squad depth FACT, model judgment |
| CONTRADICTING | H2H, sharp disagreement |
| CONTEXTUAL | Polish paper gastro article |
| BLOCKED | article published 19:30 when asOf=18:00 |

Probability ~57% is `MODEL_JUDGMENT` / quantification — not justified by the news item.

## UI attribution shape

Each `AttributionCitation` exposes `sourceId`, `sourceUrl`, `publishedAt`, `availableAt`, `observedAt`, `claim`, `epistemicKind`, `polarity`.
