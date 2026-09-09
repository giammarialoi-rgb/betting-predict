"""TASK 030 — T-24h odds overlay from the same BeatTheBookie dump as 027/028.

Does NOT rewrite strict-candidates.csv.
PHP bin 47 = hours_before=24. No interpolation. Bin 71 (kickoff) is not used.
"""

from __future__ import annotations

import csv
import gzip
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CACHE027 = os.path.join(ROOT, "audit", "external", "task-027")
AUSTRO = os.path.join(CACHE027, "kaggle-austro")
STRICT = os.path.join(CACHE027, "strict-candidates.csv")
OUTDIR = os.path.join(ROOT, "audit", "external", "task-030")
OUT = os.path.join(OUTDIR, "movement-t24.csv")

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
BIN = 47  # hours_before=24


def wanted_ids() -> set[str]:
    ids: set[str] = set()
    with open(STRICT, encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            mid = (row.get("match_id") or "").strip()
            if mid:
                ids.add(mid)
    return ids


def scan(path: str, wanted: set[str], sink: csv.writer) -> int:
    n = 0
    with gzip.open(path, "rt", encoding="utf-8", errors="replace") as f:
        header = next(f).strip().split(",")
        idx = {h: i for i, h in enumerate(header)}
        if "match_id" not in idx:
            return 0
        for line in f:
            parts = line.rstrip("\n").split(",")
            mid = parts[idx["match_id"]]
            if mid not in wanted:
                continue
            for bname, bi in BOOK_INDEX.items():
                try:
                    h = float(parts[idx[f"home_b{bi}_{BIN}"]])
                    d = float(parts[idx[f"draw_b{bi}_{BIN}"]])
                    a = float(parts[idx[f"away_b{bi}_{BIN}"]])
                except (KeyError, ValueError, IndexError):
                    continue
                if h > 1 and d > 1 and a > 1:
                    sink.writerow([mid, bname, f"{h:.6f}", f"{d:.6f}", f"{a:.6f}"])
                    n += 1
    return n


def main() -> None:
    os.makedirs(OUTDIR, exist_ok=True)
    wanted = wanted_ids()
    print("frozen match_ids", len(wanted))
    with open(OUT, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["match_id", "bookmaker", "home_odds", "draw_odds", "away_odds"])
        n = 0
        for name in ("odds_series.csv.gz", "odds_series_b.csv.gz"):
            p = os.path.join(AUSTRO, name)
            if os.path.exists(p):
                n += scan(p, wanted, w)
                print("scanned", name, "rows_so_far", n)
    print("wrote", n, "t24-rows", OUT)


if __name__ == "__main__":
    main()
