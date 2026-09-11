/**
 * Union of first-class source slugs: engine catalog, research catalogue,
 * sources catalog, blocked-audit allowlist. Intelligence 500+ candidates are not included.
 */
import { BLOCKED_PROTECTED_SOURCES, FREE_SOURCE_CATALOG } from "@/domain/eval/acquisition-engine/catalog";
import { BLOCKED_ENGINE_SOURCES } from "@/domain/eval/acquisition-engine/sources/blocked";
import { POLICY_ENGINE_SOURCES } from "@/domain/eval/acquisition-engine/sources/policy";
import { RESEARCH_SOURCE_CATALOGUE } from "@/domain/eval/data-intelligence/research/source-catalogue";
import { listSources } from "@/domain/sources/catalog";

export function firstClassSourceIds(): string[] {
  const ids = new Set<string>();
  for (const s of FREE_SOURCE_CATALOG) ids.add(s.source_id);
  for (const s of BLOCKED_PROTECTED_SOURCES) ids.add(s.source_id);
  for (const s of BLOCKED_ENGINE_SOURCES) ids.add(s.source_id);
  for (const s of POLICY_ENGINE_SOURCES) ids.add(s.source_id);
  for (const s of RESEARCH_SOURCE_CATALOGUE) ids.add(s.source_id);
  for (const s of listSources()) ids.add(s.id);
  return [...ids].sort();
}
