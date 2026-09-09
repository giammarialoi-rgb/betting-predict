# TASK 018 — Dataset Column Audit

Source: `xgabora/Club-Football-Match-Data` Matches.csv (SECONDARY / BENCHMARK).

| Column | Semantics | Temporality | Usability | STRICT | Reason |
|--------|-----------|-------------|-----------|--------|--------|
| Division | event_schedule | event_identity_or_schedule | SAFE_PREMATCH | YES | Identity/schedule fields — not availability timestamps for odds |
| MatchDate | event_schedule | event_identity_or_schedule | SAFE_PREMATCH | YES | Identity/schedule fields — not availability timestamps for odds |
| MatchTime | event_schedule | event_identity_or_schedule | SAFE_PREMATCH | YES | Identity/schedule fields — not availability timestamps for odds |
| HomeTeam | event_identity | event_identity_or_schedule | SAFE_PREMATCH | YES | Identity/schedule fields — not availability timestamps for odds |
| AwayTeam | event_identity | event_identity_or_schedule | SAFE_PREMATCH | YES | Identity/schedule fields — not availability timestamps for odds |
| HomeElo | rating_snapshot | conditional | RESEARCH_ONLY | NO | Match-row Elo conditional; STRICT prefers official ClubElo with rating_date < kickoff |
| AwayElo | rating_snapshot | conditional | RESEARCH_ONLY | NO | Match-row Elo conditional; STRICT prefers official ClubElo with rating_date < kickoff |
| Form3Home | derived_form | conditional | SAFE_AFTER_RECONSTRUCTION | NO | Do not use repo Form*; reconstruct from lagged FT results only |
| Form5Home | derived_form | conditional | SAFE_AFTER_RECONSTRUCTION | NO | Do not use repo Form*; reconstruct from lagged FT results only |
| Form3Away | derived_form | conditional | SAFE_AFTER_RECONSTRUCTION | NO | Do not use repo Form*; reconstruct from lagged FT results only |
| Form5Away | derived_form | conditional | SAFE_AFTER_RECONSTRUCTION | NO | Do not use repo Form*; reconstruct from lagged FT results only |
| FTHome | result_outcome | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| FTAway | result_outcome | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| FTResult | result_outcome | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HTHome | result_outcome | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HTAway | result_outcome | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HTResult | result_outcome | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HomeShots | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| AwayShots | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HomeTarget | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| AwayTarget | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HomeFouls | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| AwayFouls | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HomeCorners | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| AwayCorners | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HomeYellow | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| AwayYellow | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| HomeRed | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| AwayRed | post_match_stats | post | POST_MATCH | NO | Outcome/stat realized during or after the match — leakage if used prematch |
| OddHome | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| OddDraw | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| OddAway | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| MaxHome | aggregate_odds | conditional | FORBIDDEN | NO | Aggregate Max/Avg is not a bookmaker; odds clocks undocumented |
| MaxDraw | aggregate_odds | conditional | FORBIDDEN | NO | Aggregate Max/Avg is not a bookmaker; odds clocks undocumented |
| MaxAway | aggregate_odds | conditional | FORBIDDEN | NO | Aggregate Max/Avg is not a bookmaker; odds clocks undocumented |
| Over25 | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| Under25 | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| MaxOver25 | aggregate_odds | conditional | FORBIDDEN | NO | Aggregate Max/Avg is not a bookmaker; odds clocks undocumented |
| MaxUnder25 | aggregate_odds | conditional | FORBIDDEN | NO | Aggregate Max/Avg is not a bookmaker; odds clocks undocumented |
| HandiSize | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| HandiHome | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| HandiAway | odds | unknown | TEMPORALLY_UNKNOWN | NO | Odds present but open/close / available_at not demonstrated — REJECT under STRICT_AS_OF |
| C_LTH | cluster_derived | conditional | FORBIDDEN | NO | Cluster/derived field with undocumented formula — leakage risk |
| C_LTA | cluster_derived | conditional | FORBIDDEN | NO | Cluster/derived field with undocumented formula — leakage risk |
| C_VHD | cluster_derived | conditional | FORBIDDEN | NO | Cluster/derived field with undocumented formula — leakage risk |
| C_VAD | cluster_derived | conditional | FORBIDDEN | NO | Cluster/derived field with undocumented formula — leakage risk |
| C_HTB | cluster_derived | conditional | FORBIDDEN | NO | Cluster/derived field with undocumented formula — leakage risk |
| C_PHB | cluster_derived | conditional | FORBIDDEN | NO | Cluster/derived field with undocumented formula — leakage risk |