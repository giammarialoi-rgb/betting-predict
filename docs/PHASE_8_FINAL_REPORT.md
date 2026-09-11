# Phase 8 — Event Intelligence and Real Data Acquisition

Runtime: `phase-8-event-intelligence-v1`.

Principle unchanged: no invented data, no HTTP 200 homepage as SUCCESS, no odds in the independent model, no post-kickoff leakage, no lowered gates (`coverage >= 0.35`, `missing_keys <= 45`).

Phase 8 is not another honesty or UI rename. It is a data-path change: identity first, then source routing, then continue-on-fail extraction, then observations with provenance, then features, then the same Poisson gates.

## 1. Baseline Phase 7

Source: `artifacts/phase-7/research-cycle-report.json` (2026-09-10).

| Metric | Phase 7 |
|---|---|
| Events researched | 20 |
| Events with real event-level data | 12 |
| Observations created in cycle | 744 |
| Real event observations | ~48 (almost all Open-Meteo) |
| Historical | 36 |
| Derived | 660 |
| Data yield (cycle) | **1.958** |
| HTML scrape typed SUCCESS | 0 |
| xG / injuries / lineups / referee | 0 |
| Form / team stats | Football-Data where bound |
| Weather | where stadium coords existed |

Aston Villa vs Nottingham Forest in Phase 7: 221 store observations, form + team stats + weather, nothing else.

## 2. What Phase 8 changed in the data path

1. **Identity resolver** — accent/FC/Utd/Inter/Roma/Bayern aliases; competition matrix beyond EPL (`E0`, `I1`, `SP1`, `D1`, `F1`, UCL/UEL/UECL). Source IDs stay `null` until observed.
2. **Persistent identity cache** — `api_sports_fixture_id`, team IDs, venue, URLs in `audit/external/task-044/identity/source-events.json`. Discovery is not repeated every cycle.
3. **API-Sports fixture resolver** — batch `/fixtures?date=` then match home/away names. IDs are never invented. Once found, the same ID is used for injuries, lineups, referee, venue.
4. **Continue-on-fail routing** — 403/429 cooldown; one blocked source does not stop the graph.
5. **Understat prior xG** — parse `datesData` when present; target match excluded; previous season fetched. HTTP 200 without `datesData` is PARSE_ERROR, not SUCCESS.
6. **Availability / lineups** — typed `PlayerAvailabilityObservation`; EXPECTED vs CONFIRMED kept separate; empty injury/lineup lists are not stored as zero.
7. **Calendar congestion** — matches last 7/14/21 days and rest days from priors with `excluded_target=true`.
8. **News** — RSS classified into categories, CONTEXT only, never a free-text probability nudge.
9. **Weather venues** — expanded stadium coordinate registry (Open-Meteo).
10. **Data quality letter A–F** — separate from model confidence.
11. **Italian dossier** — cosa ha analizzato / trovato / non ha trovato; technical keys under details.
12. **Sources page** — event-level success and observation counts, not homepage HTTP 200.

## 3. Sources implemented vs blocked

| Source | Event-level status | Notes |
|---|---|---|
| Football-Data.co.uk | ACTIVE | Form, shots, SOT, corners, cards, H2H, calendar derived. Target excluded. |
| Club-Football-Match-Data | PARTIAL | Historical prior GF/GA. Not MODEL. |
| Open-Meteo | ACTIVE | Forecast at kickoff when coords exist. CONTEXT. |
| API-Sports | ACTIVE when key loaded | Fixture IDs resolved (e.g. Villa Park 1557397). Injuries + some referee. Lineups often unpublished. |
| ANSA RSS | PARTIAL | Both-team mention only. CONTEXT. |
| The Odds API | MARKET only | Never MODEL. |
| Understat | NO_DATA | League HTML 200 (~18k) without embedded `datesData` (JS-loaded). Not SUCCESS. |
| SofaScore / FBref / WhoScored / Diretta / Flashscore / Soccerway | BLOCKED | Ordinary GET 403. No WAF bypass. |
| ClubElo | ERROR | `MISSING_FILE` in this run. |
| Sky Sport RSS | ERROR | No public RSS that returns items. |
| OddsPedia / Betshoot / Click4Soccer / Opta / Athletic / CIES | MISSING_ADAPTER or POLICY | Catalogue kept. Not deleted. |

HTML scrape typed SUCCESS remains **0** for WAF-fronted pages. That is honest, not a probe-as-success cheat.

## 4. 20-event real acquisition (2026-09-11)

Script: `pnpm phase8:research` with `.env.local` loaded. No mocks.

Cycle metrics (what this run created):

| Metric | Phase 7 | Phase 8 | Delta |
|---|---|---|---|
| Observations created | 744 | **929** | +25% |
| Real event observations | ~48 | **144** | +200% |
| Historical | 36 | 36 | = |
| Derived | 660 | 749 | +13% |
| Data yield | 1.958 | **2.445** | **+25%** |
| Events with real event data | 12 | **18** | +6 |
| Events researched | 20 | 20 | = |

Category coverage on the 20-event sample:

| Category | Phase 7 | Phase 8 |
|---|---|---|
| Form | high (Football-Data bind) | **1.00** |
| Team stats | high | **1.00** |
| Weather | ~0.60 | **0.80** |
| Injuries | 0 | **0.30** |
| Referee | 0 | **0.15** |
| Lineups (confirmed) | 0 | **0** (unpublished; not faked) |
| xG | 0 | **0** (Understat payload not in HTML) |

Store-side counts for the same 20 events are higher (Football-Data 2847 rows, yield_sum 8.822) because Lab B was not wiped between phases. The **cycle** numbers above are the fair before/after.

### Sample events

| Event | Store obs | Found | Missing |
|---|---|---|---|
| Aston Villa vs Nottingham Forest | 394 | form, stats, injuries, weather | xG, confirmed XI, referee |
| Liverpool vs Fulham | 400 | form, stats, injuries, weather | xG, XI, referee |
| Tottenham vs Everton | 400 | form, stats, injuries, weather | xG, XI, referee |
| Sunderland vs Arsenal | 124 | form, stats, injuries, weather | xG, XI, referee |
| Venezia vs Fiorentina | 253 | form, stats, referee, weather | xG, injuries, XI |
| Rennes vs Marseille | 316 | form, stats, weather | xG, injuries, XI, referee |
| Omonoia vs Celta | 3 | form, stats (thin) | almost everything else |
| Ararat-Armenia vs Sparta | 3 | form, stats (thin) | almost everything else |

Odds entered the independent model: **FALSE** on every event.

Independent inference still uses the same coverage/missing_keys rules. Thin European ties correctly stay INSUFFICIENT_DATA rather than receiving invented percentages.

## 5. Feature / model path

RAW observation → normalize → temporal firewall (`available_at <= kickoff`) → feature bag → quality letter → vector → `INDEPENDENT_POISSON_v1`.

Odds, implied probability, and market movement stay MARKET_LAYER.

Target match is excluded from rolling L3/L5/L10.

Gates were **not** changed:

```
missing_keys.length > 45 || feature_coverage < 0.35  → no independent probability
```

## 6. Remaining blockers (technical, not documentation excuses)

1. **SofaScore / FBref / WhoScored** — Cloudflare/WAF 403 on ordinary GET. Implementing a bypass would violate policy. Cache + continue-on-fail is the legal path.
2. **Understat xG** — page returns 200 but `datesData` is loaded by JavaScript. Parser correctly returns PARSE_ERROR. No invented xG.
3. **Confirmed lineups** — API-Sports often returns empty until about 60 minutes before kickoff. Empty is not stored as 0-XI.
4. **ClubElo CSV** — file missing in this worker environment (`MISSING_FILE`).
5. **Short-name matching** — after the 20-event run, `namesEqual("Villa", "Aston Villa")` was tightened to false so `"villa"` cannot bind Villarreal or a stray injury team. Fixture IDs already cached remain the official API-Sports IDs (Villa Park 1557397, Anfield 1557403, and so on).
6. **HTML event-page scraping** — still 0 SUCCESS on WAF sites. Alternative licensed/public JSON (API-Sports, Football-Data, Open-Meteo, RSS) is what actually raised yield.

## 7. Tests

Phase 8 suite: identity aliases without invented IDs, fixture inject, Understat prior-only, news classification, odds firewall, unchanged gates, 403 cooldown, quality letter, short-name non-match.

`pnpm test`: 695 pass, 0 fail. `pnpm lint`: 0 errors (pre-existing warnings only). Build recorded at the end of this phase.

## 8. Production verification checklist

After commit + push:

- one brain worker, runtime `phase-8-event-intelligence-v1`
- `pnpm runtime:publish`
- `/events` for yesterday / today / tomorrow shows **all** discovered football events for the selected date
- Sources page shows event-level counts, not homepage OK
- at least five dossiers: Italian found/missing, market separate, prediction only if independent inference exists

## 9. Verdict

Phase 8 **improved real data yield** (1.958 → 2.445 cycle yield; 12 → 18 events with real event-level rows; first non-zero injuries and referee coverage).

It did **not** magically unlock SofaScore, FBref, WhoScored, or Understat xG. Those remain blocked or empty for documented technical reasons. The system now keeps searching the rest of the graph instead of stopping at the first 403.

Success criterion met: more real observations per researched event, without lowering gates, inventing data, or feeding odds into the model.
