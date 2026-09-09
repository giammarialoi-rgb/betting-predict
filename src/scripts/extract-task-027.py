"""Rebuild audit/external/task-027/strict-candidates.csv from Kaggle austro gzips + soccer-dataset fixtures.

LEVEL B only: MATCH_EXACT unique (date, home slug, away slug) vs soccer date_utc (documented UTC),
non-midnight kickoff, PHP hours_before=1 (bin 70), complete 1X2 > 1.
Does not treat BeatTheBookie naive match_datetime as UTC.
"""

from __future__ import annotations

import csv
import gzip
import os
import re
from collections import defaultdict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE = os.path.join(ROOT, "audit", "external", "task-027")
AUSTRO = os.path.join(CACHE, "kaggle-austro")
OUT = os.path.join(CACHE, "strict-candidates.csv")
FIXTURES = os.path.join(ROOT, "audit", "external", "task-024", "fixtures.parquet")
TEAMS = os.path.join(ROOT, "audit", "external", "task-024", "teams.parquet")

PREFERRED = ["Pinnacle", "bet365", "Unibet", "William Hill", "Betway", "Betfair Sports"]
# PHP 0-based index → Kaggle 1-based b{n}
BOOK_INDEX = {
    "Interwetten": 1,
    "bwin": 2,
    "bet-at-home": 3,
    "Unibet": 4,
    "Stan James": 5,
    "Expekt": 6,
    "10Bet": 7,
    "William Hill": 8,
    "bet365": 9,
    "Pinnacle": 10,
    "DOXXbet": 11,
    "Betsafe": 12,
    "Betway": 13,
    "888sport": 14,
    "Ladbrokes": 15,
    "Betclic": 16,
    "Sportingbet": 17,
    "myBet": 18,
    "Betsson": 19,
    "188BET": 20,
    "Jetbull": 21,
    "Paddy Power": 22,
    "Tipico": 23,
    "Coral": 24,
    "SBOBET": 25,
    "BetVictor": 26,
    "12BET": 27,
    "Titanbet": 28,
    "youwin": 29,
    "ComeOn": 30,
    "Betadonis": 31,
    "Betfair Sports": 32,
}
HOURS_BEFORE = 1
BIN = 71 - HOURS_BEFORE  # 70


def slug(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def load_matches(path: str) -> list[dict]:
    rows = []
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        r = csv.DictReader(f)
        for row in r:
            rows.append(row)
    return rows


def soccer_index():
    import pandas as pd

    fx = pd.read_parquet(FIXTURES)
    teams = pd.read_parquet(TEAMS)
    # expect columns: date_utc or date, home_id, away_id, home, away
    tmap = {}
    name_col = "name" if "name" in teams.columns else teams.columns[1]
    id_col = "id" if "id" in teams.columns else teams.columns[0]
    for _, t in teams.iterrows():
        tmap[t[id_col]] = str(t[name_col])
    by_key = defaultdict(list)
    date_col = "date_utc" if "date_utc" in fx.columns else "date"
    home_col = "home_team_id" if "home_team_id" in fx.columns else "home_id"
    away_col = "away_team_id" if "away_team_id" in fx.columns else "away_id"
    for _, row in fx.iterrows():
        dt = str(row[date_col])
        if "T" in dt:
            day, clock = dt[:10], dt
        else:
            continue
        hh = clock[11:16] if len(clock) >= 16 else "00:00"
        if hh == "00:00":
            continue
        home = tmap.get(row[home_col], str(row.get("home_name", "")))
        away = tmap.get(row[away_col], str(row.get("away_name", "")))
        key = f"{day}|{slug(home)}|{slug(away)}"
        iso = clock.replace(" ", "T")
        if not iso.endswith("Z") and "+" not in iso:
            iso = iso if "T" in iso else f"{day}T{hh}:00"
        by_key[key].append(iso[:19])
    exact = {k: v[0] for k, v in by_key.items() if len(v) == 1}
    return exact


def pick_book(parts, header_index):
    def triple(bname):
        bi = BOOK_INDEX.get(bname)
        if bi is None:
            return None
        try:
            h = float(parts[header_index[f"home_b{bi}_{BIN}"]])
            d = float(parts[header_index[f"draw_b{bi}_{BIN}"]])
            a = float(parts[header_index[f"away_b{bi}_{BIN}"]])
        except (KeyError, ValueError, IndexError):
            return None
        if h > 1 and d > 1 and a > 1:
            return bname, h, d, a
        return None

    for b in PREFERRED:
        got = triple(b)
        if got:
            return got
    for b in BOOK_INDEX:
        got = triple(b)
        if got:
            return got
    return None


def scan_series(path: str, wanted: dict, header_index=None):
    out = {}
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        header = next(f).strip().split(",")
        idx = {h: i for i, h in enumerate(header)}
        for line in f:
            parts = line.rstrip("\n").split(",")
            mid = parts[idx["match_id"]]
            if mid not in wanted:
                continue
            picked = pick_book(parts, idx)
            if picked:
                out[mid] = picked
    return out


def main() -> None:
    if os.path.exists(OUT) and os.path.getsize(OUT) > 1000:
        print(f"already exists {OUT}")
        return
    matches = load_matches(os.path.join(AUSTRO, "odds_series_matches.csv.gz"))
    matches += load_matches(os.path.join(AUSTRO, "odds_series_b_matches.csv.gz"))
    exact = soccer_index()
    wanted = {}
    meta = {}
    for m in matches:
        day = (m.get("match_datetime") or "")[:10]
        key = f"{day}|{slug(m['home_team'])}|{slug(m['away_team'])}"
        if key not in exact:
            continue
        wanted[m["match_id"]] = exact[key]
        meta[m["match_id"]] = m
    print("MATCH_EXACT overlay", len(wanted))
    series = scan_series(os.path.join(AUSTRO, "odds_series.csv.gz"), wanted)
    series.update(scan_series(os.path.join(AUSTRO, "odds_series_b.csv.gz"), wanted))
    os.makedirs(CACHE, exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(
            [
                "match_id",
                "league",
                "home",
                "away",
                "btb_datetime",
                "soccer_kickoff_utc",
                "bookmaker",
                "hours_before",
                "home_odds",
                "draw_odds",
                "away_odds",
                "ft_home",
                "ft_away",
            ]
        )
        n = 0
        for mid, kick in wanted.items():
            picked = series.get(mid)
            if not picked:
                continue
            m = meta[mid]
            score = (m.get("score") or m.get("detailed_score") or "0-0").replace(":", "-")
            bits = re.findall(r"\d+", score)
            ft_h = int(bits[0]) if bits else 0
            ft_a = int(bits[1]) if len(bits) > 1 else 0
            w.writerow(
                [
                    mid,
                    m.get("league", ""),
                    m.get("home_team", ""),
                    m.get("away_team", ""),
                    m.get("match_datetime", ""),
                    kick,
                    picked[0],
                    HOURS_BEFORE,
                    picked[1],
                    picked[2],
                    picked[3],
                    ft_h,
                    ft_a,
                ]
            )
            n += 1
    print("wrote", n, "rows", OUT)


if __name__ == "__main__":
    main()
