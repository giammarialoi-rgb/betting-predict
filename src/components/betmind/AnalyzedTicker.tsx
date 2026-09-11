import Link from "next/link";
import { favoriteClassName, favoriteTone } from "@/domain/eval/light-analysis/favorite";
import type { AnalyzedListRow } from "@/domain/eval/light-analysis/types";
import { fmtKick, fmtPct } from "@/components/betmind/ui";
import { eventStatusIt } from "@/domain/eval/betmind-runtime/status-copy";

function kickClock(iso: string | null): string {
  if (!iso) return "—";
  const clock = fmtKick(iso);
  return clock === "—" ? iso.slice(11, 16) || "—" : clock;
}

function scoreCell(row: AnalyzedListRow): { top: string; bottom: string } {
  const live = /live|in_play|playing/i.test(String(row.status ?? ""));
  const finished = /finish|ended|ft|final|settled/i.test(String(row.status ?? ""));
  if (row.score_home != null && row.score_away != null) {
    return { top: String(row.score_home), bottom: String(row.score_away) };
  }
  if (live) return { top: "LIVE", bottom: "" };
  if (finished) return { top: "FT", bottom: "" };
  return { top: "—", bottom: "" };
}

function groupByLeague(rows: AnalyzedListRow[]): Array<{ league: string; rows: AnalyzedListRow[] }> {
  const map = new Map<string, AnalyzedListRow[]>();
  for (const row of rows) {
    const key = row.competition?.trim() || "Altre competizioni";
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()].map(([league, items]) => ({ league, rows: items }));
}

function oneXTwoPct(row: AnalyzedListRow, sel: "HOME" | "DRAW" | "AWAY"): string {
  const m = (row.markets ?? []).find((x) => x.market === "1x2" && x.selection === sel);
  if (!m || m.probability == null) return "dato insufficiente";
  return fmtPct(m.probability);
}

export function AnalyzedTicker({ events }: { events: AnalyzedListRow[] }) {
  const groups = groupByLeague(events);
  return (
    <div className="bm-ticker" role="table" aria-label="Eventi analizzati">
      {groups.map((g) => (
        <section key={g.league}>
          <header className="bm-ticker-league">
            <span>{g.league}</span>
            <span className="bm-muted">{g.rows.length}</span>
          </header>
          {g.rows.map((row) => {
            const score = scoreCell(row);
            const fav = row.favorite_1x2;
            return (
              <Link
                key={row.event_id}
                href={`/events/${encodeURIComponent(row.event_id)}`}
                className="bm-ticker-row"
              >
                <div className="bm-ticker-time">
                  <span>{kickClock(row.kickoff_utc)}</span>
                  {row.status ? <em>{eventStatusIt(row.status)}</em> : null}
                </div>
                <div className="bm-ticker-teams">
                  <span>{row.home}</span>
                  <span>{row.away}</span>
                </div>
                <div className="bm-ticker-score" aria-label="risultato">
                  <strong>{score.top}</strong>
                  {score.bottom ? <strong>{score.bottom}</strong> : null}
                </div>
                <div className="bm-ticker-pcts">
                  <span className={favoriteClassName(favoriteTone("home", fav))}>
                    1 {oneXTwoPct(row, "HOME")}
                  </span>
                  <span className={favoriteClassName(favoriteTone("draw", fav))}>
                    X {oneXTwoPct(row, "DRAW")}
                  </span>
                  <span className={favoriteClassName(favoriteTone("away", fav))}>
                    2 {oneXTwoPct(row, "AWAY")}
                  </span>
                  <span className="bm-ticker-modes">
                    {row.light ? <em>Light</em> : null}
                    {row.strong ? <em className="bm-accent">Forte</em> : <em className="bm-muted">Forte n/d</em>}
                  </span>
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
