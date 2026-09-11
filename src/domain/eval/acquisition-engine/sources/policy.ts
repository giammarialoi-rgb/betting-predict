/**
 * First-class adapters for catalogued sources with no public free endpoint.
 * Fail closed: NO_DATA or AUTH_REQUIRED. Never scrape. Never invent keys.
 */
import { emptyLane } from "@/domain/eval/acquisition-engine/blocked-audit";
import type { AcquisitionKind, SourceLaneResult } from "@/domain/eval/acquisition-engine/types";

export type PolicyOutcome = "NO_DATA" | "AUTH_REQUIRED";

export type PolicyEngineDef = {
  source_id: string;
  title: string;
  title_it: string;
  url: string;
  kind: AcquisitionKind;
  outcome: PolicyOutcome;
  market_layer: boolean;
  reason: string;
  reason_it: string;
};

export const POLICY_ENGINE_SOURCES: readonly PolicyEngineDef[] = [
  {
    source_id: "oddspedia",
    title: "Oddspedia",
    title_it: "Oddspedia",
    url: "https://oddspedia.com/",
    kind: "market",
    outcome: "NO_DATA",
    market_layer: true,
    reason: "No public unauthenticated odds API — MARKET layer only if a licensed feed appears",
    reason_it:
      "Oddspedia non ha un'API pubblica senza chiave. Eventuali quote resterebbero layer mercato/UI. Nessuno scrape. Nessuna quota inventata.",
  },
  {
    source_id: "sportytrader",
    title: "SportyTrader",
    title_it: "SportyTrader",
    url: "https://www.sportytrader.com/",
    kind: "market",
    outcome: "NO_DATA",
    market_layer: true,
    reason: "Tips/odds site — no public API; no scrape",
    reason_it:
      "SportyTrader non ha un endpoint pubblico. Nessuno scrape di pronostici o quote. Nessun dato inventato.",
  },
  {
    source_id: "betshoot",
    title: "Betshoot",
    title_it: "Betshoot",
    url: "https://www.betshoot.com/",
    kind: "news",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Catalogued candidate — no public unauthenticated API",
    reason_it: "Betshoot e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "click4soccer",
    title: "Click4Soccer",
    title_it: "Click4Soccer",
    url: "https://www.click4soccer.com/",
    kind: "news",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Catalogued candidate — no public unauthenticated API",
    reason_it: "Click4Soccer e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "analysisportiva",
    title: "AnalysisPortiva",
    title_it: "AnalysisPortiva",
    url: "",
    kind: "news",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Catalogued candidate — no public unauthenticated API",
    reason_it: "AnalysisPortiva e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "ilveggente",
    title: "Il Veggente",
    title_it: "Il Veggente",
    url: "",
    kind: "news",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Catalogued candidate — no public unauthenticated API",
    reason_it: "Il Veggente e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "il-veggente",
    title: "Il Veggente",
    title_it: "Il Veggente",
    url: "",
    kind: "news",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Catalogued candidate — no public unauthenticated API",
    reason_it: "Il Veggente e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "soccer-association",
    title: "Soccer Association",
    title_it: "Soccer Association",
    url: "",
    kind: "catalog",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Catalogued candidate — no public unauthenticated API",
    reason_it: "Soccer Association e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "cies",
    title: "CIES Football Observatory",
    title_it: "CIES Football Observatory",
    url: "https://football-observatory.com/",
    kind: "research_dataset",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Research site — no public machine API; no PDF scrape",
    reason_it:
      "CIES Football Observatory non espone un'API macchina pubblica. Nessuno scrape di PDF. Nessun dato utilizzato.",
  },
  {
    source_id: "cies-football-observatory",
    title: "CIES Football Observatory",
    title_it: "CIES Football Observatory",
    url: "https://football-observatory.com/",
    kind: "research_dataset",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Research site — no public machine API; no PDF scrape",
    reason_it:
      "CIES Football Observatory non espone un'API macchina pubblica. Nessuno scrape di PDF. Nessun dato utilizzato.",
  },
  {
    source_id: "opta",
    title: "Opta / Stats Perform",
    title_it: "Opta / Stats Perform",
    url: "https://www.statsperform.com/",
    kind: "catalog",
    outcome: "AUTH_REQUIRED",
    market_layer: false,
    reason: "Commercial licensed feed — no token in env; none invented",
    reason_it:
      "Opta / Stats Perform e un feed commerciale. Nessun token in ambiente. Nessuna chiave inventata. Nessun accesso non autorizzato.",
  },
  {
    source_id: "opta-stats-perform",
    title: "Opta / Stats Perform",
    title_it: "Opta / Stats Perform",
    url: "https://www.statsperform.com/",
    kind: "catalog",
    outcome: "AUTH_REQUIRED",
    market_layer: false,
    reason: "Commercial licensed feed — no token in env; none invented",
    reason_it:
      "Opta / Stats Perform e un feed commerciale. Nessun token in ambiente. Nessuna chiave inventata. Nessun accesso non autorizzato.",
  },
  {
    source_id: "the-athletic",
    title: "The Athletic",
    title_it: "The Athletic",
    url: "https://www.nytimes.com/athletic/",
    kind: "news",
    outcome: "AUTH_REQUIRED",
    market_layer: false,
    reason: "Paywalled — no scrape/bypass",
    reason_it:
      "The Athletic e dietro paywall. Nessuno scrape e nessun bypass. Nessun articolo utilizzato.",
  },
  {
    source_id: "tennis-explorer",
    title: "Tennis Explorer",
    title_it: "Tennis Explorer",
    url: "https://www.tennisexplorer.com/",
    kind: "fixtures",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Tennis catalogue — no public unauthenticated API; no scrape",
    reason_it:
      "Tennis Explorer non ha un'API pubblica. Nessuno scrape. Nessun dato tennis utilizzato.",
  },
  {
    source_id: "tennis-abstract",
    title: "Tennis Abstract",
    title_it: "Tennis Abstract",
    url: "https://www.tennisabstract.com/",
    kind: "research_dataset",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Tennis catalogue — no wired public dataset in this engine",
    reason_it:
      "Tennis Abstract e in catalogo ma non ha un dataset pubblico cablato qui. Nessuno scrape. Nessun dato inventato.",
  },
  {
    source_id: "tennisstats",
    title: "TennisStats",
    title_it: "TennisStats",
    url: "",
    kind: "catalog",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Tennis catalogue candidate — no public unauthenticated API",
    reason_it: "TennisStats e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
  {
    source_id: "tennisinsight",
    title: "TennisInsight",
    title_it: "TennisInsight",
    url: "",
    kind: "catalog",
    outcome: "NO_DATA",
    market_layer: false,
    reason: "Tennis catalogue candidate — no public unauthenticated API",
    reason_it: "TennisInsight e in catalogo ma non ha un'API pubblica. Nessuno scrape. Nessun dato utilizzato.",
  },
] as const;

const BY_ID = new Map(POLICY_ENGINE_SOURCES.map((s) => [s.source_id, s]));

export function isPolicyEngineSource(id: string): boolean {
  return BY_ID.has(id);
}

export function policyEngineDef(id: string): PolicyEngineDef | undefined {
  return BY_ID.get(id);
}

export function runPolicyLane(input: { sourceId: string; url?: string }): SourceLaneResult {
  const def = BY_ID.get(input.sourceId);
  const status = def?.outcome ?? "NO_DATA";
  return emptyLane({
    source_id: input.sourceId,
    url: input.url ?? def?.url ?? "",
    status,
    reason: def?.reason ?? "NO_PUBLIC_ENDPOINT",
    reason_it:
      def?.reason_it ??
      `${input.sourceId} non ha un endpoint pubblico. Nessuno scrape. Nessun dato inventato.`,
  });
}
