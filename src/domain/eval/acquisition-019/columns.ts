/**
 * Bookmaker column maps. Aggregates are never bookmakers.
 * OPEN vs CLOSE follows football-data.co.uk notes.txt (documented).
 */

import { isAggregateOddsLabel } from "@/domain/markets/canonical";

export type ColumnSpec = {
  bookmakerId: string;
  marketType: string;
  line: number | null;
  selectionSide: string;
  column: string;
  kind: "dataset_open" | "dataset_close";
};

const ONE_X_TWO: ReadonlyArray<{
  slug: string;
  open: [string, string, string];
  close: [string, string, string];
}> = [
  { slug: "bet365", open: ["B365H", "B365D", "B365A"], close: ["B365CH", "B365CD", "B365CA"] },
  { slug: "pinnacle", open: ["PSH", "PSD", "PSA"], close: ["PSCH", "PSCD", "PSCA"] },
  { slug: "william-hill", open: ["WHH", "WHD", "WHA"], close: ["WHCH", "WHCD", "WHCA"] },
  { slug: "bet-and-win", open: ["BWH", "BWD", "BWA"], close: ["BWCH", "BWCD", "BWCA"] },
  { slug: "interwetten", open: ["IWH", "IWD", "IWA"], close: ["IWCH", "IWCD", "IWCA"] },
  { slug: "vc-bet", open: ["VCH", "VCD", "VCA"], close: ["VCCH", "VCCD", "VCCA"] },
  { slug: "ladbrokes", open: ["LBH", "LBD", "LBA"], close: ["LBCH", "LBCD", "LBCA"] },
  { slug: "gamebookers", open: ["GBH", "GBD", "GBA"], close: ["GBCH", "GBCD", "GBCA"] },
  { slug: "sportingbet", open: ["SBH", "SBD", "SBA"], close: ["SBCH", "SBCD", "SBCA"] },
  { slug: "stan-james", open: ["SJH", "SJD", "SJA"], close: ["SJCH", "SJCD", "SJCA"] },
  { slug: "blue-square", open: ["BSH", "BSD", "BSA"], close: ["BSCH", "BSCD", "BSCA"] },
  { slug: "1xbet", open: ["1XBH", "1XBD", "1XBA"], close: ["1XBCH", "1XBCD", "1XBCA"] },
  { slug: "betfair", open: ["BFH", "BFD", "BFA"], close: ["BFCH", "BFCD", "BFCA"] },
  { slug: "betfred", open: ["BFDH", "BFDD", "BFDA"], close: ["BFDCH", "BFDCD", "BFDCA"] },
  { slug: "betmgm", open: ["BMGMH", "BMGMD", "BMGMA"], close: ["BMGMCH", "BMGMCD", "BMGMCA"] },
  { slug: "betvictor", open: ["BVH", "BVD", "BVA"], close: ["BVCH", "BVCD", "BVCA"] },
  { slug: "coral", open: ["CLH", "CLD", "CLA"], close: ["CLCH", "CLCD", "CLCA"] },
  { slug: "paddy-power", open: ["PPH", "PPD", "PPA"], close: ["PPCH", "PPCD", "PPCA"] },
  { slug: "skybet", open: ["SKH", "SKD", "SKA"], close: ["SKCH", "SKCD", "SKCA"] },
];

function buildFdcuSpecs(): ColumnSpec[] {
  const specs: ColumnSpec[] = [];
  for (const b of ONE_X_TWO) {
    const sides = ["HOME", "DRAW", "AWAY"] as const;
    sides.forEach((side, i) => {
      specs.push({
        bookmakerId: b.slug,
        marketType: "1X2",
        line: null,
        selectionSide: side,
        column: b.open[i]!,
        kind: "dataset_open",
      });
      specs.push({
        bookmakerId: b.slug,
        marketType: "1X2",
        line: null,
        selectionSide: side,
        column: b.close[i]!,
        kind: "dataset_close",
      });
    });
  }
  const ou: Array<[string, string, string, "OVER" | "UNDER"]> = [
    ["bet365", "B365>2.5", "B365C>2.5", "OVER"],
    ["bet365", "B365<2.5", "B365C<2.5", "UNDER"],
    ["pinnacle", "P>2.5", "PC>2.5", "OVER"],
    ["pinnacle", "P<2.5", "PC<2.5", "UNDER"],
  ];
  for (const [book, open, close, side] of ou) {
    specs.push({
      bookmakerId: book,
      marketType: "OU25",
      line: 2.5,
      selectionSide: side,
      column: open,
      kind: "dataset_open",
    });
    specs.push({
      bookmakerId: book,
      marketType: "OU25",
      line: 2.5,
      selectionSide: side,
      column: close,
      kind: "dataset_close",
    });
  }
  specs.push(
    {
      bookmakerId: "bet365",
      marketType: "AH",
      line: null,
      selectionSide: "HOME",
      column: "B365AHH",
      kind: "dataset_open",
    },
    {
      bookmakerId: "bet365",
      marketType: "AH",
      line: null,
      selectionSide: "AWAY",
      column: "B365AHA",
      kind: "dataset_open",
    },
    {
      bookmakerId: "pinnacle",
      marketType: "AH",
      line: null,
      selectionSide: "HOME",
      column: "PAHH",
      kind: "dataset_open",
    },
    {
      bookmakerId: "pinnacle",
      marketType: "AH",
      line: null,
      selectionSide: "AWAY",
      column: "PAHA",
      kind: "dataset_open",
    },
  );
  return specs;
}

export const FDCU_COLUMN_SPECS: readonly ColumnSpec[] = Object.freeze(buildFdcuSpecs());

const AGGREGATE_BOOKS = new Set([
  "market",
  "betbrain",
  "bb",
  "max",
  "avg",
  "average",
  "best",
]);

const BOOK_SLUG: Record<string, string> = {
  williamhill: "william-hill",
  vcbet: "vc-bet",
  bwin: "bet-and-win",
  onexbet: "1xbet",
  betfair_ex: "betfair-exchange",
  betfair_sb: "betfair-sb",
  sportingodds: "sporting-odds",
  stanleybet: "stanleybet",
  bluesquare: "blue-square",
  stanjames: "stan-james",
};

export function normalizeBookmakerSlug(raw: string): string | null {
  const s = raw.toLowerCase().replace(/-/g, "_");
  if (AGGREGATE_BOOKS.has(s.split("_")[0]!)) return null;
  if (s.startsWith("market_") || s.startsWith("betbrain") || s.startsWith("bb")) {
    return null;
  }
  return BOOK_SLUG[s] ?? s.replace(/_/g, "-");
}

export function isAggregateColumn(label: string): boolean {
  if (isAggregateOddsLabel(label)) return true;
  const s = label.toLowerCase();
  return (
    s.startsWith("market_max") ||
    s.startsWith("market_avg") ||
    s.startsWith("betbrain") ||
    s.startsWith("bbmx") ||
    s.startsWith("bbav") ||
    s === "bb1x2" ||
    s === "bbou" ||
    s === "bbah" ||
    s === "bbahh" ||
    s.startsWith("bbahh") ||
    s === "maxh" ||
    s === "maxd" ||
    s === "maxa"
  );
}

const ANISH_META = new Set([
  "match_id",
  "season",
  "season_code",
  "date",
  "home_team",
  "away_team",
  "fthg",
  "ftag",
  "ftr",
  "hthg",
  "htag",
  "htr",
  "referee",
  "ah_line",
  "ah_line_close",
  "ah_line_betbrain",
]);

export function classifyAnishColumn(column: string): ColumnSpec | "meta" | "aggregate" | null {
  if (ANISH_META.has(column)) return "meta";
  if (isAggregateColumn(column)) return "aggregate";
  const close = column.endsWith("_close");
  const base = close ? column.slice(0, -6) : column;
  const kind = close ? "dataset_close" : "dataset_open";
  let m = base.match(/^([a-z0-9_]+)_1x2_(home|draw|away)$/);
  if (m) {
    const book = normalizeBookmakerSlug(m[1]!);
    if (!book) return "aggregate";
    return {
      bookmakerId: book,
      marketType: "1X2",
      line: null,
      selectionSide: m[2]!.toUpperCase(),
      column,
      kind,
    };
  }
  m = base.match(/^([a-z0-9_]+)_(over25|under25)$/);
  if (m) {
    const book = normalizeBookmakerSlug(m[1]!);
    if (!book) return "aggregate";
    return {
      bookmakerId: book,
      marketType: "OU25",
      line: 2.5,
      selectionSide: m[2] === "over25" ? "OVER" : "UNDER",
      column,
      kind,
    };
  }
  m = base.match(/^([a-z0-9_]+)_ah_(home|away)$/);
  if (m) {
    const book = normalizeBookmakerSlug(m[1]!);
    if (!book) return "aggregate";
    return {
      bookmakerId: book,
      marketType: "AH",
      line: null,
      selectionSide: m[2]!.toUpperCase(),
      column,
      kind,
    };
  }
  return null;
}

export const CATALOGUED_MARKETS = [
  "1X2",
  "DC",
  "DNB",
  "AH",
  "EH",
  "OU05",
  "OU15",
  "OU25",
  "OU35",
  "OU45",
  "TEAM_GOALS",
  "BTTS",
  "HT_1X2",
  "HT_OU",
  "CORNERS",
  "CARDS",
  "CS",
  "FIRST_GOAL",
  "PLAYER_GOALS",
  "PLAYER_SHOTS",
  "PLAYER_CARDS",
] as const;
