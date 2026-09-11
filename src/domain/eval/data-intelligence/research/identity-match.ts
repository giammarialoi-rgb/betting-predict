/**
 * Deterministic team/event identity matching.
 *
 * Exact normalized key or declared alias only. No substring / token-subset
 * guessing. Ambiguous short names (Villa, United, Real, …) fail closed.
 * Never invents entities or provider IDs.
 */
import {
  identityKey,
  isCollisionStem,
  namesEqual,
} from "@/domain/eval/data-intelligence/research/identity-normalize";

export type TeamMatchStatus =
  | "EXACT"
  | "ALIAS"
  | "NONE"
  | "AMBIGUOUS"
  | "SHORT_NAME_BLOCKED";

export type TeamMatchResult = {
  matched: boolean;
  status: TeamMatchStatus;
  identity_key: string | null;
  method: string;
  reason: string;
  reason_it: string;
};

export type TeamPickResult = TeamMatchResult & {
  candidate: string | null;
  candidates: string[];
};

export type EventSide = "home" | "away";

function emptyMatch(status: TeamMatchStatus, reason: string, reason_it: string): TeamMatchResult {
  return {
    matched: false,
    status,
    identity_key: null,
    method: status.toLowerCase(),
    reason,
    reason_it,
  };
}

/**
 * Pairwise team identity. True only when both names share one identity key.
 */
export function matchTeamNames(a: string, b: string): TeamMatchResult {
  const ka = identityKey(a);
  const kb = identityKey(b);
  if (!ka || !kb) {
    return emptyMatch(
      "NONE",
      "IDENTITY_NONE — empty team name",
      "Nome squadra vuoto: nessun abbinamento.",
    );
  }
  if (ka === kb) {
    const alias = ka !== basicTokensKey(a) || kb !== basicTokensKey(b);
    const status: TeamMatchStatus = alias ? "ALIAS" : "EXACT";
    return {
      matched: true,
      status,
      identity_key: ka,
      method: status === "ALIAS" ? "alias" : "exact",
      reason: `${status} — identity_key=${ka}`,
      reason_it:
        status === "ALIAS"
          ? `Abbinamento per alias dichiarato (chiave ${ka}).`
          : `Abbinamento esatto (chiave ${ka}).`,
    };
  }
  if (isCollisionStem(ka) || isCollisionStem(kb)) {
    return emptyMatch(
      "SHORT_NAME_BLOCKED",
      `IDENTITY_SHORT_NAME — "${a}" / "${b}" share a collision stem and are not the same club`,
      `Nome ambiguo ("${a}" / "${b}"): nessun aggancio per evitare un club sbagliato.`,
    );
  }
  return emptyMatch(
    "NONE",
    `IDENTITY_NONE — "${a}" ≠ "${b}" (keys ${ka} / ${kb})`,
    `Nomi squadra non coincidenti ("${a}" ≠ "${b}"). Nessun dato inventato.`,
  );
}

/** Token strip without synonym fold — used only to label EXACT vs ALIAS. */
function basicTokensKey(raw: string): string {
  return String(raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[.'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Pick the unique candidate whose identity key equals the query.
 * Collision stems and 2+ distinct keys fail closed.
 */
export function pickUniqueTeam(query: string, candidates: readonly string[]): TeamPickResult {
  const qKey = identityKey(query);
  if (!qKey) {
    return {
      ...emptyMatch("NONE", "IDENTITY_NONE — empty query", "Nome squadra vuoto: nessun abbinamento."),
      candidate: null,
      candidates: [],
    };
  }
  if (isCollisionStem(qKey)) {
    return {
      ...emptyMatch(
        "SHORT_NAME_BLOCKED",
        `IDENTITY_SHORT_NAME — "${query}" is a collision stem (not a unique club)`,
        `Nome troppo corto o ambiguo ("${query}"): nessun aggancio.`,
      ),
      candidate: null,
      candidates: [],
    };
  }

  const hits: string[] = [];
  const hitKeys = new Set<string>();
  for (const c of candidates) {
    const k = identityKey(c);
    if (!k || k !== qKey) continue;
    hits.push(c);
    hitKeys.add(k);
  }

  if (hitKeys.size > 1) {
    return {
      ...emptyMatch(
        "AMBIGUOUS",
        `IDENTITY_AMBIGUOUS — "${query}" matched ${hitKeys.size} identity keys`,
        `Identità ambigua per "${query}": più club possibili. Nessun aggancio.`,
      ),
      candidate: null,
      candidates: hits,
    };
  }
  if (!hits.length) {
    return {
      ...emptyMatch(
        "NONE",
        `IDENTITY_NONE — "${query}" (key ${qKey}) not in candidate set`,
        `Nessun club con chiave ${qKey} tra i candidati. Nessun dato inventato.`,
      ),
      candidate: null,
      candidates: [],
    };
  }

  const pair = matchTeamNames(query, hits[0]!);
  return {
    matched: true,
    status: pair.status === "ALIAS" ? "ALIAS" : "EXACT",
    identity_key: qKey,
    method: pair.method,
    reason: pair.reason,
    reason_it: pair.reason_it,
    candidate: hits[0]!,
    candidates: [...new Set(hits)],
  };
}

/**
 * Attach a provider team label to home or away. If it matches both or neither
 * (or is a short collision stem), do not attach.
 */
export function assignEventSide(
  teamName: string,
  home: string,
  away: string,
): { side: EventSide | null; match: TeamMatchResult } {
  const h = matchTeamNames(teamName, home);
  const a = matchTeamNames(teamName, away);
  if (h.matched && a.matched) {
    const amb = emptyMatch(
      "AMBIGUOUS",
      `IDENTITY_AMBIGUOUS — "${teamName}" matched both home and away`,
      `Identità ambigua: "${teamName}" coincide con casa e ospite. Nessun aggancio.`,
    );
    return { side: null, match: amb };
  }
  if (h.matched) return { side: "home", match: h };
  if (a.matched) return { side: "away", match: a };
  if (h.status === "SHORT_NAME_BLOCKED" || a.status === "SHORT_NAME_BLOCKED") {
    return { side: null, match: h.status === "SHORT_NAME_BLOCKED" ? h : a };
  }
  return { side: null, match: h.status === "NONE" ? h : a };
}

export function matchEventPair(
  home: string,
  away: string,
  candidateHome: string,
  candidateAway: string,
): TeamMatchResult {
  const h = matchTeamNames(home, candidateHome);
  const a = matchTeamNames(away, candidateAway);
  if (h.matched && a.matched) {
    const status: TeamMatchStatus = h.status === "ALIAS" || a.status === "ALIAS" ? "ALIAS" : "EXACT";
    return {
      matched: true,
      status,
      identity_key: `${h.identity_key}|${a.identity_key}`,
      method: "event_pair",
      reason: `EVENT_${status} — home=${h.identity_key} away=${a.identity_key}`,
      reason_it: `Partita abbinata (casa ${h.identity_key}, ospite ${a.identity_key}).`,
    };
  }
  if (h.status === "SHORT_NAME_BLOCKED" || a.status === "SHORT_NAME_BLOCKED" || h.status === "AMBIGUOUS" || a.status === "AMBIGUOUS") {
    return emptyMatch(
      h.status === "AMBIGUOUS" || a.status === "AMBIGUOUS" ? "AMBIGUOUS" : "SHORT_NAME_BLOCKED",
      `IDENTITY_AMBIGUOUS — event pair not unique (${h.reason}; ${a.reason})`,
      `Identità di partita ambigua. Nessun aggancio.`,
    );
  }
  return emptyMatch(
    "NONE",
    `IDENTITY_NONE — event pair mismatch (${h.reason}; ${a.reason})`,
    `Coppia casa/ospite non abbinata in modo univoco. Nessun dato inventato.`,
  );
}

export function namesMatch(a: string, b: string): boolean {
  return namesEqual(a, b);
}
