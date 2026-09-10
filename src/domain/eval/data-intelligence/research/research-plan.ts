/**
 * Per-event research plan. Topics are attempted; missing data stays missing.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import type { PermanentEvent044 } from "@/domain/eval/permanent-044/types";
import { resolveEventTeamIdentity } from "@/domain/eval/betmind-runtime/explain/team-identity";
import { preferredSources, type FeatureFamilyId } from "@/domain/eval/data-intelligence/research/data-priority";

export type ResearchPlanTopic = {
  id: string;
  label_it: string;
  family: FeatureFamilyId;
  preferred_sources: string[];
};

export const RESEARCH_PLAN_TOPICS: ResearchPlanTopic[] = [
  { id: "historical_form", label_it: "Forma recente", family: "form_results", preferred_sources: preferredSources("form_results") },
  { id: "team_statistics", label_it: "Statistiche squadra", family: "form_results", preferred_sources: preferredSources("form_results") },
  { id: "goals", label_it: "Gol", family: "form_results", preferred_sources: preferredSources("form_results") },
  { id: "shots", label_it: "Tiri", family: "shots", preferred_sources: preferredSources("shots") },
  { id: "shots_on_target", label_it: "Tiri in porta", family: "shots", preferred_sources: preferredSources("shots") },
  { id: "corners", label_it: "Calci d'angolo", family: "corners", preferred_sources: preferredSources("corners") },
  { id: "cards", label_it: "Cartellini", family: "cards", preferred_sources: preferredSources("cards") },
  { id: "clean_sheets", label_it: "Clean sheet", family: "clean_sheets", preferred_sources: preferredSources("clean_sheets") },
  { id: "xg", label_it: "xG", family: "xg", preferred_sources: preferredSources("xg") },
  { id: "injuries", label_it: "Infortuni", family: "injuries", preferred_sources: preferredSources("injuries") },
  { id: "suspensions", label_it: "Squalifiche", family: "injuries", preferred_sources: preferredSources("injuries") },
  { id: "expected_lineup", label_it: "Formazione attesa", family: "lineups", preferred_sources: preferredSources("lineups") },
  { id: "confirmed_lineup", label_it: "Formazione confermata", family: "lineups", preferred_sources: preferredSources("lineups") },
  { id: "goalkeeper", label_it: "Portiere", family: "lineups", preferred_sources: preferredSources("lineups") },
  { id: "ppda", label_it: "PPDA", family: "ppda", preferred_sources: preferredSources("ppda") },
  { id: "possession", label_it: "Possesso", family: "possession", preferred_sources: preferredSources("possession") },
  { id: "h2h", label_it: "Precedenti (H2H)", family: "h2h", preferred_sources: preferredSources("h2h") },
  { id: "elo", label_it: "Elo", family: "elo", preferred_sources: preferredSources("elo") },
  { id: "coach", label_it: "Allenatore", family: "coach", preferred_sources: preferredSources("coach") },
  { id: "tactics", label_it: "Informazioni tattiche", family: "tactics", preferred_sources: preferredSources("tactics") },
  { id: "weather", label_it: "Meteo", family: "weather", preferred_sources: preferredSources("weather") },
  { id: "schedule_rest", label_it: "Calendario / riposo", family: "form_results", preferred_sources: preferredSources("form_results") },
  { id: "market", label_it: "Mercato (quote, fuori dal modello)", family: "market", preferred_sources: preferredSources("market") },
];

export type EventResearchPlan = {
  event_id: string;
  home: string;
  away: string;
  competition: string;
  kickoff_utc: string | null;
  identity: ReturnType<typeof resolveEventTeamIdentity>;
  topics: ResearchPlanTopic[];
  built_at: string;
};

export function buildEventResearchPlan(ev: PermanentEvent044, labBRoot?: string): EventResearchPlan {
  return {
    event_id: ev.event_id,
    home: ev.home_or_a,
    away: ev.away_or_b,
    competition: String(ev.competition ?? ""),
    kickoff_utc: ev.kickoff_utc,
    identity: resolveEventTeamIdentity({
      home: ev.home_or_a,
      away: ev.away_or_b,
      competition: String(ev.competition ?? ""),
      labBRoot,
    }),
    topics: RESEARCH_PLAN_TOPICS,
    built_at: new Date().toISOString(),
  };
}

export function persistEventResearchPlan(
  plan: EventResearchPlan,
  root = permanentRoot044(),
): string {
  const dir = join(root, "research-plans");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${plan.event_id}.json`);
  writeFileSync(path, JSON.stringify(plan, null, 2), "utf8");
  return path;
}
