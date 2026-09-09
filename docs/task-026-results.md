# TASK 026 — Break the data bottleneck

**TASK 026 VERDICT: INSUFFICIENT_DATA**

SUCCESS BAND: **SUCCESS_B** (exact timestamp events = 91; gate A = 100)

winner = null · real_money = false · declared_edge = false · MODEL_READY = false · HOLDOUT sacred

## Funnel (facts, not a catalog)

`12 tried → 6 accessible → 3 with timestamp → 5 historical → 91 exact → 1 verified vs kickoff → 0 capital`

**Blocker:** 5DollarFootballAPI and OddsPapi returned 401 without a key (no signup, €0); Kaggle AH public zip is a 90-match SAMPLE with SOURCE timestamps but no kickoff and License=UNKNOWN; Zenodo UCD is DATE_ONLY football-data.co.uk lineage (research, not STRICT); Betfair GitHub sample is MIRROR/SAMPLE (temporal engine only, not licensed capital); Nautilus football MCM file is gitignored and not shipped; kito129 dump is tennis, not football

## Photograph

- Experiment A (research corpus): Club-Football DATE_ONLY Brier if loaded; Zenodo UCD DATE_ONLY acquired.
- Experiment B (STRICT capital): 0 licensed CAPITAL_STRICT events. 1 Betfair MIRROR event validates the temporal engine only.
- Kaggle AH: real SOURCE timestamps in the **public sample** (not 7,494). License UNKNOWN. No kickoff column. Claimed ROI unused.

## One-page verdict

```
TASK 026
EXACT EVENTS: 91
STRICT QUOTES: 3
BOOKMAKERS: Betfair,澳*,Crow*,36*,易*,伟*,明*,金宝*,12*,利*,盈*,18*,平*,香港马*,威*,Interwet*
MARKETS: MATCH_ODDS,ASIAN_HANDICAP
TIME WINDOWS: T-3h,T-1h,T-30m,T-15m,T-5m,T-1m
SOURCES: 12 tried / 6 accessible / 3 with timestamp
MATCHED: 1 EXACT
MODEL READY: false
2001: events=6329 strict=0 bets=0 end=—
2002: events=6173 strict=0 bets=0 end=—
2003: events=3967 strict=0 bets=0 end=—
2004: events=5534 strict=0 bets=0 end=—
2005: events=6340 strict=0 bets=0 end=—
2006: events=6959 strict=0 bets=0 end=—
2007: events=6585 strict=0 bets=0 end=—
2008: events=7148 strict=0 bets=0 end=—
2009: events=7054 strict=0 bets=0 end=—
2010: events=6925 strict=0 bets=0 end=—
2011: events=7410 strict=0 bets=0 end=—
2012: events=10597 strict=0 bets=0 end=—
2013: events=11729 strict=0 bets=0 end=—
2014: events=11993 strict=0 bets=0 end=—
2015: events=12352 strict=0 bets=0 end=—
2016: events=12100 strict=0 bets=0 end=—
2017: events=12364 strict=0 bets=0 end=—
2018: events=12042 strict=0 bets=0 end=—
2019: events=12018 strict=0 bets=0 end=—
2020: events=9562 strict=0 bets=0 end=—
2021: events=13127 strict=0 bets=0 end=—
2022: events=12168 strict=0 bets=0 end=—
2023: events=12501 strict=0 bets=0 end=—
2024: events=11148 strict=0 bets=0 end=—
2025: events=7458 strict=0 bets=0 end=—
2026: events=4571 strict=0 bets=0 end=—
TOTAL BETS: 0
TOTAL P/L: —
BEST MODEL: null
BEST RISK POLICY: null
MAX DD: —
HOLDOUT: SACRED
SUCCESS BAND: SUCCESS_B
VERDICT: INSUFFICIENT_DATA
FUNNEL: 12 tried → 6 accessible → 3 with timestamp → 5 historical → 91 exact → 1 verified vs kickoff → 0 capital
BLOCKER: 5DollarFootballAPI and OddsPapi returned 401 without a key (no signup, €0); Kaggle AH public zip is a 90-match SAMPLE with SOURCE timestamps but no kickoff and License=UNKNOWN; Zenodo UCD is DATE_ONLY football-data.co.uk lineage (research, not STRICT); Betfair GitHub sample is MIRROR/SAMPLE (temporal engine only, not licensed capital); Nautilus football MCM file is gitignored and not shipped; kito129 dump is tennis, not football
winner = null
real_money = false
auto_promotion = false
```

## Research diagnostic (not capital)

- Club events=238858 with_odds=235806 bets=0
- market_brier=0.200603738196271 frequency_brier=0.21583692037302485 elo_brier=0.20753915349161814 form_brier=0.21318881988444394 poisson_brier=0.2177489471009106

If A has signal and B cannot run, the bottleneck is data. This run: B cannot run (capital n=0). A is DATE_ONLY only.
