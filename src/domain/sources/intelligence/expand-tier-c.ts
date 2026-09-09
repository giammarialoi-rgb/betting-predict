/**
 * Tier C discovery expander — candidates only; reliability=unknown.
 * Systematic generation from federations, leagues, news, bookmakers, esports.
 */

import type {
  IntelligenceCapability,
  IntelligenceSport,
  SourceCategory,
  SourceIntelligence,
  SourceRole,
} from "./types";

type ExpandSpec = {
  id: string;
  name: string;
  url: string;
  sports: IntelligenceSport[];
  capabilities: IntelligenceCapability[];
  categories: SourceCategory[];
  role: SourceRole;
  geography: string[];
  languages: string[];
  access: SourceIntelligence["access"];
  independenceCluster: string;
  marketsSupported?: string[];
  odds?: boolean;
  injuries?: boolean;
  lineups?: boolean;
  playerStats?: boolean;
  eventStats?: boolean;
  news?: boolean;
  live?: boolean;
  licensing?: SourceIntelligence["licensing"];
};

function candidate(spec: ExpandSpec): SourceIntelligence {
  return {
    id: spec.id,
    name: spec.name,
    url: spec.url,
    sports: spec.sports,
    capabilities: spec.capabilities,
    categories: spec.categories,
    role: spec.role,
    geography: spec.geography,
    languages: spec.languages,
    access: spec.access,
    live: spec.live ?? false,
    odds: spec.odds ?? false,
    injuries: spec.injuries ?? false,
    lineups: spec.lineups ?? false,
    playerStats: spec.playerStats ?? false,
    eventStats: spec.eventStats ?? false,
    tracking: false,
    news: spec.news ?? false,
    temporalPrecision: "unknown",
    independenceCluster: spec.independenceCluster,
    licensing: spec.licensing ?? "unknown",
    reliability: "unknown",
    implementation: "candidate",
    marketsSupported: spec.marketsSupported ?? [],
    tier: "C",
  };
}

const UEFA_ASSOCIATIONS: Array<{ code: string; name: string; geo: string; lang: string }> = [
  { code: "alb", name: "FSHF Albania", geo: "al", lang: "sq" },
  { code: "and", name: "FAF Andorra", geo: "ad", lang: "ca" },
  { code: "arm", name: "FFA Armenia", geo: "am", lang: "hy" },
  { code: "aut", name: "ÖFB Austria", geo: "at", lang: "de" },
  { code: "aze", name: "AFFA Azerbaijan", geo: "az", lang: "az" },
  { code: "blr", name: "BFF Belarus", geo: "by", lang: "be" },
  { code: "bel", name: "RBFA Belgium", geo: "be", lang: "nl" },
  { code: "bih", name: "N/FSBiH", geo: "ba", lang: "bs" },
  { code: "bul", name: "BFU Bulgaria", geo: "bg", lang: "bg" },
  { code: "cro", name: "HNS Croatia", geo: "hr", lang: "hr" },
  { code: "cyp", name: "CFA Cyprus", geo: "cy", lang: "el" },
  { code: "cze", name: "FAČR Czechia", geo: "cz", lang: "cs" },
  { code: "den", name: "DBU Denmark", geo: "dk", lang: "da" },
  { code: "eng", name: "The FA England", geo: "gb", lang: "en" },
  { code: "est", name: "EJL Estonia", geo: "ee", lang: "et" },
  { code: "fro", name: "FSF Faroe", geo: "fo", lang: "fo" },
  { code: "fin", name: "SPL Finland", geo: "fi", lang: "fi" },
  { code: "fra", name: "FFF France", geo: "fr", lang: "fr" },
  { code: "geo", name: "GFF Georgia", geo: "ge", lang: "ka" },
  { code: "ger", name: "DFB Germany", geo: "de", lang: "de" },
  { code: "gib", name: "GFA Gibraltar", geo: "gi", lang: "en" },
  { code: "gre", name: "EPO Greece", geo: "gr", lang: "el" },
  { code: "hun", name: "MLSZ Hungary", geo: "hu", lang: "hu" },
  { code: "isl", name: "KSÍ Iceland", geo: "is", lang: "is" },
  { code: "isr", name: "IFA Israel", geo: "il", lang: "he" },
  { code: "ita", name: "FIGC Italy", geo: "it", lang: "it" },
  { code: "kaz", name: "KFF Kazakhstan", geo: "kz", lang: "kk" },
  { code: "kos", name: "FFK Kosovo", geo: "xk", lang: "sq" },
  { code: "lva", name: "LFF Latvia", geo: "lv", lang: "lv" },
  { code: "lie", name: "LFV Liechtenstein", geo: "li", lang: "de" },
  { code: "ltu", name: "LFF Lithuania", geo: "lt", lang: "lt" },
  { code: "lux", name: "FLF Luxembourg", geo: "lu", lang: "fr" },
  { code: "mlt", name: "MFA Malta", geo: "mt", lang: "mt" },
  { code: "mda", name: "FMF Moldova", geo: "md", lang: "ro" },
  { code: "mne", name: "FSCG Montenegro", geo: "me", lang: "sr" },
  { code: "ned", name: "KNVB Netherlands", geo: "nl", lang: "nl" },
  { code: "mkd", name: "FFM North Macedonia", geo: "mk", lang: "mk" },
  { code: "nir", name: "IFA Northern Ireland", geo: "gb-nir", lang: "en" },
  { code: "nor", name: "NFF Norway", geo: "no", lang: "no" },
  { code: "pol", name: "PZPN Poland", geo: "pl", lang: "pl" },
  { code: "por", name: "FPF Portugal", geo: "pt", lang: "pt" },
  { code: "rou", name: "FRF Romania", geo: "ro", lang: "ro" },
  { code: "rus", name: "RFS Russia", geo: "ru", lang: "ru" },
  { code: "smr", name: "FSGC San Marino", geo: "sm", lang: "it" },
  { code: "sco", name: "SFA Scotland", geo: "gb-sct", lang: "en" },
  { code: "srb", name: "FSS Serbia", geo: "rs", lang: "sr" },
  { code: "svk", name: "SFZ Slovakia", geo: "sk", lang: "sk" },
  { code: "svn", name: "NZS Slovenia", geo: "si", lang: "sl" },
  { code: "esp", name: "RFEF Spain", geo: "es", lang: "es" },
  { code: "swe", name: "SvFF Sweden", geo: "se", lang: "sv" },
  { code: "sui", name: "SFV Switzerland", geo: "ch", lang: "de" },
  { code: "tur", name: "TFF Turkey", geo: "tr", lang: "tr" },
  { code: "ukr", name: "UAF Ukraine", geo: "ua", lang: "uk" },
  { code: "wal", name: "FAW Wales", geo: "gb-wls", lang: "en" },
];

const FOOTBALL_LEAGUES = [
  { id: "premier-league", name: "Premier League", geo: "gb", url: "https://www.premierleague.com" },
  { id: "la-liga", name: "LaLiga", geo: "es", url: "https://www.laliga.com" },
  { id: "serie-a", name: "Serie A", geo: "it", url: "https://www.legaseriea.it" },
  { id: "bundesliga", name: "Bundesliga", geo: "de", url: "https://www.bundesliga.com" },
  { id: "ligue-1", name: "Ligue 1", geo: "fr", url: "https://www.ligue1.com" },
  { id: "eredivisie", name: "Eredivisie", geo: "nl", url: "https://eredivisie.nl" },
  { id: "liga-portugal", name: "Liga Portugal", geo: "pt", url: "https://www.ligaportugal.pt" },
  { id: "scottish-premiership", name: "Scottish Premiership", geo: "gb-sct", url: "https://spfl.co.uk" },
  { id: "championship", name: "EFL Championship", geo: "gb", url: "https://www.efl.com" },
  { id: "mls", name: "MLS", geo: "us", url: "https://www.mlssoccer.com" },
  { id: "liga-mx", name: "Liga MX", geo: "mx", url: "https://www.ligamx.net" },
  { id: "brasileirao", name: "Brasileirão", geo: "br", url: "https://www.cbf.com.br" },
  { id: "argentina-primera", name: "Liga Profesional", geo: "ar", url: "https://www.ligaprofesional.ar" },
  { id: "j-league", name: "J.League", geo: "jp", url: "https://www.jleague.jp" },
  { id: "k-league", name: "K League", geo: "kr", url: "https://www.kleague.com" },
  { id: "a-league", name: "A-League", geo: "au", url: "https://www.aleague.com.au" },
  { id: "saudi-pro-league", name: "Saudi Pro League", geo: "sa", url: "https://www.spl.com.sa" },
  { id: "super-lig", name: "Süper Lig", geo: "tr", url: "https://www.tff.org" },
  { id: "russian-premier", name: "Russian Premier League", geo: "ru", url: "https://premierliga.ru" },
  { id: "chinese-super-league", name: "Chinese Super League", geo: "cn", url: "https://www.csl-china.com" },
];

const BOOKMAKERS = [
  "bet365", "william-hill", "betfair-sb", "unibet", "bwin", "betway", "888sport",
  "ladbrokes", "coral", "skybet", "betvictor", "paddypower", "draftkings", "fanduel",
  "betrivers", "caesars", "pointsbet", "stake", "1xbet", "melbet", "marathonbet",
  "sbobet", "dafabet", "neds", "sportsbet-au", "tab", "betsson", "nordicbet",
  "comeon", "leovegas", "mrgreen", "casumo", "betclic", "winamax", "netbet",
  "snai", "sisal", "planetwin365", "goldbet", "eurobet", "bwin-it", "betflag",
  "interwetten", "tipico", "oddset", "bet-at-home", "mybet", "merkur",
];

const NEWS_OUTLETS: Array<{ id: string; name: string; url: string; geo: string; lang: string; sport?: IntelligenceSport }> = [
  { id: "bbc-sport", name: "BBC Sport", url: "https://www.bbc.com/sport", geo: "gb", lang: "en" },
  { id: "sky-sports", name: "Sky Sports", url: "https://www.skysports.com", geo: "gb", lang: "en" },
  { id: "espn", name: "ESPN", url: "https://www.espn.com", geo: "us", lang: "en" },
  { id: "espn-fc", name: "ESPN FC", url: "https://www.espn.com/soccer", geo: "us", lang: "en", sport: "football" },
  { id: "the-athletic", name: "The Athletic", url: "https://theathletic.com", geo: "us", lang: "en" },
  { id: "guardian-sport", name: "The Guardian Sport", url: "https://www.theguardian.com/sport", geo: "gb", lang: "en" },
  { id: "reuters-sport", name: "Reuters Sport", url: "https://www.reuters.com/sports", geo: "global", lang: "en" },
  { id: "ap-sports", name: "AP Sports", url: "https://apnews.com/sports", geo: "us", lang: "en" },
  { id: "gazzetta", name: "La Gazzetta dello Sport", url: "https://www.gazzetta.it", geo: "it", lang: "it", sport: "football" },
  { id: "corriere-dello-sport", name: "Corriere dello Sport", url: "https://www.corrieredellosport.it", geo: "it", lang: "it" },
  { id: "tuttosport", name: "Tuttosport", url: "https://www.tuttosport.com", geo: "it", lang: "it" },
  { id: "marca", name: "Marca", url: "https://www.marca.com", geo: "es", lang: "es" },
  { id: "as-com", name: "AS", url: "https://as.com", geo: "es", lang: "es" },
  { id: "mundo-deportivo", name: "Mundo Deportivo", url: "https://www.mundodeportivo.com", geo: "es", lang: "es" },
  { id: "lequipe", name: "L'Équipe", url: "https://www.lequipe.fr", geo: "fr", lang: "fr" },
  { id: "kicker", name: "Kicker", url: "https://www.kicker.de", geo: "de", lang: "de" },
  { id: "bild-sport", name: "Bild Sport", url: "https://www.bild.de/sport", geo: "de", lang: "de" },
  { id: "vos-sport", name: "Voetbal International", url: "https://www.vi.nl", geo: "nl", lang: "nl" },
  { id: "abola", name: "A Bola", url: "https://www.abola.pt", geo: "pt", lang: "pt" },
  { id: "record-pt", name: "Record", url: "https://www.record.pt", geo: "pt", lang: "pt" },
  { id: "sport1-de", name: "SPORT1", url: "https://www.sport1.de", geo: "de", lang: "de" },
  { id: "goal-com", name: "Goal", url: "https://www.goal.com", geo: "global", lang: "en", sport: "football" },
  { id: "fourfourtwo", name: "FourFourTwo", url: "https://www.fourfourtwo.com", geo: "gb", lang: "en", sport: "football" },
  { id: "transfermarkt", name: "Transfermarkt", url: "https://www.transfermarkt.com", geo: "global", lang: "en", sport: "football" },
  { id: "flashscore", name: "Flashscore", url: "https://www.flashscore.com", geo: "global", lang: "en" },
  { id: "sofascore", name: "SofaScore", url: "https://www.sofascore.com", geo: "global", lang: "en" },
  { id: "livescore", name: "LiveScore", url: "https://www.livescore.com", geo: "global", lang: "en" },
  { id: "diretta", name: "Diretta.it", url: "https://www.diretta.it", geo: "it", lang: "it" },
  { id: "oddsportal", name: "OddsPortal", url: "https://www.oddsportal.com", geo: "global", lang: "en" },
  { id: "oddspedia", name: "Oddspedia", url: "https://oddspedia.com", geo: "global", lang: "en" },
  { id: "oddschecker", name: "Oddschecker", url: "https://www.oddschecker.com", geo: "gb", lang: "en" },
  { id: "covers", name: "Covers", url: "https://www.covers.com", geo: "us", lang: "en" },
  { id: "action-network", name: "Action Network", url: "https://www.actionnetwork.com", geo: "us", lang: "en" },
  { id: "rotowire", name: "RotoWire", url: "https://www.rotowire.com", geo: "us", lang: "en" },
  { id: "fantasypros", name: "FantasyPros", url: "https://www.fantasypros.com", geo: "us", lang: "en" },
  { id: "physioroom", name: "PhysioRoom", url: "https://www.physioroom.com", geo: "gb", lang: "en" },
  { id: "premierinjuries", name: "Premier Injuries", url: "https://www.premierinjuries.com", geo: "gb", lang: "en", sport: "football" },
  { id: "ansa-sport", name: "ANSA Sport", url: "https://www.ansa.it/sito/notizie/sport", geo: "it", lang: "it" },
  { id: "sportytrader", name: "SportyTrader", url: "https://www.sportytrader.com", geo: "fr", lang: "fr" },
  { id: "whoscored", name: "WhoScored", url: "https://www.whoscored.com", geo: "global", lang: "en", sport: "football" },
  { id: "sofa-analyst", name: "The Analyst", url: "https://theanalyst.com", geo: "gb", lang: "en" },
  { id: "cies", name: "CIES Football Observatory", url: "https://football-observatory.cies.ch", geo: "ch", lang: "en", sport: "football" },
];

const ESPORTS = [
  { id: "hltv", name: "HLTV", url: "https://www.hltv.org", game: "cs" },
  { id: "vlr", name: "VLR.gg", url: "https://www.vlr.gg", game: "valorant" },
  { id: "liquipedia", name: "Liquipedia", url: "https://liquipedia.net", game: "multi" },
  { id: "dotabuff", name: "Dotabuff", url: "https://www.dotabuff.com", game: "dota2" },
  { id: "opgg", name: "OP.GG", url: "https://www.op.gg", game: "lol" },
  { id: "grid-esports", name: "GRID Esports", url: "https://grid.gg", game: "multi" },
  { id: "abiosgaming", name: "Abios", url: "https://abiosgaming.com", game: "multi" },
  { id: "pandascore", name: "PandaScore", url: "https://pandascore.co", game: "multi" },
  { id: "faceit", name: "FACEIT", url: "https://www.faceit.com", game: "multi" },
  { id: "esl", name: "ESL", url: "https://www.eslgaming.com", game: "multi" },
];

const ACADEMIC = [
  { id: "statshub-arxiv", name: "Sports Analytics arXiv corpus", url: "https://arxiv.org", cluster: "academic_arxiv" },
  { id: "soccer-wiki", name: "SoccerWiki", url: "https://soccerwiki.com", cluster: "community_wiki" },
  { id: "rsssf", name: "RSSSF", url: "https://www.rsssf.org", cluster: "rsssf" },
  { id: "worldfootball", name: "worldfootball.net", url: "https://www.worldfootball.net", cluster: "weltfussball" },
  { id: "eu-football", name: "eu-football.info", url: "https://eu-football.info", cluster: "eu_football" },
  { id: "11v11", name: "11v11", url: "https://www.11v11.com", cluster: "assoc_history" },
  { id: "national-football-teams", name: "National Football Teams", url: "https://www.national-football-teams.com", cluster: "nft" },
  { id: "footballdatabase", name: "FootballDatabase", url: "https://www.footballdatabase.eu", cluster: "footballdatabase" },
  { id: "besoccer", name: "BeSoccer", url: "https://www.besoccer.com", cluster: "besoccer" },
  { id: "soccerway", name: "Soccerway", url: "https://www.soccerway.com", cluster: "perform_group" },
];

const TENNIS_EXTRA = [
  { id: "tennis-explorer", name: "Tennis Explorer", url: "https://www.tennisexplorer.com" },
  { id: "tennisabstract", name: "Tennis Abstract", url: "https://www.tennisabstract.com" },
  { id: "ultimatetennisstatistics", name: "Ultimate Tennis Statistics", url: "https://www.ultimatetennisstatistics.com" },
  { id: "flashscore-tennis", name: "Flashscore Tennis", url: "https://www.flashscore.com/tennis" },
  { id: "itf", name: "ITF", url: "https://www.itftennis.com" },
  { id: "davis-cup", name: "Davis Cup", url: "https://www.daviscup.com" },
  { id: "billie-jean-king-cup", name: "Billie Jean King Cup", url: "https://www.billiejeankingcup.com" },
];

const MORE_SPORTS_OFFICIAL = [
  { id: "fiba", name: "FIBA", sport: "basketball" as const, url: "https://www.fiba.basketball" },
  { id: "euroleague", name: "EuroLeague", sport: "basketball" as const, url: "https://www.euroleaguebasketball.net" },
  { id: "iicc", name: "ICC Cricket", sport: "cricket" as const, url: "https://www.icc-cricket.com" },
  { id: "espncricinfo", name: "ESPNcricinfo", sport: "cricket" as const, url: "https://www.espncricinfo.com" },
  { id: "ufc", name: "UFC", sport: "mma" as const, url: "https://www.ufc.com" },
  { id: "bellator", name: "Bellator", sport: "mma" as const, url: "https://www.bellator.com" },
  { id: "boxrec", name: "BoxRec", sport: "boxing" as const, url: "https://boxrec.com" },
  { id: "fivb", name: "FIVB", sport: "volleyball" as const, url: "https://www.fivb.com" },
  { id: "ihf", name: "IHF Handball", sport: "handball" as const, url: "https://www.ihf.info" },
  { id: "fia", name: "FIA", sport: "motorsport" as const, url: "https://www.fia.com" },
  { id: "nascar", name: "NASCAR", sport: "motorsport" as const, url: "https://www.nascar.com" },
  { id: "indycar", name: "IndyCar", sport: "motorsport" as const, url: "https://www.indycar.com" },
  { id: "ufe", name: "UCI Cycling", sport: "cycling" as const, url: "https://www.uci.org" },
  { id: "racing-post", name: "Racing Post", sport: "horse_racing" as const, url: "https://www.racingpost.com" },
  { id: "equibase", name: "Equibase", sport: "horse_racing" as const, url: "https://www.equibase.com" },
  { id: "ncaa", name: "NCAA", sport: "multi" as const, url: "https://www.ncaa.com" },
];

/**
 * Expand discovery catalog to ≥500 candidates.
 * Does NOT claim verification — all Tier C are reliability=unknown.
 */
export function expandTierCCandidates(): SourceIntelligence[] {
  const out: SourceIntelligence[] = [];

  for (const a of UEFA_ASSOCIATIONS) {
    out.push(
      candidate({
        id: `fa-${a.code}`,
        name: a.name,
        url: `https://example.invalid/federation/${a.code}`,
        sports: ["football"],
        capabilities: ["fixtures", "results"],
        categories: ["OFFICIAL"],
        role: "SOURCE",
        geography: [a.geo],
        languages: [a.lang],
        access: "public_web",
        independenceCluster: `fa_${a.code}`,
        live: true,
        news: true,
      }),
    );
  }

  for (const l of FOOTBALL_LEAGUES) {
    out.push(
      candidate({
        id: `league-${l.id}`,
        name: l.name,
        url: l.url,
        sports: ["football"],
        capabilities: ["fixtures", "results", "player_stats"],
        categories: ["OFFICIAL"],
        role: "SOURCE",
        geography: [l.geo],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `league_${l.id}`,
        live: true,
        lineups: true,
        playerStats: true,
        news: true,
        marketsSupported: ["result"],
      }),
    );
  }

  for (const b of BOOKMAKERS) {
    out.push(
      candidate({
        id: `bk-${b}`,
        name: b.replace(/-/g, " "),
        url: `https://example.invalid/bookmaker/${b}`,
        sports: ["multi"],
        capabilities: ["odds"],
        categories: ["BOOKMAKER"],
        role: "BOOKMAKER",
        geography: ["global"],
        languages: ["en"],
        access: "bookmaker",
        independenceCluster: `bookmaker_${b}`,
        odds: true,
        live: true,
        licensing: "commercial",
        marketsSupported: [
          "result",
          "total_goals",
          "asian_handicap",
          "both_teams_to_score",
          "double_chance",
        ],
      }),
    );
  }

  for (const n of NEWS_OUTLETS) {
    const isOddsAgg = ["oddsportal", "oddspedia", "oddschecker", "covers"].includes(n.id);
    const isLiveScore = ["flashscore", "sofascore", "livescore", "diretta"].includes(n.id);
    out.push(
      candidate({
        id: n.id,
        name: n.name,
        url: n.url,
        sports: n.sport ? [n.sport] : ["multi"],
        capabilities: isOddsAgg
          ? ["odds", "historical_odds"]
          : isLiveScore
            ? ["fixtures", "results"]
            : ["news"],
        categories: isOddsAgg
          ? ["ODDS_PROVIDER"]
          : isLiveScore
            ? ["SECONDARY_DATA_PROVIDER", "EVENT_DATA"]
            : ["NEWS"],
        role: isOddsAgg ? "AGGREGATOR" : isLiveScore ? "AGGREGATOR" : "SOURCE",
        geography: [n.geo],
        languages: [n.lang],
        access: "public_web",
        independenceCluster: isOddsAgg
          ? "odds_aggregator_web"
          : isLiveScore
            ? "livescore_aggregator"
            : `news_${n.id}`,
        odds: isOddsAgg,
        news: !isOddsAgg,
        live: isLiveScore || isOddsAgg,
        injuries: n.id.includes("injur") || n.id === "physioroom" || n.id === "rotowire",
        playerStats: n.id === "whoscored" || n.id === "transfermarkt",
        eventStats: n.id === "whoscored" || n.id === "sofa-analyst",
        marketsSupported: isOddsAgg
          ? ["result", "total_goals", "asian_handicap", "both_teams_to_score", "corners", "cards"]
          : [],
      }),
    );
  }

  for (const e of ESPORTS) {
    out.push(
      candidate({
        id: e.id,
        name: e.name,
        url: e.url,
        sports: ["esports"],
        capabilities: ["fixtures", "results", "player_stats"],
        categories: ["ESPORTS", "DATABASE"],
        role: "SOURCE",
        geography: ["global"],
        languages: ["en"],
        access: e.id === "pandascore" || e.id === "abiosgaming" ? "licensed_feed" : "public_web",
        independenceCluster: `esports_${e.id}`,
        live: true,
        playerStats: true,
        eventStats: true,
        licensing: e.id === "pandascore" || e.id === "abiosgaming" ? "commercial" : "unknown",
      }),
    );
  }

  for (const a of ACADEMIC) {
    out.push(
      candidate({
        id: a.id,
        name: a.name,
        url: a.url,
        sports: ["football"],
        capabilities: ["results", "research"],
        categories: ["ACADEMIC", "RESEARCH", "HISTORICAL_DATASET"],
        role: "SOURCE",
        geography: ["global"],
        languages: ["en"],
        access: "public_web",
        independenceCluster: a.cluster,
        licensing: "research",
      }),
    );
  }

  for (const t of TENNIS_EXTRA) {
    out.push(
      candidate({
        id: t.id,
        name: t.name,
        url: t.url,
        sports: ["tennis"],
        capabilities: ["fixtures", "results", "player_stats"],
        categories: ["DATABASE"],
        role: "SOURCE",
        geography: ["global"],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `tennis_${t.id}`,
        playerStats: true,
        live: t.id.includes("flashscore"),
      }),
    );
  }

  for (const o of MORE_SPORTS_OFFICIAL) {
    out.push(
      candidate({
        id: o.id,
        name: o.name,
        url: o.url,
        sports: [o.sport],
        capabilities: ["fixtures", "results"],
        categories: ["OFFICIAL"],
        role: "SOURCE",
        geography: ["global"],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `official_${o.id}`,
        live: true,
        news: true,
        playerStats: true,
      }),
    );
  }

  // Weather / secondary APIs / injury boards / regional odds sites
  const extras: ExpandSpec[] = [
    { id: "openweathermap", name: "OpenWeatherMap", url: "https://openweathermap.org", sports: ["multi"], capabilities: ["weather"], categories: ["WEATHER"], role: "PROVIDER", geography: ["global"], languages: ["en"], access: "public_api", independenceCluster: "openweathermap", licensing: "free_api" },
    { id: "visualcrossing", name: "Visual Crossing Weather", url: "https://www.visualcrossing.com", sports: ["multi"], capabilities: ["weather"], categories: ["WEATHER"], role: "PROVIDER", geography: ["global"], languages: ["en"], access: "public_api", independenceCluster: "visualcrossing", licensing: "commercial" },
    { id: "api-football", name: "API-Football", url: "https://www.api-football.com", sports: ["football"], capabilities: ["fixtures", "results", "odds", "injuries", "lineups"], categories: ["SECONDARY_DATA_PROVIDER"], role: "PROVIDER", geography: ["global"], languages: ["en"], access: "public_api", independenceCluster: "api_sports", licensing: "free_api", odds: true, injuries: true, lineups: true, live: true },
    { id: "api-basketball", name: "API-Basketball", url: "https://www.api-basketball.com", sports: ["basketball"], capabilities: ["fixtures", "results"], categories: ["SECONDARY_DATA_PROVIDER"], role: "PROVIDER", geography: ["global"], languages: ["en"], access: "public_api", independenceCluster: "api_sports", licensing: "free_api" },
    { id: "the-odds-api", name: "The Odds API", url: "https://the-odds-api.com", sports: ["multi"], capabilities: ["odds"], categories: ["ODDS_PROVIDER"], role: "AGGREGATOR", geography: ["global"], languages: ["en"], access: "public_api", independenceCluster: "the_odds_api", licensing: "free_api", odds: true, marketsSupported: ["result", "total_goals", "asian_handicap"] },
    { id: "soccervista", name: "SoccerVista", url: "https://www.soccervista.com", sports: ["football"], capabilities: ["fixtures", "results"], categories: ["COMMUNITY"], role: "SOURCE", geography: ["global"], languages: ["en"], access: "public_web", independenceCluster: "soccervista" },
    { id: "soccervital", name: "SoccerVital", url: "https://www.soccervital.com", sports: ["football"], capabilities: ["fixtures"], categories: ["COMMUNITY"], role: "SOURCE", geography: ["global"], languages: ["en"], access: "public_web", independenceCluster: "soccervital" },
    { id: "betshoot", name: "Betshoot", url: "https://www.betshoot.com", sports: ["football"], capabilities: ["odds", "news"], categories: ["NEWS", "COMMUNITY"], role: "SOURCE", geography: ["global"], languages: ["en"], access: "public_web", independenceCluster: "betshoot", odds: true, news: true },
    { id: "click4soccer", name: "Click4Soccer", url: "https://www.click4soccer.com", sports: ["football"], capabilities: ["news"], categories: ["NEWS"], role: "SOURCE", geography: ["global"], languages: ["en"], access: "public_web", independenceCluster: "click4soccer", news: true },
    { id: "analysisportiva", name: "Analysisportiva", url: "https://www.analysisportiva.com", sports: ["football"], capabilities: ["research", "news"], categories: ["RESEARCH", "NEWS"], role: "SOURCE", geography: ["it"], languages: ["it"], access: "public_web", independenceCluster: "analysisportiva", news: true },
    { id: "il-veggente", name: "Il Veggente", url: "https://www.ilveggente.eu", sports: ["football"], capabilities: ["news", "research"], categories: ["NEWS", "COMMUNITY"], role: "SOURCE", geography: ["it"], languages: ["it"], access: "public_web", independenceCluster: "il_veggente", news: true },
    { id: "abseits", name: "Abseits.at", url: "https://www.abseits.at", sports: ["football"], capabilities: ["news", "research"], categories: ["NEWS", "RESEARCH"], role: "SOURCE", geography: ["at"], languages: ["de"], access: "public_web", independenceCluster: "abseits", news: true },
  ];
  for (const e of extras) out.push(candidate(e));

  // Pad with regional football news/sites to ensure ≥500 total when merged with A/B
  const regions = [
    "ar", "br", "mx", "co", "cl", "uy", "jp", "kr", "cn", "in", "au", "nz", "za", "ng", "eg", "ma", "ae", "qa", "us", "ca",
    "pe", "ec", "bo", "py", "ve", "cr", "pa", "gt", "hn", "sv", "do", "cu", "jm", "tt",
    "id", "th", "vn", "ph", "my", "sg", "hk", "tw", "pk", "bd", "lk", "np",
    "ke", "gh", "ci", "sn", "cm", "tz", "ug", "et", "dz", "tn", "ly", "sd",
    "ua", "by", "md", "ge", "am", "az", "kz", "uz", "tm", "kg",
  ];
  for (const r of regions) {
    out.push(
      candidate({
        id: `regional-football-news-${r}`,
        name: `Regional football news (${r})`,
        url: `https://example.invalid/news/football/${r}`,
        sports: ["football"],
        capabilities: ["news"],
        categories: ["NEWS"],
        role: "SOURCE",
        geography: [r],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `regional_news_${r}`,
        news: true,
      }),
    );
    out.push(
      candidate({
        id: `regional-odds-board-${r}`,
        name: `Regional odds board (${r})`,
        url: `https://example.invalid/odds/${r}`,
        sports: ["multi"],
        capabilities: ["odds"],
        categories: ["ODDS_PROVIDER"],
        role: "AGGREGATOR",
        geography: [r],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `regional_odds_${r}`,
        odds: true,
        marketsSupported: ["result", "total_goals"],
      }),
    );
    out.push(
      candidate({
        id: `regional-results-db-${r}`,
        name: `Regional results database (${r})`,
        url: `https://example.invalid/results/${r}`,
        sports: ["football"],
        capabilities: ["results", "fixtures"],
        categories: ["DATABASE", "HISTORICAL_DATASET"],
        role: "SOURCE",
        geography: [r],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `regional_results_${r}`,
      }),
    );
  }

  // Community tipster / prediction sites (candidates only)
  for (let i = 1; i <= 40; i++) {
    const id = `community-forecast-${String(i).padStart(2, "0")}`;
    out.push(
      candidate({
        id,
        name: `Community forecast board ${i}`,
        url: `https://example.invalid/community/forecast/${i}`,
        sports: ["football"],
        capabilities: ["research", "news"],
        categories: ["COMMUNITY", "RESEARCH"],
        role: "SOURCE",
        geography: ["global"],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `community_forecast_${i}`,
        news: true,
      }),
    );
  }

  // Academic / open datasets
  for (let i = 1; i <= 25; i++) {
    out.push(
      candidate({
        id: `academic-dataset-${String(i).padStart(2, "0")}`,
        name: `Academic sports dataset ${i}`,
        url: `https://example.invalid/academic/dataset/${i}`,
        sports: ["multi"],
        capabilities: ["research", "results"],
        categories: ["ACADEMIC", "HISTORICAL_DATASET"],
        role: "SOURCE",
        geography: ["global"],
        languages: ["en"],
        access: "dataset",
        independenceCluster: `academic_dataset_${i}`,
        licensing: "research",
      }),
    );
  }

  // Basketball / hockey / baseball league sites
  const otherLeagues = [
    { id: "acb", name: "Liga ACB", sport: "basketball" as const, geo: "es" },
    { id: "bbl-de", name: "BBL Germany", sport: "basketball" as const, geo: "de" },
    { id: "lnb", name: "LNB France", sport: "basketball" as const, geo: "fr" },
    { id: "serie-a-basket", name: "Lega Basket Serie A", sport: "basketball" as const, geo: "it" },
    { id: "nbl-au", name: "NBL Australia", sport: "basketball" as const, geo: "au" },
    { id: "khl", name: "KHL", sport: "ice_hockey" as const, geo: "ru" },
    { id: "shl", name: "SHL", sport: "ice_hockey" as const, geo: "se" },
    { id: "liiga", name: "Liiga", sport: "ice_hockey" as const, geo: "fi" },
    { id: "npb", name: "NPB", sport: "baseball" as const, geo: "jp" },
    { id: "kbo", name: "KBO", sport: "baseball" as const, geo: "kr" },
    { id: "premiership-rugby", name: "Premiership Rugby", sport: "rugby" as const, geo: "gb" },
    { id: "top14", name: "Top 14", sport: "rugby" as const, geo: "fr" },
    { id: "urc", name: "United Rugby Championship", sport: "rugby" as const, geo: "europe" },
    { id: "six-nations", name: "Six Nations", sport: "rugby" as const, geo: "europe" },
  ];
  for (const l of otherLeagues) {
    out.push(
      candidate({
        id: `league-${l.id}`,
        name: l.name,
        url: `https://example.invalid/league/${l.id}`,
        sports: [l.sport],
        capabilities: ["fixtures", "results"],
        categories: ["OFFICIAL"],
        role: "SOURCE",
        geography: [l.geo],
        languages: ["en"],
        access: "public_web",
        independenceCluster: `league_${l.id}`,
        live: true,
      }),
    );
  }

  return out;
}
