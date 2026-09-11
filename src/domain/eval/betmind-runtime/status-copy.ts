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

export function operationalStatusIt(raw: string | null | undefined): string {
  const u = String(raw ?? "UNKNOWN").toUpperCase();
  switch (u) {
    case "ACTIVE":
    case "ACTIVE_ASOF":
    case "ONLINE":
    case "OK":
    case "SUCCESS":
      return "Attiva";
    case "DEGRADED":
    case "PARTIAL":
    case "TEMPORALLY_CAUTIOUS":
    case "PLAN_LIMITED":
    case "RESEARCH_TEST":
      return "Parziale / attenzionata";
    case "BLOCKED":
      return "Bloccata (HTTP/WAF) — nessun bypass";
    case "NO_EVENT":
    case "NO_DATA":
      return "Nessun evento associato";
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
    default:
      return raw ? String(raw) : "Sconosciuto";
  }
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
