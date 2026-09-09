# TASK 032 — Feature audit

Inventory of information that already exists in this repository. Nothing was invented.

| feature | source | coverage | temporal basis | available_at | matchability | leakage risk | missingness | T-1h | class | motivo |
|---------|--------|----------|----------------|--------------|--------------|--------------|-------------|------|-------|--------|
| MARKET_DEVIG 1X2 | DATASET_031_BASE T-1h odds | 10499 STRICT events | EXACT_RELATIVE PHP hours_before=1 | kickoff − 1h | MATCH_EXACT (frozen file) | low | complete 1X2 required | YES | SAFE_PREMATCH | Baseline. De-vig of the T-1h book. Not a challenger. |
| home_advantage_flag | event identity | 10499 (every 1X2 has a home side) | event identity | fixture known before asOf | MATCH_EXACT | none | none | YES | SAFE_PREMATCH | Identity only. Already encoded in HOME vs AWAY legs; not a separate group. |
| market_overround | same T-1h 1X2 | 10499 | EXACT_RELATIVE | kickoff − 1h | MATCH_EXACT | low | none on complete books | YES | SAFE_PREMATCH | Derived from the baseline book. Not an independent information source. |
| G1 reconstructed Elo (expanding, STRICT results after LOCK) | DATASET_031_BASE FT after reveal | 10499 walk-forward | SAFE_AFTER_RECONSTRUCTION; kickoff < asOf | previous match kickoff (result used only after that kickoff) | team slug MATCH_EXACT | low if lagged | Elo starts at 1500 | YES | SAFE_AFTER_RECONSTRUCTION | Not ClubElo. Expanding Elo from STRICT outcomes with kickMs < asOf. |
| G2 reconstructed form + GF/GA (k=5) | DATASET_031_BASE FT after reveal | 10499 walk-forward | lagged points/goals | previous kickoff < asOf | team slug | low if lagged | zero vector if no history | YES | SAFE_AFTER_RECONSTRUCTION | Current match excluded. Registry form_* READY equivalents. |
| G3 H2H/history | DATASET_031_BASE prior meetings | 24.3% TRAIN n≥1 H2H | prior H2H kickoff < asOf | previous H2H kickoff | unordered team pair | low if lagged | [0,0,0] if n=0 | YES | SAFE_AFTER_RECONSTRUCTION | Meetings with kickMs >= asOf are dropped. |
| G4 schedule/rest/congestion + home/away form | DATASET_031_BASE kickoffs | 10499 | previous kickoff < asOf | last completed kickoff | team slug | medium (rest uses kickoff calendar, not travel) | 0 rest if first seen match | YES | SAFE_AFTER_RECONSTRUCTION | Rest/congestion from STRICT kickoffs only. Not a travel/injury model. |
| G5 quote movement T-24h → T-1h | same BeatTheBookie dump hours_before=24 | 86.5% TRAIN T-24h | PHP bin 24, same LEVEL_B as T-1h | kickoff − 24h ≤ asOf | match_id + bookmaker | low if bin≥1 | flag + zeros if no T-24h book | YES | SAFE_PREMATCH | Not closing. hours_before=0 is rejected. No interpolation. |
| bookmaker disagreement / consensus (T-1h multi-book) | audit/external/task-029/books-t1h.csv | overlay on disk (TASK 029) | same PHP T-1h bin | kickoff − 1h | frozen match_id MATCH_EXACT | low | n<2 → no dispersion | YES | SAFE_PREMATCH | Already tested in TASK 029 (NO_INCREMENTAL_INFORMATION). Not a 7th group here. |
| ClubElo official snapshots | api.clubelo.com / pack Elo | 0 on this STRICT set (HTTP/TLS failed TASK 030; DATE_ONLY) | DATE_ONLY / DATASET_WINDOW | not demonstrated as quote-clock | team names, not used | medium | unavailable | NO | RESEARCH_ONLY | Not promoted. Expanding reconstructed Elo is used instead. |
| opening/closing movement (registry opening_closing_movement) | football-data C* / 5dollar opening-closing labels | not in DATASET_031_BASE as a clock | OPEN/CLOSE label | unknown / close after T-1h | n/a | high | n/a | NO | TEMPORALLY_UNKNOWN | CLOSE is forbidden unless available_at ≤ asOf. Opening label is not T-1h. |
| shots_for_5 / match stats | registry PARTIAL; not in STRICT CSV | 0 | post-match stats if present | unknown | n/a | medium | missing stays missing | NO | POST_MATCH | Not in the frozen T-1h file. Do not invent. |
| news / GDELT | none MATCH_EXACT on 2015-16 worldwide STRICT | 0 | CONTEXT_ONLY | not demonstrated pre-kickoff | failed | high if undated | complete absence | NO | RESEARCH_ONLY | News without a pre-kickoff timestamp is CONTEXT_ONLY / BLOCKED. |
| injury / lineup | none in DATASET_031_BASE | 0 | unknown | not present | n/a | high | absent | NO | RESEARCH_ONLY | Not invented. TASK 029 already recorded coverage 0. |
| weather (Open-Meteo archive) | lat/lon + timestamp | 0 MATCH_EXACT stadium lat/lon for this worldwide file | archive hourly if coordinates exist | would be asOf if coordinates+time existed | failed | low if asOf-capped | no coordinates | NO | RESEARCH_ONLY | Cannot attach weather without MATCH_EXACT venue. Not invented. |
| FT / HT / outcome | STRICT CSV settlement columns | 10499 (settlement only) | POST_MATCH | after kickoff / reveal | same event | certain if used in DecisionContext | none after reveal | NO | POST_MATCH | LOCK/REVEAL. Forbidden in DecisionContext. |
| Club-Football C_* clusters / pack Form* / provisional Elo | Club-Football-Match-Data | excluded | FORBIDDEN / UNKNOWN | n/a | n/a | certain / high | n/a | NO | FORBIDDEN | Registry FORBIDDEN/BLOCKED. Not reconstructed into STRICT. |

Feature fingerprint: `dda05a9ad1c003b37716f8dc7e4b3040fad4f6b429256b05cb5a304b27bc6864`

G6 = elo+form+history+schedule+movement reconstructed on DATASET_031_BASE. Bookmaker disagreement was already tested in TASK 029 and is not a seventh group. News/injury/lineup/weather/ClubElo/CLOSE remain BLOCKED.
