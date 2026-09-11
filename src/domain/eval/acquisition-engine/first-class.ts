/**
 * First-class product slugs: engine allowlist that is actually discovered
 * plus the active Fonti board. Intelligence 500+ candidates, WAF sites,
 * and policy stubs are not first-class.
 */
import { FREE_SOURCE_CATALOG } from "@/domain/eval/acquisition-engine/catalog";
import { ACTIVE_FONTI_SOURCE_IDS, tokenEnvPresent } from "@/domain/eval/acquisition-engine/active-fonti";
import { RESEARCH_SOURCE_CATALOGUE } from "@/domain/eval/data-intelligence/research/source-catalogue";

function apiSportsTokenPresent(): boolean {
  return tokenEnvPresent("API_SPORTS_KEY") || tokenEnvPresent("API_FOOTBALL_KEY");
}

export function firstClassSourceIds(): string[] {
  const ids = new Set<string>();
  for (const id of ACTIVE_FONTI_SOURCE_IDS) ids.add(id);
  for (const s of RESEARCH_SOURCE_CATALOGUE) ids.add(s.source_id);
  for (const s of FREE_SOURCE_CATALOG) {
    if (s.source_id === "api-football" || s.source_id === "api-sports") {
      if (!apiSportsTokenPresent()) continue;
    } else if (s.requires_token && !tokenEnvPresent(s.requires_token)) {
      continue;
    }
    ids.add(s.source_id);
  }
  return [...ids].sort();
}
