/**
 * Readable Italian status copy — no Node APIs (safe for client components).
 * Raw codes like STALE_MIRROR stay in APIs; UI shows these phrases.
 */

export function formatAgeIt(ageMs: number | null | undefined): string {
  if (ageMs == null || !Number.isFinite(ageMs) || ageMs < 0) return "sconosciuta";
  const s = Math.round(ageMs / 1000);
  if (s < 60) return `${s} s fa`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min fa`;
  const h = ageMs / 3_600_000;
  if (h < 24) return h < 10 ? `${h.toFixed(1)} ore fa` : `${Math.round(h)} ore fa`;
  const d = Math.round(h / 24);
  return d === 1 ? "1 giorno fa" : `${d} giorni fa`;
}

export function statusWordIt(
  state: string | null | undefined,
): "Online" | "Offline" | "Degradato" | "Sconosciuto" {
  const s = String(state ?? "").toUpperCase();
  if (s === "ONLINE" || s === "OK" || s === "ACTIVE" || s === "HEALTHY" || s === "RUNNING") return "Online";
  if (s === "OFFLINE" || s === "DOWN" || s === "DEAD" || s === "STOPPED") return "Offline";
  if (s === "DEGRADED" || s === "PAUSED" || s === "RECOVER" || s === "RECOVERING") return "Degradato";
  return "Sconosciuto";
}

export function brainStatusIt(raw: string | null | undefined): string {
  const s = String(raw ?? "").trim();
  if (!s || s === "—" || s === "UNKNOWN") return "Stato sconosciuto";
  const u = s.toUpperCase();
  if (u === "STALE_MIRROR") {
    return "Specchio Neon scaduto — il PC non pubblica un battito recente";
  }
  if (u === "RUNNING" || u === "HEALTHY" || u === "WORKING") return "In esecuzione sul PC";
  if (u === "IDLE" || u === "PAUSED") return "In pausa / in attesa del prossimo ciclo";
  if (u === "STOPPED" || u === "DEAD") return "Fermo";
  if (u === "ERROR") return "Errore nel ciclo (vedi ultimo log)";
  if (u === "RECOVERING") return "In ripristino";
  return s;
}

export type SourceStatusKind =
  | "OK"
  | "NO_DATA"
  | "AUTH_REQUIRED"
  | "BLOCKED"
  | "NETWORK_ERROR"
  | "OTHER";

/** Honest 5-way kind used by the Fonti list. Never invents OK. */
export function sourceStatusKind(raw: string | null | undefined): SourceStatusKind {
  const u = String(raw ?? "").toUpperCase();
  if (["ACTIVE", "ACTIVE_ASOF", "ONLINE", "OK", "SUCCESS", "HEALTHY"].includes(u)) return "OK";
  if (u === "AUTH_REQUIRED" || u === "PLAN_LIMITED" || u.includes("AUTH_REQUIRED")) {
    return "AUTH_REQUIRED";
  }
  if (u === "BLOCKED" || u === "HTTP_403" || u.includes("WAF")) return "BLOCKED";
  if (["NETWORK_ERROR", "HTTP_ERROR", "TIMEOUT"].includes(u)) return "NETWORK_ERROR";
  if (["NO_DATA", "NO_EVENT", "UNAVAILABLE", "OFFLINE", "EMPTY"].includes(u)) return "NO_DATA";
  return "OTHER";
}

export function operationalStatusIt(raw: string | null | undefined): string {
  const u = String(raw ?? "UNKNOWN").toUpperCase();
  switch (u) {
    case "ACTIVE":
    case "ACTIVE_ASOF":
    case "ONLINE":
    case "OK":
    case "SUCCESS":
    case "HEALTHY":
      return "OK — dati ottenuti";
    case "DEGRADED":
    case "PARTIAL":
    case "TEMPORALLY_CAUTIOUS":
    case "RESEARCH_TEST":
    case "FOUNDATION":
      return "Parziale / in prova";
    case "PLAN_LIMITED":
    case "AUTH_REQUIRED":
      return "Autenticazione richiesta";
    case "BLOCKED":
    case "HTTP_403":
      return "Bloccata";
    case "NETWORK_ERROR":
    case "TIMEOUT":
      return "Errore di rete";
    case "HTTP_ERROR":
      return "Errore HTTP";
    case "RATE_LIMITED":
      return "Limite di richieste";
    case "NO_EVENT":
    case "NO_DATA":
    case "EMPTY":
      return "Nessun dato";
    case "MISSING_ADAPTER":
      return "Adapter assente";
    case "UNAVAILABLE":
    case "OFFLINE":
      return "Non disponibile";
    case "DISABLED_BY_POLICY":
    case "DISABLED":
      return "Disabilitata (policy)";
    case "IDLE":
      return "Inattiva in questo ciclo";
    case "CANDIDATE":
      return "Candidata (non collegata)";
    case "STALE":
      return "Scaduta";
    default:
      return raw ? String(raw) : "Sconosciuto";
  }
}

/** One-sentence Italian explanation. Prefer stored prose; never invent success. */
export function sourceBlurbIt(status: string | undefined, reason?: string | null): string {
  const trimmed = String(reason ?? "").trim();
  const looksLikeProse = trimmed.length > 12 && /[ a-zàèéìòù]/i.test(trimmed) && !/^[A-Z0-9_:-]+$/.test(trimmed);
  if (looksLikeProse) return trimmed;
  switch (sourceStatusKind(status)) {
    case "OK":
      return "La fonte ha restituito dati associati a un evento. Nessun dato inventato.";
    case "NO_DATA":
      return "Consultata, ma senza dati utilizzabili per queste partite.";
    case "AUTH_REQUIRED":
      return "Serve una chiave o un token già presenti. Nessun accesso inventato.";
    case "BLOCKED":
      return "Il sito ha bloccato la richiesta (HTTP/WAF). Nessun bypass.";
    case "NETWORK_ERROR":
      return "La rete non ha risposto. Nessun dato inventato.";
    default:
      return trimmed || "Stato di registro — nessun dato inventato.";
  }
}

export function roleLabelIt(raw: string | null | undefined): string {
  const u = String(raw ?? "").toUpperCase();
  if (u === "MODEL_FEATURE") return "Può entrare nel modello, solo se i dati sono ammissibili";
  if (u === "MARKET_COMPARE" || u === "MARKET") return "Quote di mercato, solo confronto";
  if (u === "CONTEXT") return "Solo contesto, non entra nel modello";
  if (u === "DISABLED") return "Disabilitata";
  return raw ? String(raw) : "—";
}

export function sourceTitleIt(sourceId: string, catalogueTitle?: string | null): string {
  const known: Record<string, string> = {
    "api-sports": "API-Sports",
    "open-meteo": "Open-Meteo",
    "football-data-co-uk": "Football-Data",
    clubelo: "ClubElo",
    openligadb: "OpenLigaDB",
    thesportsdb: "TheSportsDB",
    espn: "ESPN Scoreboard (non ufficiale)",
    openfootball: "OpenFootball",
    "bbc-sport": "BBC Sport",
    "guardian-football": "The Guardian Football",
    gazzetta: "Gazzetta dello Sport",
    ansa: "ANSA",
    statsbomb: "StatsBomb Open Data",
    "football-data-org": "football-data.org",
    "api-football": "API-Football",
    "the-odds-api": "The Odds API",
    fbref: "FBref",
    understat: "Understat",
    sofascore: "SofaScore",
  };
  return known[sourceId] ?? catalogueTitle ?? sourceId;
}

export function temporalLabelIt(raw: string | null | undefined): string {
  const u = String(raw ?? "").toUpperCase();
  if (u === "STRICT_AS_OF") return "Orario preciso (as-of)";
  if (u === "DATE_ONLY") return "Solo data, non orario esatto";
  if (u === "UNKNOWN") return "Precisione sconosciuta";
  if (u === "N/A" || u === "NA") return "Non applicabile";
  return raw ? String(raw) : "—";
}

export function eventStatusIt(raw: string | null | undefined): string {
  const u = String(raw ?? "").toUpperCase();
  if (!u || u === "N/A" || u === "UNKNOWN") return "Stato sconosciuto";
  if (/\b(LIVE|IN_PLAY|PLAYING|1H|2H|HT)\b/.test(u)) return "In corso";
  if (/\b(FINISHED|ENDED|FT|FINAL|SETTLED|COMPLETE)\b/.test(u)) return "Terminata";
  if (/\b(SCHEDULED|NS|NOT_STARTED|UPCOMING|PRE_MATCH|PREMATCH)\b/.test(u)) return "In programma";
  if (/\b(POSTPONED|CANCELLED|CANCELED|ABANDONED)\b/.test(u)) return "Rinviata o annullata";
  return decisionLabelIt(raw);
}

export function bucketLabelIt(raw: string | null | undefined): string {
  const u = String(raw ?? "").toUpperCase();
  switch (u) {
    case "ALL":
      return "Tutte";
    case "DISCOVERED":
      return "Scoperte";
    case "QUEUED":
      return "In coda";
    case "RESEARCHING":
      return "In ricerca";
    case "RESEARCHED":
      return "Ricercate";
    case "ELIGIBLE":
    case "ELIGIBLE_FOR_MODEL":
      return "Ammissibili";
    case "MODEL_INFERENCE":
    case "ANALYZED":
      return "Previsione modello";
    case "INSUFFICIENT_DATA":
      return "Dati insufficienti";
    case "SKIPPED":
      return "Saltate";
    case "UNAVAILABLE":
      return "Non disponibili";
    case "LIVE":
      return "Live";
    case "UPCOMING":
      return "In programma";
    case "FINISHED":
      return "Terminate";
    case "FOOTBALL":
    case "SOCCER":
      return "Calcio";
    case "TENNIS":
      return "Tennis";
    case "BASKETBALL":
      return "Basket";
    case "HOCKEY":
      return "Hockey";
    case "VOLLEYBALL":
      return "Volley";
    default:
      return raw ? String(raw) : "—";
  }
}

/** Primary UI copy for a decision / prediction status. Never show raw codes as the headline. */
export function decisionLabelIt(raw: string | null | undefined): string {
  const u = String(raw ?? "").toUpperCase();
  if (!u || u === "N/A" || u === "UNKNOWN") return "Non ancora valutata";
  if (u.includes("INSUFFICIENT")) return "Dati insufficienti";
  if (u === "NO_BET" || u.includes("NO_BET") || u === "HOLD") return "Nessuna scommessa";
  if (u.includes("SKIP")) return "Saltata";
  if (u.includes("UNAVAILABLE") || u.includes("TEMPORAL")) return "Non disponibile";
  if (
    u.includes("MODEL_INFERENCE") ||
    u.includes("INDEPENDENT") ||
    u === "ANALYZED" ||
    u === "INDEPENDENT_MODEL"
  ) {
    return "Previsione indipendente";
  }
  if (u.includes("RESEARCHING")) return "In ricerca";
  if (u.includes("RESEARCHED") || u === "FEATURED") return "Ricercata";
  if (u.includes("QUEUED")) return "In coda";
  if (u.includes("ELIGIBLE")) return "Ammissibile";
  if (u.includes("DISCOVERED")) return "Scoperta";
  return bucketLabelIt(raw);
}

export function selectionLabelIt(raw: string | null | undefined): string {
  const u = String(raw ?? "").toUpperCase();
  if (u === "HOME" || u === "H" || u === "1") return "Casa";
  if (u === "DRAW" || u === "X" || u === "D") return "Pareggio";
  if (u === "AWAY" || u === "A" || u === "2") return "Trasferta";
  return raw ? String(raw) : "—";
}

export function marketLabelIt(raw: string | null | undefined): string {
  const u = String(raw ?? "").toUpperCase().replace(/\s+/g, "_");
  if (!u) return "Risultato 1X2";
  if (u === "1X2" || u === "H2H" || u === "MATCH_ODDS" || u === "MATCH_RESULT") return "Risultato 1X2";
  return raw ? String(raw) : "Risultato 1X2";
}
