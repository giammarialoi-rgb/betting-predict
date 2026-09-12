import Link from "next/link";
import { favoriteClassName } from "@/domain/eval/light-analysis/favorite";
import { leagueTitleIt } from "@/domain/eval/light-analysis/league-label";
import { listMarketLeans, type ListLean } from "@/domain/eval/light-analysis/list-leans";
import type { AnalyzedListRow } from "@/domain/eval/light-analysis/types";
import { fmtKick } from "@/components/betmind/ui";
import { eventStatusIt, isInPlayBoardStatus } from "@/domain/eval/betmind-runtime/status-copy";

function kickClock(iso: string | null, status: string | null): string {
  const minute = String(status ?? "").match(/\b(\d{1,3})['′]\b/);
  if (minute) return `${minute[1]}'`;
  if (isInPlayBoardStatus(status)) return "LIVE";
  if (!iso) return "—";
  const clock = fmtKick(iso);
  return clock === "—" ? iso.slice(11, 16) || "—" : clock;
}

function scoreCell(row: AnalyzedListRow): { home: string; away: string; preview: boolean } {
  if (row.score_home != null && row.score_away != null) {
    return { home: String(row.score_home), away: String(row.score_away), preview: false };
  }
  return { home: "", away: "", preview: true };
}

function groupByLeague(rows: AnalyzedListRow[]): Array<{ league: string; rows: AnalyzedListRow[] }> {
  const map = new Map<string, AnalyzedListRow[]>();
  for (const row of rows) {
    const key = leagueTitleIt(row.competition);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()].map(([league, items]) => ({ league, rows: items }));
}

function LeanChip({ lean, always }: { lean: ListLean; always?: boolean }) {
  if (lean.hidden && !always) return null;
  return (
    <span className={lean.favorite ? favoriteClassName("favorite") : favoriteClassName("muted")}>
      <abbr title={lean.label_it}>{lean.label_it}</abbr> {lean.text}
    </span>
  );
}

export function AnalyzedTicker({ events }: { events: AnalyzedListRow[] }) {
  const groups = groupByLeague(events);
  return (
    <div className="bm-ticker" role="table" aria-label="Partite analizzate">
      {groups.map((g) => (
        <section key={g.league}>
          <header className="bm-ticker-league">
            <span>{g.league}</span>
            <span>{g.rows.length}</span>
          </header>
          {g.rows.map((row) => {
            const score = scoreCell(row);
            const leans = listMarketLeans(row.markets ?? [], row.favorite_1x2);
            const oneXTwo = leans.filter((l) => l.group === "1x2");
            const extras = leans.filter((l) => l.group !== "1x2" && !l.hidden);
            return (
              <Link
                key={row.event_id}
                href={`/events/${encodeURIComponent(row.event_id)}`}
                className="bm-ticker-row"
              >
                <div className="bm-ticker-time">
                  <span>{kickClock(row.kickoff_utc, row.status)}</span>
                  {row.status ? <em>{eventStatusIt(row.status)}</em> : null}
                </div>
                <div className="bm-ticker-teams">
                  <span>{row.home}</span>
                  <span>{row.away}</span>
                </div>
                <div
                  className={`bm-ticker-score${score.preview ? " bm-ticker-score-preview" : ""}`}
                  aria-label="risultato"
                >
                  {score.preview ? (
                    <>
                      <strong />
                      <strong />
                    </>
                  ) : (
                    <>
                      <strong>{score.home}</strong>
                      <strong>{score.away}</strong>
                    </>
                  )}
                </div>
                <div className="bm-ticker-1x2" aria-label="frequenze 1X2">
                  {oneXTwo.map((lean) => (
                    <LeanChip key={lean.key} lean={lean} always />
                  ))}
                </div>
                <div className="bm-ticker-pcts">
                  {extras.map((lean) => (
                    <LeanChip key={lean.key} lean={lean} />
                  ))}
                  {(row.light || row.strong) && (
                    <span className="bm-ticker-modes">
                      {row.light ? <em>Light</em> : null}
                      {row.strong ? <em className="bm-ticker-strong">Forte</em> : null}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
}
