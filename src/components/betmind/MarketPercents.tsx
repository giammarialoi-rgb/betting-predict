import { favoriteClassName, favoriteTone, pickFavorite1x2 } from "@/domain/eval/light-analysis/favorite";
import { LIGHT_INSUFFICIENT_IT } from "@/domain/eval/light-analysis/types";
import { fmtPct } from "@/components/betmind/ui";

export type MarketPct = {
  market: string;
  line: number | null;
  selection: string;
  label_it: string;
  probability: number | null;
  n?: number;
  status?: "OK" | "INSUFFICIENT";
  insufficient_it?: string | null;
};

function pctText(m: MarketPct): string {
  if (m.status === "INSUFFICIENT" || m.probability == null) {
    return m.insufficient_it ?? LIGHT_INSUFFICIENT_IT;
  }
  return fmtPct(m.probability);
}

export function MarketPercents({
  markets,
  favorite,
  title,
}: {
  markets: MarketPct[];
  favorite?: "home" | "draw" | "away" | null;
  title?: string;
}) {
  const oneXTwo = markets.filter((m) => m.market === "1x2");
  const fav =
    favorite ??
    (() => {
      const h = oneXTwo.find((m) => m.selection === "HOME")?.probability;
      const d = oneXTwo.find((m) => m.selection === "DRAW")?.probability;
      const a = oneXTwo.find((m) => m.selection === "AWAY")?.probability;
      if (h == null || d == null || a == null) return null;
      return pickFavorite1x2({ home: h, draw: d, away: a });
    })();

  const groups: Array<{ title: string; items: MarketPct[] }> = [
    { title: "1X2", items: oneXTwo },
    {
      title: "Over / Under",
      items: markets.filter((m) => m.market === "over_under"),
    },
    { title: "BTTS", items: markets.filter((m) => m.market === "btts") },
    { title: "Gol squadra", items: markets.filter((m) => m.market === "team_goals") },
    { title: "Calci d’angolo", items: markets.filter((m) => m.market === "corners") },
  ];

  return (
    <div className="space-y-3">
      {title ? <h3 className="bm-card-title">{title}</h3> : null}
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.title}>
            <div className="bm-section-label mb-1">{g.title}</div>
            <ul className="bm-mkt-grid">
              {g.items.map((m) => {
                const is1x2 = m.market === "1x2";
                const key =
                  m.selection === "HOME" ? "home" : m.selection === "DRAW" ? "draw" : "away";
                const tone = is1x2 ? favoriteTone(key, fav) : "muted";
                const cls = is1x2 && m.probability != null ? favoriteClassName(tone) : "";
                return (
                  <li key={`${m.market}:${m.selection}:${m.line ?? ""}`} className="bm-mkt-cell">
                    <span>{m.label_it}</span>
                    <strong className={tone === "favorite" ? "bm-fav" : cls || undefined}>
                      {pctText(m)}
                    </strong>
                    {m.n != null && m.status === "OK" ? (
                      <em className="bm-muted">n={m.n}</em>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
    </div>
  );
}
