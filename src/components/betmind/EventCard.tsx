import Link from "next/link";
import { OddsBlock } from "@/components/betmind/OddsBlock";
import { Pill, fmtWhen, sportBucket } from "@/components/betmind/ui";
import {
  bucketLabelIt,
  decisionLabelIt,
  eventStatusIt,
} from "@/domain/eval/betmind-runtime/status-copy";

export type EventCardEvent = {
  event_id?: unknown;
  sport?: unknown;
  competition?: unknown;
  label?: unknown;
  kickoff_utc?: unknown;
  status?: unknown;
  prediction_status?: unknown;
  decision?: unknown;
  calendar_bucket?: unknown;
  bucket?: unknown;
  odds_home?: unknown;
  odds_draw?: unknown;
  odds_away?: unknown;
  bookmaker?: unknown;
  odds_status?: unknown;
  home_or_a?: unknown;
  away_or_b?: unknown;
  result?: unknown;
  score?: unknown;
  note?: unknown;
  why?: unknown;
  home_goals?: unknown;
  away_goals?: unknown;
  minute?: unknown;
};

function text(v: unknown): string {
  return String(v ?? "").trim();
}

function matchTitle(ev: EventCardEvent): string {
  const home = text(ev.home_or_a);
  const away = text(ev.away_or_b);
  if (home && away) return `${home} vs ${away}`;
  return text(ev.label) || text(ev.event_id) || "Partita";
}

export function EventCard({
  event: ev,
  href,
}: {
  event: EventCardEvent;
  href?: string;
}) {
  const kick = text(ev.kickoff_utc);
  const competition = text(ev.competition);
  const sport = bucketLabelIt(sportBucket(text(ev.sport) || null));
  const rawStatus = text(ev.status);
  const status = eventStatusIt(rawStatus);
  const bucket = text(ev.calendar_bucket) || text(ev.bucket);
  const decision = decisionLabelIt(text(ev.decision) || text(ev.prediction_status) || bucket);
  const homeGoals = text(ev.home_goals);
  const awayGoals = text(ev.away_goals);
  const minute = text(ev.minute) || (/\d/.test(text(ev.note)) ? text(ev.note) : "");
  const result =
    text(ev.result) ||
    (homeGoals !== "" && awayGoals !== "" ? `${homeGoals}–${awayGoals}` : "") ||
    text(ev.score);
  const why = text(ev.why);
  const inner = (
    <article className="bm-event-card">
      <header className="bm-event-head">
        <div className="min-w-0">
          {(competition || sport) && (
            <div className="bm-event-meta">
              {competition || sport}
              {competition && sport && sport !== "—" ? ` · ${sport}` : ""}
            </div>
          )}
          <h3 className="bm-event-title">{matchTitle(ev)}</h3>
          <p className="bm-event-time">
            {kick ? fmtWhen(kick) : "Orario non disponibile"}
            {rawStatus ? ` · ${status}` : ""}
            {minute ? ` · ${minute}` : ""}
          </p>
        </div>
        <div className="bm-event-flags">
          <Pill>{decision}</Pill>
          {/live|in_play|playing|1h|2h|ht/i.test(rawStatus) ? <Pill accent>LIVE</Pill> : null}
          {result ? <Pill>{result}</Pill> : null}
        </div>
      </header>
      <OddsBlock event={ev} compact />
      {(bucket === "SKIPPED" || bucket === "UNAVAILABLE") && why ? (
        <p className="bm-event-why">{decisionLabelIt(why)}</p>
      ) : null}
    </article>
  );

  if (!href) return inner;
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}
