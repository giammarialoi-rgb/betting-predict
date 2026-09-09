import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { hasUtcOffset, parseCsv, parseIsoMs } from "@/domain/eval/breakthrough-035/csv";
import type { NormalizedQuote035 } from "@/domain/eval/breakthrough-035/types";

const PROD = join(process.cwd(), "audit", "external", "task-035");
const FIX = join(process.cwd(), "src", "domain", "eval", "breakthrough-035", "fixtures");

export function resolve035File(name: string): string | null {
  const prod = join(PROD, name);
  if (existsSync(prod)) return prod;
  const fix = join(FIX, name);
  if (existsSync(fix)) return fix;
  return null;
}

function num(raw: string | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function parseHfSoccerOdds(text: string): NormalizedQuote035[] {
  const rows = parseCsv(text);
  const h = rows[0] ?? [];
  const idx = (n: string) => h.indexOf(n);
  const out: NormalizedQuote035[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const price = num(r[idx("outcome_price")]);
    if (price == null) continue;
    const quote = r[idx("bookmaker_last_update")] ?? "";
    const kick = r[idx("commence_time")] ?? "";
    const quoteMs = parseIsoMs(quote.replace(" ", "T"));
    const kickMs = parseIsoMs(kick.replace(" ", "T"));
    out.push({
      event_id: r[idx("match_id")] ?? `hf-soccer-${i}`,
      market_id: r[idx("market_key")] ?? "h2h",
      selection: r[idx("outcome_name")] ?? "",
      price,
      quote_timestamp: quote || null,
      kickoff_timestamp: kick || null,
      source: "hf_soccer_odds",
      source_record_id: `${r[idx("match_id")]}|${r[idx("bookmaker_key")]}|${r[idx("outcome_name")]}|${i}`,
      timezone: null,
      temporal_basis: "NAIVE_DATETIME",
      quote_has_offset: hasUtcOffset(quote),
      kickoff_has_offset: hasUtcOffset(kick),
      prematch_candidate: quoteMs != null && kickMs != null && quoteMs < kickMs,
      inplay_or_post: quoteMs != null && kickMs != null && quoteMs >= kickMs,
      bookmaker: r[idx("bookmaker_title")] ?? null,
      competition: r[idx("sport_title")] ?? null,
      home: r[idx("home_team")] ?? null,
      away: r[idx("away_team")] ?? null,
      ft_home: null,
      ft_away: null,
    });
  }
  return out;
}

export function parseOlivierClosing(text: string): NormalizedQuote035[] {
  const rows = parseCsv(text);
  const h = rows[0] ?? [];
  const idx = (n: string) => h.indexOf(n);
  const out: NormalizedQuote035[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const home = num(r[idx("Closing_Odds_Home")]);
    const draw = num(r[idx("Closing_Odds_Draw")]);
    const away = num(r[idx("Closing_Odds_Away")]);
    const eventId = `olivier-${r[idx("Date")]}-${r[idx("Home_Team")]}-${r[idx("Away_Team")]}`;
    const legs: { sel: string; price: number | null }[] = [
      { sel: "HOME", price: home },
      { sel: "DRAW", price: draw },
      { sel: "AWAY", price: away },
    ];
    for (const leg of legs) {
      if (leg.price == null) continue;
      out.push({
        event_id: eventId,
        market_id: "1X2",
        selection: leg.sel,
        price: leg.price,
        quote_timestamp: null,
        kickoff_timestamp: null,
        source: "hf_olivier_closing",
        source_record_id: `${eventId}|${leg.sel}`,
        timezone: null,
        temporal_basis: "CLOSING",
        quote_has_offset: false,
        kickoff_has_offset: false,
        prematch_candidate: false,
        inplay_or_post: false,
        bookmaker: "CLOSING_AVG",
        competition: r[idx("League")] ?? null,
        home: r[idx("Home_Team")] ?? null,
        away: r[idx("Away_Team")] ?? null,
        ft_home: num(r[idx("Home_Goal")]),
        ft_away: num(r[idx("Away_Goal")]),
      });
    }
  }
  return out;
}

export function parseFiveDollarInplay(text: string): NormalizedQuote035[] {
  const rows = parseCsv(text);
  const h = rows[0] ?? [];
  const idx = (n: string) => h.indexOf(n);
  const out: NormalizedQuote035[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const kick = r[idx("kickoff_beijing")] ?? "";
    const quote = r[idx("pre_quote_at")] ?? "";
    const quoteMs = parseIsoMs(quote.replace(" ", "T"));
    const kickMs = parseIsoMs(kick.replace(" ", "T"));
    const legs = [
      { sel: "HOME", price: num(r[idx("pre_home_odds")]) },
      { sel: "DRAW", price: num(r[idx("pre_draw_odds")]) },
      { sel: "AWAY", price: num(r[idx("pre_away_odds")]) },
    ];
    for (const leg of legs) {
      if (leg.price == null) continue;
      out.push({
        event_id: r[idx("match_id")] ?? `5d-${i}`,
        market_id: "1X2",
        selection: leg.sel,
        price: leg.price,
        quote_timestamp: quote || null,
        kickoff_timestamp: kick || null,
        source: "hf_5dollar_inplay",
        source_record_id: `${r[idx("match_id")]}|${leg.sel}|${i}`,
        timezone: "ASIA/SHANGHAI_NAMED_UNVERIFIED",
        temporal_basis: "INPLAY_FIRST_GOAL",
        quote_has_offset: hasUtcOffset(quote),
        kickoff_has_offset: hasUtcOffset(kick),
        prematch_candidate: false,
        inplay_or_post: true,
        bookmaker: r[idx("bookmaker")] ?? "Bet365",
        competition: "Premier League",
        home: r[idx("home_team")] ?? null,
        away: r[idx("away_team")] ?? null,
        ft_home: num(r[idx("final_home_goals")]),
        ft_away: num(r[idx("final_away_goals")]),
      });
    }
    void quoteMs;
    void kickMs;
  }
  return out;
}

export function parseSharpApi(text: string): NormalizedQuote035[] {
  const rows = parseCsv(text);
  const h = rows[0] ?? [];
  const idx = (n: string) => h.indexOf(n);
  const out: NormalizedQuote035[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    if ((r[idx("sport")] ?? "") !== "soccer") continue;
    const price = num(r[idx("odds_decimal")]);
    if (price == null) continue;
    const quote = r[idx("timestamp")] ?? "";
    const kick = r[idx("event_start_time")] ?? "";
    const live = String(r[idx("is_live")]).toLowerCase() === "true";
    const quoteMs = parseIsoMs(quote);
    const kickMs = parseIsoMs(kick);
    const midnight = /T00:00:00/.test(kick);
    out.push({
      event_id: r[idx("event_id")] ?? `sharp-${i}`,
      market_id: r[idx("market_type")] ?? "unknown",
      selection: r[idx("selection")] ?? "",
      price,
      quote_timestamp: quote || null,
      kickoff_timestamp: kick || null,
      source: "sharpapi_wc2026",
      source_record_id: `${r[idx("id")]}|${r[idx("sportsbook")]}|${i}`,
      timezone: hasUtcOffset(quote) && hasUtcOffset(kick) ? "UTC" : null,
      temporal_basis: midnight ? "ISO_Z_MIDNIGHT_AMBIGUOUS" : "ISO_Z_SNAPSHOT",
      quote_has_offset: hasUtcOffset(quote),
      kickoff_has_offset: hasUtcOffset(kick),
      prematch_candidate: !live && quoteMs != null && kickMs != null && quoteMs < kickMs && !midnight,
      inplay_or_post: live || (quoteMs != null && kickMs != null && quoteMs >= kickMs),
      bookmaker: r[idx("sportsbook")] ?? null,
      competition: r[idx("league")] ?? null,
      home: r[idx("home_team")] ?? null,
      away: r[idx("away_team")] ?? null,
      ft_home: null,
      ft_away: null,
    });
  }
  return out;
}

function walkCsv(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkCsv(p, acc);
    else if (e.name.endsWith(".csv")) acc.push(p);
  }
  return acc;
}

export function parseKaggleAhSample(limitFiles = 90): NormalizedQuote035[] {
  const dir = join(process.cwd(), "audit", "external", "task-026", "kaggle-ah", "sample");
  const files = walkCsv(dir).slice(0, limitFiles);
  const out: NormalizedQuote035[] = [];
  for (const file of files) {
    const rows = parseCsv(readFileSync(file, "utf8"));
    const h = rows[0] ?? [];
    const idx = (n: string) => h.indexOf(n);
    const eventId = file.replaceAll("\\", "/").split("/").slice(-1)[0] ?? file;
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]!;
      const price = num(r[idx("Home Odds")]);
      if (price == null) continue;
      const ts = r[idx("Timestamp")] ?? "";
      out.push({
        event_id: eventId,
        market_id: "AH",
        selection: "HOME",
        price,
        quote_timestamp: ts || null,
        kickoff_timestamp: null,
        source: "kaggle_ah_sample",
        source_record_id: `${eventId}|${i}`,
        timezone: null,
        temporal_basis: "COMPACT_NAIVE",
        quote_has_offset: false,
        kickoff_has_offset: false,
        prematch_candidate: false,
        inplay_or_post: false,
        bookmaker: r[idx("Bookmaker")] ?? null,
        competition: file.includes("EPL") ? "EPL" : file.includes("LaLiga") ? "LaLiga" : null,
        home: null,
        away: null,
        ft_home: null,
        ft_away: null,
      });
      break;
    }
  }
  return out;
}

export function parseFootballDataE0(text: string): NormalizedQuote035[] {
  const rows = parseCsv(text);
  const h = rows[0] ?? [];
  if (!h.includes("Div") || !h.includes("B365H")) return [];
  const idx = (n: string) => h.indexOf(n);
  const out: NormalizedQuote035[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i]!;
    const eventId = `fd-${r[idx("Date")]}-${r[idx("HomeTeam")]}-${r[idx("AwayTeam")]}`;
    const legs = [
      { sel: "HOME", price: num(r[idx("B365H")]) },
      { sel: "DRAW", price: num(r[idx("B365D")]) },
      { sel: "AWAY", price: num(r[idx("B365A")]) },
    ];
    for (const leg of legs) {
      if (leg.price == null) continue;
      out.push({
        event_id: eventId,
        market_id: "1X2",
        selection: leg.sel,
        price: leg.price,
        quote_timestamp: null,
        kickoff_timestamp: null,
        source: "football_data_co_uk_ia",
        source_record_id: `${eventId}|${leg.sel}`,
        timezone: null,
        temporal_basis: "OPEN_CLOSE",
        quote_has_offset: false,
        kickoff_has_offset: false,
        prematch_candidate: false,
        inplay_or_post: false,
        bookmaker: "B365",
        competition: r[idx("Div")] ?? "E0",
        home: r[idx("HomeTeam")] ?? null,
        away: r[idx("AwayTeam")] ?? null,
        ft_home: num(r[idx("FTHG")]),
        ft_away: num(r[idx("FTAG")]),
      });
    }
  }
  return out;
}

export function loadAllNewQuotes035(input: { skipHeavy?: boolean }): NormalizedQuote035[] {
  const skip = input.skipHeavy === true;
  const out: NormalizedQuote035[] = [];
  const soccer = resolve035File("hf-soccer_odds.csv");
  if (soccer) out.push(...parseHfSoccerOdds(readFileSync(soccer, "utf8")));
  const olivier = resolve035File("hf-olivier-sample.csv");
  if (olivier) out.push(...parseOlivierClosing(readFileSync(olivier, "utf8")));
  const five = resolve035File("hf-5dollar-inplay.csv");
  if (five) out.push(...parseFiveDollarInplay(readFileSync(five, "utf8")));
  const sharp = resolve035File("sharpapi-wc2026.csv");
  if (sharp) out.push(...parseSharpApi(readFileSync(sharp, "utf8")));
  const fd = resolve035File("ia-e0-1920.csv");
  if (fd && !skip) out.push(...parseFootballDataE0(readFileSync(fd, "utf8")));
  if (!skip) out.push(...parseKaggleAhSample(90));
  return out;
}
