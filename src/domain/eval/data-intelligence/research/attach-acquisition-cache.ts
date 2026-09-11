/**
 * Attach acquisition-engine disk cache to a single event.
 * Identity fail-closed. Never invents a match. Odds stay MARKET/UI if present.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { matchEventPair, pickUniqueDatedPair } from "@/domain/eval/data-intelligence/research/identity-match";
import { parseEspnScoreboard } from "@/domain/eval/acquisition-engine/sources/espn";
import { parseOpenLigaMatches } from "@/domain/eval/acquisition-engine/sources/openligadb";
import { parseOpenFootballPack } from "@/domain/eval/acquisition-engine/sources/openfootball";
import { parseTheSportsDbEvents } from "@/domain/eval/acquisition-engine/sources/thesportsdb";

export type AcquisitionAttachHit = {
  source_id: string;
  ok: boolean;
  fetched: boolean;
  fields: string[];
  reason: string;
  parser_status: "SUCCESS" | "NO_EVENT" | "NO_DATA";
  url: string | null;
};

function readJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((n) => n.endsWith(".json"))
      .map((n) => readFileSync(join(dir, n), "utf8"));
  } catch {
    return [];
  }
}

function emptyHit(
  source_id: string,
  url: string,
  fetched: boolean,
  reason: string,
  parser_status: "NO_EVENT" | "NO_DATA",
): AcquisitionAttachHit {
  return {
    source_id,
    ok: false,
    fetched,
    fields: [],
    reason,
    parser_status,
    url,
  };
}

function okHit(source_id: string, url: string, field: string, reason: string): AcquisitionAttachHit {
  return {
    source_id,
    ok: true,
    fetched: true,
    fields: [field],
    reason,
    parser_status: "SUCCESS",
    url,
  };
}

export function attachAcquisitionCacheToEvent(input: {
  cwd?: string;
  home: string;
  away: string;
  kickoffIso?: string | null;
}): AcquisitionAttachHit[] {
  const cwd = input.cwd ?? process.cwd();
  const kickoff = input.kickoffIso ?? null;
  const out: AcquisitionAttachHit[] = [];

  const espnUrl = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/scoreboard";
  const espnTexts = readJsonFiles(join(cwd, "data", "acquisition", "espn"));
  if (!espnTexts.length) {
    out.push(emptyHit("espn", espnUrl, false, "Nessuna cache ESPN in disco per questa partita.", "NO_DATA"));
  } else {
    const events = espnTexts.flatMap((t) => parseEspnScoreboard(t));
    const hits = events.filter((e) => e.home && e.away && matchEventPair(input.home, input.away, e.home, e.away).matched);
    const picked = pickUniqueDatedPair(hits, (e) => e.date, kickoff);
    out.push(
      picked
        ? okHit("espn", espnUrl, "espn_fixture", "Fixture ESPN (JSON non ufficiale) abbinata. Solo contesto calendario.")
        : emptyHit(
            "espn",
            espnUrl,
            true,
            "ESPN scoreboard letto ma questa partita non e stata abbinata (identità fail-closed).",
            "NO_EVENT",
          ),
    );
  }

  const ligaUrl = "https://api.openligadb.de/getmatchdata/bl1";
  const ligaTexts = readJsonFiles(join(cwd, "data", "acquisition", "openligadb"));
  if (!ligaTexts.length) {
    out.push(emptyHit("openligadb", ligaUrl, false, "Nessuna cache OpenLigaDB in disco per questa partita.", "NO_DATA"));
  } else {
    const matches = ligaTexts.flatMap((t) => parseOpenLigaMatches(t));
    const hits = matches.filter((m) => {
      const h = m.team1?.teamName;
      const a = m.team2?.teamName;
      return Boolean(h && a && matchEventPair(input.home, input.away, h, a).matched);
    });
    const picked = pickUniqueDatedPair(hits, (m) => m.matchDateTimeUTC ?? m.matchDateTime, kickoff);
    out.push(
      picked
        ? okHit("openligadb", ligaUrl, "openligadb_fixture", "Fixture OpenLigaDB abbinata. Identità fail-closed.")
        : emptyHit(
            "openligadb",
            ligaUrl,
            true,
            "OpenLigaDB letto ma questa partita non e stata abbinata (identità fail-closed).",
            "NO_EVENT",
          ),
    );
  }

  const ofUrl = "https://github.com/openfootball/football.json";
  const ofTexts = readJsonFiles(join(cwd, "data", "acquisition", "openfootball"));
  if (!ofTexts.length) {
    out.push(emptyHit("openfootball", ofUrl, false, "Nessuna cache OpenFootball in disco per questa partita.", "NO_DATA"));
  } else {
    const matches = ofTexts.flatMap((t) => parseOpenFootballPack(t).matches);
    const hits = matches.filter((m) => m.team1 && m.team2 && matchEventPair(input.home, input.away, m.team1, m.team2).matched);
    const picked = pickUniqueDatedPair(hits, (m) => m.date, kickoff);
    out.push(
      picked
        ? okHit(
            "openfootball",
            ofUrl,
            "openfootball_fixture",
            "Partita OpenFootball (DATE_ONLY). Storico; non entra nel modello indipendente.",
          )
        : emptyHit(
            "openfootball",
            ofUrl,
            true,
            "OpenFootball letto ma questa partita non e stata abbinata (identità fail-closed).",
            "NO_EVENT",
          ),
    );
  }

  const tsUrl = "https://www.thesportsdb.com/api/v1/json/3/";
  const tsTexts = readJsonFiles(join(cwd, "data", "acquisition", "thesportsdb"));
  if (!tsTexts.length) {
    out.push(emptyHit("thesportsdb", tsUrl, false, "Nessuna cache TheSportsDB in disco per questa partita.", "NO_DATA"));
  } else {
    const events = tsTexts.flatMap((t) => parseTheSportsDbEvents(t));
    const hits = events.filter(
      (e) => e.strHomeTeam && e.strAwayTeam && matchEventPair(input.home, input.away, e.strHomeTeam, e.strAwayTeam).matched,
    );
    const picked = pickUniqueDatedPair(hits, (e) => e.dateEvent, kickoff);
    out.push(
      picked
        ? okHit("thesportsdb", tsUrl, "thesportsdb_event", "Meta TheSportsDB abbinata. Solo contesto.")
        : emptyHit(
            "thesportsdb",
            tsUrl,
            true,
            "TheSportsDB letto ma questa partita non e stata abbinata (identità fail-closed).",
            "NO_EVENT",
          ),
    );
  }

  return out;
}
