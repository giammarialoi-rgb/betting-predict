/**
 * Persistent TeamIdentityRegistry. source_ids stay null until observed.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { permanentRoot044 } from "@/domain/eval/permanent-044/config";
import { normalizeTeamName } from "@/domain/eval/data-intelligence/research/identity-normalize";

export type TeamSourceIds = {
  sofascore: string | null;
  api_sports: string | null;
  fbref: string | null;
  understat: string | null;
  whoscored: string | null;
  football_data: string | null;
};

export type TeamIdentityRecord = {
  canonical_id: string;
  canonical_name: string;
  aliases: string[];
  country: string | null;
  competition: string | null;
  source_ids: TeamSourceIds;
  updated_at: string;
};

type RegistryFile = { updated_at: string; teams: TeamIdentityRecord[] };

function emptyIds(): TeamSourceIds {
  return {
    sofascore: null,
    api_sports: null,
    fbref: null,
    understat: null,
    whoscored: null,
    football_data: null,
  };
}

export function identityRegistryPath(root = permanentRoot044()): string {
  return join(root, "identity", "teams.json");
}

export function loadTeamIdentityRegistry(root = permanentRoot044()): RegistryFile {
  const p = identityRegistryPath(root);
  if (!existsSync(p)) return { updated_at: new Date(0).toISOString(), teams: [] };
  try {
    return JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, "")) as RegistryFile;
  } catch {
    return { updated_at: new Date(0).toISOString(), teams: [] };
  }
}

export function saveTeamIdentityRegistry(file: RegistryFile, root = permanentRoot044()): void {
  mkdirSync(join(root, "identity"), { recursive: true });
  file.updated_at = new Date().toISOString();
  writeFileSync(identityRegistryPath(root), JSON.stringify(file, null, 2), "utf8");
}

export function upsertTeamIdentity(input: {
  canonical_id: string;
  display_name: string;
  country?: string | null;
  competition?: string | null;
  source_ids?: Partial<TeamSourceIds>;
  root?: string;
}): TeamIdentityRecord {
  const root = input.root ?? permanentRoot044();
  const file = loadTeamIdentityRegistry(root);
  const id = input.canonical_id;
  let rec = file.teams.find((t) => t.canonical_id === id);
  const alias = input.display_name.trim();
  if (!rec) {
    rec = {
      canonical_id: id,
      canonical_name: alias,
      aliases: alias ? [alias, normalizeTeamName(alias)] : [],
      country: input.country ?? null,
      competition: input.competition ?? null,
      source_ids: { ...emptyIds(), ...(input.source_ids ?? {}) },
      updated_at: new Date().toISOString(),
    };
    file.teams.push(rec);
  } else {
    if (alias && !rec.aliases.includes(alias)) rec.aliases.push(alias);
    const n = normalizeTeamName(alias);
    if (n && !rec.aliases.includes(n)) rec.aliases.push(n);
    if (input.country) rec.country = rec.country ?? input.country;
    if (input.competition) rec.competition = rec.competition ?? input.competition;
    if (input.source_ids) {
      for (const [k, v] of Object.entries(input.source_ids)) {
        if (v == null) continue;
        rec.source_ids[k as keyof TeamSourceIds] = String(v);
      }
    }
    rec.updated_at = new Date().toISOString();
  }
  saveTeamIdentityRegistry(file, root);
  return rec;
}

export function lookupTeamByAlias(name: string, root = permanentRoot044()): TeamIdentityRecord | null {
  const n = normalizeTeamName(name);
  const file = loadTeamIdentityRegistry(root);
  for (const t of file.teams) {
    if (t.canonical_id === n || normalizeTeamName(t.canonical_name) === n) return t;
    if (t.aliases.some((a) => normalizeTeamName(a) === n || a.toLowerCase() === name.trim().toLowerCase())) {
      return t;
    }
  }
  return null;
}
