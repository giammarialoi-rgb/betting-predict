/**
 * Human "what we found" lines from persisted observations only.
 */
import { featureLabelIt } from "@/domain/eval/betmind-runtime/explain/feature-dictionary";
import type { ResearchObservation } from "@/domain/eval/data-intelligence/research/observations-store";

function kindIt(kind: string | undefined, status: string): string {
  if (kind === "EVENT_RESEARCH") return "ricerca evento";
  if (kind === "HISTORICAL_PRIOR") return "archivio storico";
  if (kind === "DERIVED") return "dato derivato";
  if (kind === "MARKET") return "mercato (non entra nel modello)";
  if (kind === "CONTEXT" || status === "CONTEXT") return "contesto";
  if (status === "REAL") return "dato reale";
  return "osservazione";
}

export function buildFoundFacts(input: {
  observations: ResearchObservation[];
  home: string;
  away: string;
}): string[] {
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const o of input.observations) {
    if (o.value == null) continue;
    const key = `${o.source}:${o.feature_key}:${String(o.value)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = featureLabelIt(o.feature_key.replace(/^page_/, ""), input.home, input.away);
    const when = o.available_at ?? o.observed_at;
    const extra = when ? `, ${when}` : "";
    lines.push(`${label} = ${String(o.value)} (${o.source}, ${kindIt(o.kind, o.status)}${extra})`);
    if (lines.length >= 40) break;
  }
  return lines;
}
