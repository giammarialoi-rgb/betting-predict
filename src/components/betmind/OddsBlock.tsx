import { fmtN } from "@/components/betmind/ui";

export type OddsInput = {
  odds_home?: unknown;
  odds_draw?: unknown;
  odds_away?: unknown;
  bookmaker?: unknown;
  odds_status?: unknown;
  odds_source?: unknown;
};

function decimalOdds(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v) && v > 1) return v;
  const n = Number(v);
  return Number.isFinite(n) && n > 1 ? n : null;
}

/** Complete book 1X2 only — never invent or invert implied probabilities. */
export function completeBook1x2(ev: OddsInput): {
  home: number;
  draw: number;
  away: number;
} | null {
  const home = decimalOdds(ev.odds_home);
  const draw = decimalOdds(ev.odds_draw);
  const away = decimalOdds(ev.odds_away);
  if (home == null || draw == null || away == null) return null;
  return { home, draw, away };
}

export function OddsBlock({
  event,
  compact = false,
}: {
  event: OddsInput;
  compact?: boolean;
}) {
  const book = completeBook1x2(event);
  const bookmaker = String(event.bookmaker ?? "").trim();

  if (!book) {
    return (
      <div className={`bm-odds ${compact ? "bm-odds-compact" : ""}`}>
        <div className="bm-odds-label">Quote 1X2</div>
        <p className="bm-odds-missing">Quote non disponibili</p>
      </div>
    );
  }

  return (
    <div className={`bm-odds ${compact ? "bm-odds-compact" : ""}`}>
      <div className="bm-odds-label">Quote 1X2</div>
      <div className="bm-odds-grid" aria-label="Quote Casa, Pareggio, Trasferta">
        <div>
          <span>Casa</span>
          <strong>{fmtN(book.home, 2)}</strong>
        </div>
        <div>
          <span>Pareggio</span>
          <strong>{fmtN(book.draw, 2)}</strong>
        </div>
        <div>
          <span>Trasferta</span>
          <strong>{fmtN(book.away, 2)}</strong>
        </div>
      </div>
      <p className="bm-odds-note">
        {bookmaker ? `Book: ${bookmaker}` : "Book osservato"} · solo confronto, non entrano nel modello
      </p>
    </div>
  );
}
