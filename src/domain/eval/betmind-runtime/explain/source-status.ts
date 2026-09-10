/**
 * Human source-status taxonomy. Engineering phases stay in research-status.jsonl.
 * SUCCESS means data was retrieved and parsed — never "adapter was called".
 */

export type HumanSourceStatus =
  | "SUCCESS"
  | "PARTIAL"
  | "NO_DATA"
  | "HTTP_ERROR"
  | "BLOCKED"
  | "MISSING_ADAPTER"
  | "DISABLED_BY_POLICY"
  | "STALE"
  | "PARSE_ERROR"
  | "RATE_LIMITED";

export type ResearchLike = {
  source_id: string;
  ok?: boolean;
  fetched?: boolean;
  phase?: string;
  http_status?: number | null;
  parser_status?: string | null;
  fields_extracted?: string[] | null;
  adapter_kind?: string | null;
  reason?: string | null;
};

export function classifyHumanSourceStatus(row: ResearchLike): HumanSourceStatus {
  const phase = String(row.phase ?? "").toUpperCase();
  const adapter = String(row.adapter_kind ?? "").toUpperCase();
  const parser = String(row.parser_status ?? "").toUpperCase();
  const reason = String(row.reason ?? "").toUpperCase();
  const http = row.http_status ?? null;
  const fields = row.fields_extracted ?? [];

  if (phase === "MISSING_ADAPTER" || adapter === "MISSING_ADAPTER") return "MISSING_ADAPTER";
  if (phase === "DENIED" || adapter === "POLICY_DENIED" || reason.includes("DISABLED_BY_POLICY")) {
    return "DISABLED_BY_POLICY";
  }
  if (http === 429 || reason.includes("429") || reason.includes("RATE_LIMIT")) return "RATE_LIMITED";
  if (http === 403 || phase === "BLOCKED" || reason.includes("HTTP_403")) return "BLOCKED";
  if (parser === "ERROR" || parser === "PARSE_ERROR" || parser === "INVALID") return "PARSE_ERROR";
  if (http != null && http >= 400) return "HTTP_ERROR";
  if (phase === "UNAVAILABLE" && !row.fetched) return "NO_DATA";
  if (row.ok === true && row.fetched === true && fields.length > 0) {
    if (parser === "CACHE_PRESENT" || parser === "MARKET_LAYER" || parser === "OK" || parser === "CACHE_ONLY") {
      return "SUCCESS";
    }
    return "PARTIAL";
  }
  if (row.fetched === true && (fields.length === 0 || row.ok === false)) {
    if (parser === "NO_COORDS_OR_EMPTY" || parser === "CACHE_MISS" || parser === "SKIPPED") return "NO_DATA";
    return "PARTIAL";
  }
  if (phase === "UNAVAILABLE") return "NO_DATA";
  return "NO_DATA";
}

export function humanSourceStatusLabelIt(s: HumanSourceStatus): string {
  switch (s) {
    case "SUCCESS":
      return "Dati ottenuti";
    case "PARTIAL":
      return "Dati parziali";
    case "NO_DATA":
      return "Nessun dato utilizzabile";
    case "HTTP_ERROR":
      return "Errore HTTP";
    case "BLOCKED":
      return "Accesso negato dal sito";
    case "MISSING_ADAPTER":
      return "Adapter non implementato";
    case "DISABLED_BY_POLICY":
      return "Disabilitato per policy";
    case "STALE":
      return "Osservazione scaduta";
    case "PARSE_ERROR":
      return "Risposta non interpretabile";
    case "RATE_LIMITED":
      return "Limite di richieste";
  }
}

export function sourceTitleIt(sourceId: string, catalogueTitle?: string | null): string {
  const known: Record<string, string> = {
    "api-sports": "API-Sports",
    "open-meteo": "Open-Meteo",
    "football-data-co-uk": "Football-Data",
    clubelo: "ClubElo",
    "the-odds-api": "The Odds API",
    fbref: "FBref",
    understat: "Understat",
    uefa: "UEFA",
    sofascore: "SofaScore",
    directa: "Diretta",
    flashscore: "Flashscore",
    soccerway: "Soccerway",
    soccervista: "SoccerVista",
    soccervital: "SoccerVital",
    oddspedia: "Oddspedia",
    betshoot: "Betshoot",
    click4soccer: "Click4Soccer",
    "sky-sport": "Sky Sport",
    ansa: "ANSA",
    analysisportiva: "AnalysisPortiva",
    sportytrader: "SportyTrader",
    ilveggente: "IlVeggente",
    opta: "Opta",
    "soccer-association": "Soccer Association",
    cies: "CIES Football Observatory",
    whoscored: "WhoScored",
    "the-athletic": "The Athletic",
    "the-analyst": "The Analyst",
    abseits: "Abseits",
    "club-football-match-data": "Club-Football-Match-Data",
    "tennis-explorer": "Tennis Explorer",
    "tennis-abstract": "Tennis Abstract",
  };
  return known[sourceId] ?? catalogueTitle ?? sourceId;
}

export function sourceFailureReasonIt(row: ResearchLike): string {
  const status = classifyHumanSourceStatus(row);
  const http = row.http_status;
  if (status === "BLOCKED" && http === 403) {
    return `Abbiamo tentato di consultare ${sourceTitleIt(row.source_id)}, ma il sito ha restituito HTTP 403. Nessun dato di questa fonte e stato utilizzato.`;
  }
  if (status === "RATE_LIMITED") {
    return `${sourceTitleIt(row.source_id)} ha limitato le richieste (HTTP 429). Nessun dato utilizzato.`;
  }
  if (status === "HTTP_ERROR") {
    return `${sourceTitleIt(row.source_id)} non era disponibile (HTTP ${http ?? "?"}).`;
  }
  if (status === "MISSING_ADAPTER") {
    return `${sourceTitleIt(row.source_id)} e nel catalogo ma non ha un adapter di produzione.`;
  }
  if (status === "DISABLED_BY_POLICY") {
    return `${sourceTitleIt(row.source_id)} e disabilitato per policy: nessun scrape non autorizzato.`;
  }
  if (status === "NO_DATA") {
    return `Il sistema ha consultato ${sourceTitleIt(row.source_id)} ma non ha trovato dati utilizzabili per questa partita.`;
  }
  if (status === "PARSE_ERROR") {
    return `La risposta di ${sourceTitleIt(row.source_id)} non e stata interpretata.`;
  }
  if (status === "PARTIAL") {
    return `${sourceTitleIt(row.source_id)} ha restituito dati incompleti.`;
  }
  return String(row.reason ?? "Nessun dettaglio aggiuntivo.");
}