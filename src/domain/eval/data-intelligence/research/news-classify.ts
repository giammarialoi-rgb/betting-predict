/**
 * News classification. Headlines stay CONTEXT. Never become probability.
 */
import { coerceAvailableAtToIso } from "@/lib/available-at";
export type NewsCategory =
  | "INJURY"
  | "SUSPENSION"
  | "LINEUP"
  | "COACH"
  | "TRANSFER"
  | "TACTICAL"
  | "MOTIVATION"
  | "SCHEDULE"
  | "WEATHER"
  | "OTHER";

export type NewsObservation = {
  source: string;
  published_at: string | null;
  team: string | null;
  event: string | null;
  category: NewsCategory;
  title: string;
  summary: string | null;
  entities: string[];
};

const RULES: Array<{ cat: NewsCategory; re: RegExp }> = [
  { cat: "INJURY", re: /infortun|injur|knock|out for|muscolar|lesione|visita medica/i },
  { cat: "SUSPENSION", re: /squalif|suspend|banned|cartellino ross|espuls/i },
  { cat: "LINEUP", re: /formazione|line[- ]?up|\bxi\b|titolari|panchina/i },
  { cat: "COACH", re: /allenator|coach|mister|manager|esonero|sacked/i },
  { cat: "TRANSFER", re: /trasfer|transfer|colpo di mercato|cessione|acquisto/i },
  { cat: "TACTICAL", re: /modulo|tattica|pressing|3-5-2|4-3-3|4-2-3-1/i },
  { cat: "MOTIVATION", re: /derby|rivincita|motivaz|morale/i },
  { cat: "SCHEDULE", re: /calendario|rinvi|postpone|turnaround|recupero/i },
  { cat: "WEATHER", re: /maltempo|pioggia|neve|vento|weather/i },
];

export function classifyNewsText(title: string, summary?: string | null): NewsCategory {
  const hay = `${title} ${summary ?? ""}`;
  for (const r of RULES) {
    if (r.re.test(hay)) return r.cat;
  }
  return "OTHER";
}

export function newsObservationFromRss(input: {
  source: string;
  title: string;
  link: string | null;
  pubDate: string | null;
  eventId: string;
  home: string;
  away: string;
}): NewsObservation {
  return {
    source: input.source,
    published_at: coerceAvailableAtToIso(input.pubDate),
    team: null,
    event: input.eventId,
    category: classifyNewsText(input.title),
    title: input.title,
    summary: null,
    entities: [input.home, input.away],
  };
}
