/**
 * First-class BLOCKED adapters for WAF / CAPTCHA / policy-protected sites.
 * Never fetches. Never bypasses. Honest Italian audit only.
 */
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import type { SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

export type BlockedEngineDef = {
  source_id: string;
  title: string;
  title_it: string;
  url: string;
  reason: string;
  reason_it: string;
};

export const BLOCKED_ENGINE_SOURCES: readonly BlockedEngineDef[] = [
  {
    source_id: "sofascore",
    title: "SofaScore",
    title_it: "SofaScore",
    url: "https://www.sofascore.com/",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "SofaScore restituisce HTTP 403 (protezione del sito). Nessun bypass di CAPTCHA o WAF. Nessun dato di questa fonte e stato utilizzato.",
  },
  {
    source_id: "fbref",
    title: "FBref",
    title_it: "FBref",
    url: "https://fbref.com/en/",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "FBref restituisce HTTP 403 (protezione del sito). Nessun bypass di CAPTCHA o WAF. Nessun dato di questa fonte e stato utilizzato.",
  },
  {
    source_id: "whoscored",
    title: "WhoScored",
    title_it: "WhoScored",
    url: "https://www.whoscored.com/",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "WhoScored restituisce HTTP 403 (protezione del sito). Nessun bypass di CAPTCHA o WAF. Nessun dato di questa fonte e stato utilizzato.",
  },
  {
    source_id: "directa",
    title: "Diretta",
    title_it: "Diretta",
    url: "https://www.diretta.it/",
    reason: "HTTP 403 / WAF — no bypass; scrape disabled by policy",
    reason_it:
      "Diretta e protetta (HTTP 403 / WAF) e lo scrape e disabilitato per policy. Nessun bypass. Nessun dato utilizzato.",
  },
  {
    source_id: "diretta",
    title: "Diretta",
    title_it: "Diretta",
    url: "https://www.diretta.it/",
    reason: "HTTP 403 / WAF — no bypass; scrape disabled by policy",
    reason_it:
      "Diretta e protetta (HTTP 403 / WAF) e lo scrape e disabilitato per policy. Nessun bypass. Nessun dato utilizzato.",
  },
  {
    source_id: "flashscore",
    title: "Flashscore",
    title_it: "Flashscore",
    url: "https://www.flashscore.com/",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "Flashscore restituisce HTTP 403 (protezione del sito). Nessun bypass di CAPTCHA o WAF. Nessun dato utilizzato.",
  },
  {
    source_id: "soccerway",
    title: "Soccerway",
    title_it: "Soccerway",
    url: "https://int.soccerway.com/",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "Soccerway restituisce HTTP 403 (protezione del sito). Nessun bypass. Nessun dato utilizzato.",
  },
  {
    source_id: "soccervista",
    title: "SoccerVista",
    title_it: "SoccerVista",
    url: "https://www.soccervista.com/",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "SoccerVista restituisce HTTP 403 (protezione del sito). Nessun bypass. Nessun dato utilizzato.",
  },
  {
    source_id: "soccervital",
    title: "SoccerVital",
    title_it: "SoccerVital",
    url: "https://www.soccervital.com/",
    reason: "HTTP 403 / WAF — no bypass",
    reason_it:
      "SoccerVital restituisce HTTP 403 (protezione del sito). Nessun bypass. Nessun dato utilizzato.",
  },
  {
    source_id: "uefa",
    title: "UEFA",
    title_it: "UEFA",
    url: "https://www.uefa.com/",
    reason: "No public unauthenticated stats endpoint; homepage is not a data API",
    reason_it:
      "UEFA non espone un endpoint pubblico non autenticato per statistiche. Nessuno scrape della homepage. Nessun dato utilizzato.",
  },
  {
    source_id: "the-analyst",
    title: "The Analyst",
    title_it: "The Analyst",
    url: "https://theanalyst.com/",
    reason: "No public unauthenticated API; 403 stays BLOCKED",
    reason_it:
      "The Analyst non ha un'API pubblica senza autenticazione. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "abseits",
    title: "Abseits",
    title_it: "Abseits",
    url: "https://www.abseits.at/",
    reason: "No public unauthenticated API; 403 stays BLOCKED",
    reason_it:
      "Abseits non ha un'API pubblica senza autenticazione. Nessuno scrape. Nessun dato utilizzato.",
  },
] as const;

const BY_ID = new Map(BLOCKED_ENGINE_SOURCES.map((s) => [s.source_id, s]));

export function isBlockedEngineSource(id: string): boolean {
  return BY_ID.has(id);
}

export function blockedEngineDef(id: string): BlockedEngineDef | undefined {
  return BY_ID.get(id);
}

/** Honest BLOCKED lane — no HTTP, no WAF/CAPTCHA bypass. */
export function runBlockedLane(input: { sourceId: string; url?: string }): SourceLaneResult {
  const def = BY_ID.get(input.sourceId);
  return emptyLane({
    source_id: input.sourceId,
    url: input.url ?? def?.url ?? "",
    status: "BLOCKED",
    http_status: 403,
    reason: def?.reason ?? "BLOCKED — no public unauthenticated endpoint; no WAF bypass",
    reason_it:
      def?.reason_it ??
      `${input.sourceId} e bloccato: nessun endpoint pubblico e nessuno scrape. Nessun dato utilizzato.`,
  });
}
